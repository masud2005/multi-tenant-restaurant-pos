import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSupplierReturnDto,
  GetSupplierReturnsQueryDto,
} from './dto';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { MovementReason, Prisma } from '../../../prisma/generated/client';

@Injectable()
export class SupplierReturnService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Generate sequential RTN (Return To Supplier Note) number per branch
   * Format: RTN-YYYYMMDD-001
   */
  private async generateReturnNumber(
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

    const countToday = await client.supplierReturn.count({
      where: {
        branchId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const serial = String(countToday + 1).padStart(3, '0');
    return `RTN-${dateStr}-${serial}`;
  }

  /**
   * Create a new Supplier Return record.
   * Atomically:
   * 1. Validates stock availability in the branch
   * 2. Generates RTN number and creates SupplierReturn + lines
   * 3. Calculates total credit due from supplier
   * 4. Deducts currentStock in BranchStock
   * 5. Logs audit StockMovement (reason: MovementReason.RETURN)
   */
  async createSupplierReturn(
    tenantSlug: string,
    dto: CreateSupplierReturnDto,
    user?: any,
  ) {
    // 1. Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });
    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Verify branch exists and belongs to tenant
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: dto.branchId,
        tenantId: tenant.id,
      },
    });
    if (!branch) {
      throw new NotFoundException('Branch');
    }

    // 3. Verify supplier exists and is active
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: dto.supplierId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier');
    }
    if (!supplier.active) {
      throw new BadRequestException(
        'Cannot return goods to an inactive supplier',
      );
    }

    // 4. Validate lines
    const rawLines = dto.lines ?? dto.items ?? [];
    const activeLines = rawLines.filter(
      (l) => Number(l.qty ?? l.quantity ?? 0) > 0,
    );
    if (!activeLines.length) {
      throw new BadRequestException(
        'At least one item with a quantity greater than 0 is required to return.',
      );
    }

    const ingredientIds = activeLines.map((l) => l.ingredientId);
    if (new Set(ingredientIds).size !== activeLines.length) {
      throw new BadRequestException(
        'Each ingredient can appear only once in a return request.',
      );
    }

    // 5. Fetch ingredients and their branch stocks to validate stock on hand
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        branchStocks: {
          where: { branchId: branch.id },
        },
      },
    });

    if (ingredients.length !== activeLines.length) {
      throw new BadRequestException(
        'One or more ingredients do not exist or have been deleted.',
      );
    }

    // Check stock availability for each item
    for (const line of activeLines) {
      const ing = ingredients.find((i) => i.id === line.ingredientId)!;
      const currentStock = ing.branchStocks[0]?.currentStock ?? 0;
      const returnQty = Number(line.qty ?? line.quantity ?? 0);

      if (returnQty > currentStock + 1e-6) {
        throw new BadRequestException(
          `Cannot return ${returnQty} ${ing.unit} of "${ing.name}". Only ${currentStock} ${ing.unit} available in branch stock.`,
        );
      }
    }

    const creatorName =
      dto.createdBy?.trim() || user?.name || user?.email || 'Staff';

    // 6. Execute atomic database transaction
    const returnRecord = await this.prisma.$transaction(async (tx) => {
      const rtnNumber = await this.generateReturnNumber(branch.id, tx);

      // Compute costs and lines
      const computedLines = activeLines.map((line) => {
        const ing = ingredients.find((i) => i.id === line.ingredientId)!;
        const branchStock = ing.branchStocks[0];
        const returnQty = Number(line.qty ?? line.quantity ?? 0);
        const unitCost = Number(
          line.unitCost ?? branchStock?.unitCost ?? ing.costPerUnit ?? 0,
        );
        return {
          ingredientId: ing.id,
          ingredientName: ing.name,
          unit: ing.unit,
          qty: returnQty,
          unitCost: Math.round(unitCost * 100) / 100,
        };
      });

      const totalCredit =
        Math.round(
          computedLines.reduce((sum, l) => sum + l.qty * l.unitCost, 0) * 100,
        ) / 100;

      // Create SupplierReturn record
      const createdReturn = await tx.supplierReturn.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          supplierId: supplier.id,
          number: rtnNumber,
          reason: dto.reason.trim(),
          credit: totalCredit,
          createdBy: creatorName,
          lines: {
            create: computedLines.map((l) => ({
              ingredientId: l.ingredientId,
              qty: l.qty,
              unitCost: l.unitCost,
            })),
          },
        },
        include: {
          lines: {
            include: {
              ingredient: {
                select: { id: true, name: true, unit: true, category: true },
              },
            },
          },
          supplier: {
            select: { id: true, name: true, phone: true, email: true },
          },
          branch: {
            select: { id: true, name: true },
          },
        },
      });

      // Deduct stock and record audit stock movements
      for (const line of computedLines) {
        const ing = ingredients.find((i) => i.id === line.ingredientId)!;
        const currentStock = ing.branchStocks[0]?.currentStock ?? 0;
        const newStock = Math.max(0, currentStock - line.qty);

        // Deduct BranchStock
        await tx.branchStock.update({
          where: {
            branchId_ingredientId: {
              branchId: branch.id,
              ingredientId: line.ingredientId,
            },
          },
          data: {
            currentStock: newStock,
          },
        });

        // Record audit StockMovement
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            branchId: branch.id,
            ingredientId: line.ingredientId,
            quantity: -line.qty,
            previousStock: currentStock,
            newStock,
            unit: line.unit,
            reason: MovementReason.RETURN,
            reference: `${rtnNumber} → ${supplier.name}`,
            notes: dto.reason.trim(),
            createdBy: creatorName,
          },
        });
      }

      return createdReturn;
    });

    return {
      id: returnRecord.id,
      tenantId: returnRecord.tenantId,
      branchId: returnRecord.branchId,
      branchName: returnRecord.branch?.name || '',
      supplierId: returnRecord.supplierId,
      supplierName: returnRecord.supplier?.name || '',
      number: returnRecord.number,
      reason: returnRecord.reason || '',
      credit: returnRecord.credit,
      createdBy: returnRecord.createdBy || 'Staff',
      createdAt: returnRecord.createdAt.toISOString(),
      lines: returnRecord.lines.map((l) => ({
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
   * Get all supplier returns for a restaurant with optional branch, supplier, date, and search filters.
   */
  async getSupplierReturns(
    tenantSlug: string,
    query: GetSupplierReturnsQueryDto,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });
    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const where: Prisma.SupplierReturnWhereInput = {
      tenantId: tenant.id,
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { number: { contains: s, mode: 'insensitive' } },
        { reason: { contains: s, mode: 'insensitive' } },
        { createdBy: { contains: s, mode: 'insensitive' } },
        { supplier: { name: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const returns = await this.prisma.supplierReturn.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true, phone: true } },
        lines: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, category: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return returns.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      branchName: r.branch?.name || '',
      supplierId: r.supplierId,
      supplierName: r.supplier?.name || '',
      number: r.number,
      reason: r.reason || '',
      credit: r.credit,
      createdBy: r.createdBy || 'Staff',
      createdAt: r.createdAt.toISOString(),
      lines: r.lines.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        name: l.ingredient?.name || '',
        unit: l.ingredient?.unit || '',
        qty: l.qty,
        unitCost: l.unitCost,
      })),
    }));
  }

  /**
   * Get single supplier return by ID
   */
  async getSupplierReturnById(tenantSlug: string, id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });
    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const ret = await this.prisma.supplierReturn.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: {
          select: { id: true, name: true, phone: true, email: true },
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

    if (!ret) {
      throw new NotFoundException('Supplier return');
    }

    return {
      id: ret.id,
      tenantId: ret.tenantId,
      branchId: ret.branchId,
      branchName: ret.branch?.name || '',
      supplierId: ret.supplierId,
      supplierName: ret.supplier?.name || '',
      number: ret.number,
      reason: ret.reason || '',
      credit: ret.credit,
      createdBy: ret.createdBy || 'Staff',
      createdAt: ret.createdAt.toISOString(),
      lines: ret.lines.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        name: l.ingredient?.name || '',
        unit: l.ingredient?.unit || '',
        qty: l.qty,
        unitCost: l.unitCost,
      })),
    };
  }
}
