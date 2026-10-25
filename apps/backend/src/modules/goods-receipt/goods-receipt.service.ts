import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReceiveGoodsDto } from './dto/receive-goods.dto';
import { GetGoodsReceiptsQueryDto } from './dto/get-goods-receipts-query.dto';
import { NotFoundException } from '../../common/exceptions/business.exception';
import {
  MovementReason,
  Prisma,
  PurchaseOrderStatus,
} from '../../../prisma/generated/client';

@Injectable()
export class GoodsReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Generate sequential GRN (Goods Received Note) number per branch
   * Format: GRN-YYYYMMDD-001
   */
  private async generateGrnNumber(
    branchId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx ?? this.prisma;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const startOfDay = new Date(yyyy, now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(
      yyyy,
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const countToday = await client.goodsReceipt.count({
      where: {
        branchId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const serial = String(countToday + 1).padStart(3, '0');
    return `GRN-${dateStr}-${serial}`;
  }

  /**
   * Receive goods from a supplier against a Purchase Order.
   * Atomically:
   * 1. Creates GoodsReceipt (GRN) and lines
   * 2. Updates receivedQty on PurchaseOrderItems
   * 3. Increases BranchStock and updates costPerUnit
   * 4. Logs StockMovement (reason: PURCHASE) for each item
   * 5. Updates PurchaseOrder status to RECEIVED or PARTIALLY_RECEIVED
   */
  async receiveGoods(tenantSlug: string, dto: ReceiveGoodsDto, user?: any) {
    // 1. Verify tenant / restaurant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch the purchase order
    const po = await this.prisma.purchaseOrder.findFirst({
      where: {
        id: dto.poId,
        restaurantId: tenant.id,
      },
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
        supplier: true,
        branch: true,
      },
    });

    if (!po) {
      throw new NotFoundException('Purchase order');
    }

    // 3. Verify status allows receiving
    if (po.status === PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'This purchase order is still in draft. Send it to the supplier before receiving goods.',
      );
    }

    if (po.status === PurchaseOrderStatus.RECEIVED) {
      throw new ConflictException(
        'This purchase order has already been fully received.',
      );
    }

    if (po.status === PurchaseOrderStatus.CANCELLED) {
      throw new ConflictException(
        'Cancelled purchase orders cannot receive goods.',
      );
    }

    // 4. Validate and filter incoming lines
    const rawLines = dto.lines ?? dto.items ?? [];
    const activeLines = rawLines.filter(
      (l) => Number(l.qty ?? l.quantity ?? 0) > 0,
    );

    if (!activeLines.length) {
      throw new BadRequestException(
        'Enter a received quantity greater than 0 for at least one item.',
      );
    }

    // Check that each line belongs to this PO and does not exceed remaining quantity
    for (const line of activeLines) {
      const poItem = po.items.find(
        (item) => item.ingredientId === line.ingredientId,
      );

      if (!poItem) {
        throw new BadRequestException(
          `Ingredient ID ${line.ingredientId} does not belong to this purchase order.`,
        );
      }

      const remaining = Math.max(0, poItem.quantity - poItem.receivedQty);
      const qtyReceiving = Number(line.qty ?? line.quantity ?? 0);

      if (qtyReceiving > remaining + 1e-6) {
        const ingName = poItem.ingredient?.name || 'Item';
        const unit = poItem.ingredient?.unit || 'units';
        throw new BadRequestException(
          `Cannot receive ${qtyReceiving} ${unit} for "${ingName}". Only ${remaining} ${unit} remaining on this order.`,
        );
      }

      const unitCost = Number(line.unitCost ?? poItem.unitCost ?? 0);
      if (unitCost < 0) {
        throw new BadRequestException('Unit cost cannot be negative.');
      }
    }

    const receiverName =
      dto.receivedBy?.trim() ||
      user?.name ||
      user?.email ||
      'Staff';

    // 5. Execute all updates in a database transaction
    const grn = await this.prisma.$transaction(async (tx) => {
      const grnNumber = await this.generateGrnNumber(po.branchId, tx);

      // 5a. Create GoodsReceipt
      const createdGrn = await tx.goodsReceipt.create({
        data: {
          tenantId: tenant.id,
          branchId: po.branchId,
          supplierId: po.supplierId,
          poId: po.id,
          number: grnNumber,
          receivedBy: receiverName,
          receivedAt: new Date(),
          notes: dto.notes?.trim() || '',
          lines: {
            create: activeLines.map((l) => ({
              ingredientId: l.ingredientId,
              qty: Number(l.qty ?? l.quantity ?? 0),
              unitCost: Number(l.unitCost ?? 0),
            })),
          },
        },
        include: {
          lines: {
            include: {
              ingredient: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                  category: true,
                },
              },
            },
          },
          supplier: {
            select: { id: true, name: true },
          },
          branch: {
            select: { id: true, name: true },
          },
        },
      });

      // 5b. Update each item's receivedQty, branch stock, and movement log
      for (const line of activeLines) {
        const poItem = po.items.find(
          (item) => item.ingredientId === line.ingredientId,
        )!;
        const qtyReceived = Number(line.qty ?? line.quantity ?? 0);
        const unitCost = Number(line.unitCost ?? poItem.unitCost ?? 0);

        // Update PO item received quantity
        const updatedReceivedQty =
          Math.round((poItem.receivedQty + qtyReceived) * 1000) / 1000;
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: updatedReceivedQty },
        });

        // Find current branch stock
        const branchStock = await tx.branchStock.findUnique({
          where: {
            branchId_ingredientId: {
              branchId: po.branchId,
              ingredientId: line.ingredientId,
            },
          },
        });

        const previousStock = branchStock?.currentStock ?? 0;
        const newStock = previousStock + qtyReceived;

        // Upsert BranchStock
        await tx.branchStock.upsert({
          where: {
            branchId_ingredientId: {
              branchId: po.branchId,
              ingredientId: line.ingredientId,
            },
          },
          create: {
            tenantId: tenant.id,
            branchId: po.branchId,
            ingredientId: line.ingredientId,
            currentStock: newStock,
            unitCost,
            lastRestockedAt: new Date(),
          },
          update: {
            currentStock: newStock,
            unitCost,
            lastRestockedAt: new Date(),
          },
        });

        // Update Ingredient master costPerUnit
        if (unitCost > 0) {
          await tx.ingredient.update({
            where: { id: line.ingredientId },
            data: { costPerUnit: unitCost },
          });
        }

        // Record audit StockMovement
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            branchId: po.branchId,
            ingredientId: line.ingredientId,
            quantity: qtyReceived,
            previousStock,
            newStock,
            unit: poItem.ingredient?.unit || '',
            reason: MovementReason.PURCHASE,
            reference: `${grnNumber} / ${po.poNumber}`,
            notes: `Delivery received against ${po.poNumber} from ${po.supplier?.name || 'Supplier'}`,
            createdBy: receiverName,
          },
        });
      }

      // 5c. Check if PO is now fully received or partially received
      const updatedPoItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });

      const isFullyReceived = updatedPoItems.every(
        (item) => item.receivedQty >= item.quantity - 1e-6,
      );

      const nextStatus = isFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: nextStatus },
      });

      return createdGrn;
    });

    // 6. Format response for UI compatibility
    const totalValue = grn.lines.reduce(
      (sum, l) => sum + l.qty * l.unitCost,
      0,
    );

    return {
      ...grn,
      poNumber: po.poNumber,
      supplierName: po.supplier?.name || '',
      totalValue: Math.round(totalValue * 100) / 100,
      lines: grn.lines.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        name: l.ingredient?.name || '',
        unit: l.ingredient?.unit || '',
        qty: l.qty,
        unitCost: l.unitCost,
      })),
    };
  }

  /**
   * Get all goods receipts for a tenant restaurant with optional filtering.
   */
  async getGoodsReceipts(tenantSlug: string, query: GetGoodsReceiptsQueryDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const where: Prisma.GoodsReceiptWhereInput = {
      tenantId: tenant.id,
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.poId) {
      where.poId = query.poId;
    }

    if (query.startDate || query.endDate) {
      where.receivedAt = {};
      if (query.startDate) {
        where.receivedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.receivedAt.lte = new Date(query.endDate);
      }
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { number: { contains: s, mode: 'insensitive' } },
        { receivedBy: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: s, mode: 'insensitive' } } },
        { supplier: { name: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const receipts = await this.prisma.goodsReceipt.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true, phone: true } },
        purchaseOrder: {
          select: { id: true, poNumber: true, status: true, expectedAt: true },
        },
        lines: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, category: true },
            },
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });

    return receipts.map((r) => {
      const totalValue = r.lines.reduce(
        (sum, l) => sum + l.qty * l.unitCost,
        0,
      );

      return {
        id: r.id,
        number: r.number,
        poId: r.poId,
        poNumber: r.purchaseOrder?.poNumber || '',
        poStatus: r.purchaseOrder?.status || null,
        supplierId: r.supplierId,
        supplierName: r.supplier?.name || '',
        branchId: r.branchId,
        branchName: r.branch?.name || '',
        receivedBy: r.receivedBy || 'Staff',
        receivedAt: r.receivedAt.toISOString(),
        notes: r.notes || '',
        lines: r.lines.map((l) => ({
          id: l.id,
          ingredientId: l.ingredientId,
          name: l.ingredient?.name || '',
          unit: l.ingredient?.unit || '',
          qty: l.qty,
          unitCost: l.unitCost,
          subtotal: Math.round(l.qty * l.unitCost * 100) / 100,
        })),
        totalValue: Math.round(totalValue * 100) / 100,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  /**
   * Get all purchase orders awaiting delivery (status SENT or PARTIALLY_RECEIVED)
   * for the Receiving page.
   */
  async getAwaitingOrders(tenantSlug: string, branchId?: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const where: Prisma.PurchaseOrderWhereInput = {
      restaurantId: tenant.id,
      status: {
        in: [PurchaseOrderStatus.SENT, PurchaseOrderStatus.PARTIALLY_RECEIVED],
      },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: {
          select: { id: true, name: true, phone: true, email: true },
        },
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, category: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => {
      const lines = o.items.map((item) => {
        const remaining = Math.max(0, item.quantity - item.receivedQty);
        return {
          id: item.id,
          ingredientId: item.ingredientId,
          name: item.ingredient?.name || '',
          unit: item.ingredient?.unit || '',
          qty: item.quantity,
          receivedQty: item.receivedQty,
          remainingQty: Math.round(remaining * 1000) / 1000,
          unitCost: item.unitCost,
          subtotal: Math.round(item.quantity * item.unitCost * 100) / 100,
        };
      });

      const total = lines.reduce((sum, l) => sum + l.subtotal, 0);

      return {
        id: o.id,
        number: o.poNumber,
        status: o.status === PurchaseOrderStatus.SENT ? 'sent' : 'partial',
        rawStatus: o.status,
        branchId: o.branchId,
        branchName: o.branch?.name || '',
        supplierId: o.supplierId,
        supplierName: o.supplier?.name || '',
        expectedDate: o.expectedAt ? o.expectedAt.toISOString() : null,
        notes: o.notes || '',
        lines,
        total: Math.round(total * 100) / 100,
        createdAt: o.createdAt.toISOString(),
      };
    });
  }

  /**
   * Get details of a single goods receipt by ID.
   */
  async getGoodsReceiptById(tenantSlug: string, id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: {
          select: { id: true, name: true, phone: true, email: true },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            expectedAt: true,
            notes: true,
          },
        },
        lines: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, category: true },
            },
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Goods receipt');
    }

    const totalValue = receipt.lines.reduce(
      (sum, l) => sum + l.qty * l.unitCost,
      0,
    );

    return {
      id: receipt.id,
      number: receipt.number,
      poId: receipt.poId,
      poNumber: receipt.purchaseOrder?.poNumber || '',
      poStatus: receipt.purchaseOrder?.status || null,
      supplierId: receipt.supplierId,
      supplierName: receipt.supplier?.name || '',
      branchId: receipt.branchId,
      branchName: receipt.branch?.name || '',
      receivedBy: receipt.receivedBy || 'Staff',
      receivedAt: receipt.receivedAt.toISOString(),
      notes: receipt.notes || '',
      lines: receipt.lines.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        name: l.ingredient?.name || '',
        unit: l.ingredient?.unit || '',
        qty: l.qty,
        unitCost: l.unitCost,
        subtotal: Math.round(l.qty * l.unitCost * 100) / 100,
      })),
      totalValue: Math.round(totalValue * 100) / 100,
      createdAt: receipt.createdAt.toISOString(),
    };
  }
}

