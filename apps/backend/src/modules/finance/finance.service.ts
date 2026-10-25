import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { GetLedgerQueryDto } from './dto/get-ledger-query.dto';
import { PaymentMethod, Prisma } from '../../../prisma/generated/client';

export interface LedgerRow {
  id: string;
  kind: 'payment' | 'refund';
  orderId: string;
  orderNumber: string;
  method: string;
  rawMethod: PaymentMethod;
  amount: number;
  tendered?: number;
  change?: number;
  reference: string;
  at: string;
  branchId: string;
  branchName?: string;
}

export interface LedgerSummary {
  takenToday: number;
  cashToday: number;
  cardMobileToday: number;
  refundedToday: number;
  totalPaymentsCount: number;
  totalRefundsCount: number;
  totalCount: number;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Round number to 2 decimal places
   */
  private round2(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  /**
   * Fetch restaurant tenant by slug
   */
  private async getTenant(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    return tenant;
  }

  /**
   * Get payments and refunds ledger for a restaurant tenant
   */
  async getLedger(tenantSlug: string, query: GetLedgerQueryDto) {
    const tenant = await this.getTenant(tenantSlug);

    const kind = query.kind || 'all';
    const shouldFetchPayments = kind === 'all' || kind === 'payment';
    const shouldFetchRefunds = kind === 'all' || kind === 'refund';

    // 1. Build date range filter if provided
    let dateFilter: Prisma.DateTimeFilter | undefined;
    if (query.startDate || query.endDate) {
      dateFilter = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    // 2. Build payment method filter
    let parsedMethod: PaymentMethod | undefined;
    if (query.method?.trim()) {
      const upper = query.method.trim().toUpperCase();
      if (Object.values(PaymentMethod).includes(upper as PaymentMethod)) {
        parsedMethod = upper as PaymentMethod;
      }
    }

    // 3. Search condition across Order
    const searchCondition = query.search?.trim()
      ? {
          OR: [
            { orderNumber: { contains: query.search.trim(), mode: 'insensitive' as const } },
            { customerName: { contains: query.search.trim(), mode: 'insensitive' as const } },
            { customerPhone: { contains: query.search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    // 4. Common Order relation filter
    const orderRelationFilter: Prisma.OrderWhereInput = {
      tenantId: tenant.id,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...searchCondition,
    };

    // 5. Query OrderPayment and OrderRefund in parallel
    const [payments, refunds] = await Promise.all([
      shouldFetchPayments
        ? this.prisma.orderPayment.findMany({
            where: {
              order: orderRelationFilter,
              ...(parsedMethod ? { method: parsedMethod } : {}),
              ...(dateFilter ? { createdAt: dateFilter } : {}),
            },
            include: {
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  branchId: true,
                  branch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),

      shouldFetchRefunds
        ? this.prisma.orderRefund.findMany({
            where: {
              order: orderRelationFilter,
              ...(parsedMethod ? { method: parsedMethod } : {}),
              ...(dateFilter ? { createdAt: dateFilter } : {}),
            },
            include: {
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  branchId: true,
                  branch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    // 6. Map to unified LedgerRow format
    const paymentRows: LedgerRow[] = payments.map((p) => ({
      id: p.id,
      kind: 'payment',
      orderId: p.orderId,
      orderNumber: p.order.orderNumber,
      method: p.method.toLowerCase(),
      rawMethod: p.method,
      amount: this.round2(p.amount),
      tendered: this.round2(p.tendered),
      change: this.round2(p.change),
      reference: p.reference || '',
      at: p.createdAt.toISOString(),
      branchId: p.order.branchId,
      branchName: p.order.branch?.name,
    }));

    const refundRows: LedgerRow[] = refunds.map((r) => ({
      id: r.id,
      kind: 'refund',
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      method: r.method.toLowerCase(),
      rawMethod: r.method,
      amount: -this.round2(r.amount),
      tendered: 0,
      change: 0,
      reference: r.reason || '',
      at: r.createdAt.toISOString(),
      branchId: r.order.branchId,
      branchName: r.order.branch?.name,
    }));

    // 7. Combine and sort descending by timestamp
    const allRows = [...paymentRows, ...refundRows].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    // 8. Calculate summary metrics (e.g. today's figures)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayPayments = paymentRows.filter(
      (r) => new Date(r.at) >= startOfToday,
    );
    const todayRefunds = refundRows.filter(
      (r) => new Date(r.at) >= startOfToday,
    );

    const takenToday = this.round2(
      todayPayments.reduce((sum, r) => sum + r.amount, 0),
    );
    const cashToday = this.round2(
      todayPayments
        .filter((r) => r.method === 'cash')
        .reduce((sum, r) => sum + r.amount, 0),
    );
    const cardMobileToday = this.round2(
      todayPayments
        .filter((r) => r.method !== 'cash')
        .reduce((sum, r) => sum + r.amount, 0),
    );
    const refundedToday = this.round2(
      todayRefunds.reduce((sum, r) => sum + Math.abs(r.amount), 0),
    );

    const summary: LedgerSummary = {
      takenToday,
      cashToday,
      cardMobileToday,
      refundedToday,
      totalPaymentsCount: payments.length,
      totalRefundsCount: refunds.length,
      totalCount: allRows.length,
    };

    // 9. Handle pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 200;
    const paginatedItems = allRows.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      summary,
      total: allRows.length,
    };
  }
}
