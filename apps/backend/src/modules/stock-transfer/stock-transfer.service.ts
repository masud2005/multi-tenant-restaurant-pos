import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { ReceiveStockTransferDto } from './dto/receive-stock-transfer.dto';
import { MovementReason, TransferStatus } from '../../../prisma/generated/client';

@Injectable()
export class StockTransferService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTenant(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) throw new NotFoundException('Restaurant');
    return tenant;
  }

  /**
   * List inter-branch stock transfers
   */
  async listTransfers(
    tenantSlug: string,
    query?: { branchId?: string; status?: string },
  ) {
    const tenant = await this.getTenant(tenantSlug);

    const where: any = {
      tenantId: tenant.id,
    };

    if (query?.branchId) {
      where.OR = [
        { fromBranchId: query.branchId },
        { toBranchId: query.branchId },
      ];
    }

    if (query?.status) {
      where.status = query.status.toUpperCase() as TransferStatus;
    }

    const transfers = await this.prisma.stockTransfer.findMany({
      where,
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        lines: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((t) => ({
      id: t.id,
      tenantId: t.tenantId,
      number: t.number,
      fromBranchId: t.fromBranchId,
      fromBranchName: t.fromBranch.name,
      toBranchId: t.toBranchId,
      toBranchName: t.toBranch.name,
      status: t.status.toLowerCase(),
      notes: t.notes || '',
      initiatedBy: t.initiatedBy || '',
      receivedBy: t.receivedBy || '',
      sentAt: t.sentAt ? t.sentAt.toISOString() : null,
      receivedAt: t.receivedAt ? t.receivedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      lines: t.lines.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        ingredientName: l.ingredient.name,
        unit: l.ingredient.unit,
        quantity: l.quantity,
      })),
    }));
  }

  /**
   * Get single stock transfer by ID
   */
  async getTransfer(tenantSlug: string, transferId: string) {
    const tenant = await this.getTenant(tenantSlug);

    const t = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, tenantId: tenant.id },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        lines: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });

    if (!t) throw new NotFoundException('Stock transfer');

    return {
      id: t.id,
      tenantId: t.tenantId,
      number: t.number,
      fromBranchId: t.fromBranchId,
      fromBranchName: t.fromBranch.name,
      toBranchId: t.toBranchId,
      toBranchName: t.toBranch.name,
      status: t.status.toLowerCase(),
      notes: t.notes || '',
      initiatedBy: t.initiatedBy || '',
      receivedBy: t.receivedBy || '',
      sentAt: t.sentAt ? t.sentAt.toISOString() : null,
      receivedAt: t.receivedAt ? t.receivedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      lines: t.lines.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        ingredientName: l.ingredient.name,
        unit: l.ingredient.unit,
        quantity: l.quantity,
      })),
    };
  }

  /**
   * Create & dispatch a stock transfer
   */
  async createTransfer(
    tenantSlug: string,
    dto: CreateStockTransferDto,
    user?: any,
  ) {
    const tenant = await this.getTenant(tenantSlug);

    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('Source and destination branches cannot be the same.');
    }

    const count = await this.prisma.stockTransfer.count({
      where: { tenantId: tenant.id },
    });
    const number = `TR-${count + 1}`;
    const initiatedBy = dto.initiatedBy?.trim() || user?.name || user?.email || 'Manager';

    return this.prisma.$transaction(async (tx) => {
      // 1. Check stock in fromBranch and create transfer
      const transfer = await tx.stockTransfer.create({
        data: {
          tenantId: tenant.id,
          fromBranchId: dto.fromBranchId,
          toBranchId: dto.toBranchId,
          number,
          status: TransferStatus.IN_TRANSIT,
          notes: dto.notes?.trim() || '',
          initiatedBy,
          sentAt: new Date(),
          lines: {
            create: dto.lines.map((l) => ({
              ingredientId: l.ingredientId,
              quantity: l.quantity,
            })),
          },
        },
        include: {
          fromBranch: true,
          toBranch: true,
          lines: { include: { ingredient: true } },
        },
      });

      // 2. Deduct stock from source branch & record StockMovement TRANSFER_OUT
      for (const line of dto.lines) {
        await tx.branchStock.upsert({
          where: {
            branchId_ingredientId: {
              branchId: dto.fromBranchId,
              ingredientId: line.ingredientId,
            },
          },
          update: {
            currentStock: { decrement: line.quantity },
          },
          create: {
            tenantId: tenant.id,
            branchId: dto.fromBranchId,
            ingredientId: line.ingredientId,
            currentStock: -line.quantity,
          },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            branchId: dto.fromBranchId,
            ingredientId: line.ingredientId,
            quantity: -line.quantity,
            reason: MovementReason.TRANSFER_OUT,
            notes: `Transfer ${number} to ${transfer.toBranch.name}`,
          },
        });
      }

      return this.getTransfer(tenantSlug, transfer.id);
    });
  }

  /**
   * Receive a stock transfer at destination branch
   */
  async receiveTransfer(
    tenantSlug: string,
    transferId: string,
    dto: ReceiveStockTransferDto,
    user?: any,
  ) {
    const tenant = await this.getTenant(tenantSlug);

    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, tenantId: tenant.id },
      include: { lines: true, fromBranch: true, toBranch: true },
    });

    if (!transfer) throw new NotFoundException('Stock transfer');
    if (transfer.status !== TransferStatus.IN_TRANSIT && transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(`Cannot receive a transfer in ${transfer.status} status.`);
    }

    const receivedBy = dto.receivedBy?.trim() || user?.name || user?.email || 'Store Manager';

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark transfer RECEIVED
      await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.RECEIVED,
          receivedBy,
          receivedAt: new Date(),
          notes: dto.notes?.trim() ? `${transfer.notes || ''} | Received: ${dto.notes.trim()}` : transfer.notes,
        },
      });

      // 2. Increment stock in destination branch & record StockMovement TRANSFER_IN
      for (const line of transfer.lines) {
        await tx.branchStock.upsert({
          where: {
            branchId_ingredientId: {
              branchId: transfer.toBranchId,
              ingredientId: line.ingredientId,
            },
          },
          update: {
            currentStock: { increment: line.quantity },
          },
          create: {
            tenantId: tenant.id,
            branchId: transfer.toBranchId,
            ingredientId: line.ingredientId,
            currentStock: line.quantity,
          },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            branchId: transfer.toBranchId,
            ingredientId: line.ingredientId,
            quantity: line.quantity,
            reason: MovementReason.TRANSFER_IN,
            notes: `Received Transfer ${transfer.number} from ${transfer.fromBranch.name}`,
          },
        });
      }

      return this.getTransfer(tenantSlug, transfer.id);
    });
  }

  /**
   * Cancel an in-transit transfer (returns stock to source)
   */
  async cancelTransfer(tenantSlug: string, transferId: string, user?: any) {
    const tenant = await this.getTenant(tenantSlug);

    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, tenantId: tenant.id },
      include: { lines: true },
    });

    if (!transfer) throw new NotFoundException('Stock transfer');
    if (transfer.status === TransferStatus.RECEIVED || transfer.status === TransferStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel a transfer in ${transfer.status} status.`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: TransferStatus.CANCELLED },
      });

      // Rollback stock to source branch if it was deducted
      if (transfer.status === TransferStatus.IN_TRANSIT) {
        for (const line of transfer.lines) {
          await tx.branchStock.update({
            where: {
              branchId_ingredientId: {
                branchId: transfer.fromBranchId,
                ingredientId: line.ingredientId,
              },
            },
            data: { currentStock: { increment: line.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              tenantId: tenant.id,
              branchId: transfer.fromBranchId,
              ingredientId: line.ingredientId,
              quantity: line.quantity,
              reason: MovementReason.ADJUSTMENT,
              notes: `Cancelled transfer ${transfer.number} - stock restored`,
            },
          });
        }
      }

      return { ok: true, message: 'Stock transfer cancelled successfully' };
    });
  }
}
