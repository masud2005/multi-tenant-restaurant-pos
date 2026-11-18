import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { GetLedgerQueryDto } from './dto/get-ledger-query.dto';
import { PaymentMethod, Prisma } from '../../../prisma/generated/client';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { AddCashEntryDto } from './dto/add-cash-entry.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { GetCashSessionsQueryDto } from './dto/get-cash-sessions-query.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { GetExpensesQueryDto } from './dto/get-expenses-query.dto';

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

export interface CashSummary {
  openingFloat: number;
  cashSales: number;
  cashRefunds: number;
  cashExpenses: number;
  cashIn: number;
  cashOut: number;
  expected: number;
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
      : undefined;

    // 4. Query OrderPayment records
    const payments = shouldFetchPayments
      ? await this.prisma.orderPayment.findMany({
          where: {
            order: {
              tenantId: tenant.id,
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...searchCondition,
            },
            ...(parsedMethod ? { method: parsedMethod } : {}),
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                branchId: true,
                branch: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // 5. Query OrderRefund records
    const refunds = shouldFetchRefunds
      ? await this.prisma.orderRefund.findMany({
          where: {
            order: {
              tenantId: tenant.id,
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...searchCondition,
            },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                branchId: true,
                branch: { select: { id: true, name: true } },
                payments: { select: { method: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // 6. Map to LedgerRow
    const paymentRows: LedgerRow[] = payments.map((p) => ({
      id: p.id,
      kind: 'payment',
      orderId: p.orderId,
      orderNumber: p.order.orderNumber,
      method: p.method.toLowerCase(),
      rawMethod: p.method,
      amount: this.round2(p.amount),
      tendered: p.tendered ? this.round2(p.tendered) : undefined,
      change: p.change ? this.round2(p.change) : undefined,
      reference: p.reference || '',
      at: p.createdAt.toISOString(),
      branchId: p.order.branchId,
      branchName: p.order.branch?.name,
    }));

    const refundRows: LedgerRow[] = refunds.map((r) => {
      const primaryMethod = r.order.payments[0]?.method || PaymentMethod.CASH;
      return {
        id: r.id,
        kind: 'refund',
        orderId: r.orderId,
        orderNumber: r.order.orderNumber,
        method: primaryMethod.toLowerCase(),
        rawMethod: primaryMethod,
        amount: -this.round2(r.amount),
        reference: r.reason || 'Customer refund',
        at: r.createdAt.toISOString(),
        branchId: r.order.branchId,
        branchName: r.order.branch?.name,
      };
    });

    // 7. Combine & sort chronologically
    const allRows = [...paymentRows, ...refundRows].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    // 8. Calculate summary metrics
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

  // =========================================================================
  // CASH DRAWER / SESSIONS
  // =========================================================================

  /**
   * Helper: Calculate cash summary for a specific session window
   */
  async computeSessionSummary(
    tenantId: string,
    branchId: string,
    openedAt: Date,
    closedAt: Date | null,
    openingFloat: number,
    entries: { kind: string; amount: number }[],
  ): Promise<CashSummary> {
    const end = closedAt || new Date();

    // 1. Cash sales during window
    const cashPayments = await this.prisma.orderPayment.findMany({
      where: {
        method: PaymentMethod.CASH,
        createdAt: { gte: openedAt, lte: end },
        order: { tenantId, branchId },
      },
      select: { amount: true },
    });
    const cashSales = this.round2(
      cashPayments.reduce((acc, p) => acc + p.amount, 0),
    );

    // 2. Cash refunds during window
    const cashRefundsList = await this.prisma.orderRefund.findMany({
      where: {
        createdAt: { gte: openedAt, lte: end },
        order: {
          tenantId,
          branchId,
          payments: { some: { method: PaymentMethod.CASH } },
        },
      },
      select: { amount: true },
    });
    const cashRefunds = this.round2(
      cashRefundsList.reduce((acc, r) => acc + r.amount, 0),
    );

    // 3. Cash expenses during window
    const cashExpensesList = await this.prisma.expense.findMany({
      where: {
        tenantId,
        branchId,
        paidFrom: 'cash_drawer',
        createdAt: { gte: openedAt, lte: end },
      },
      select: { amount: true },
    });
    const cashExpenses = this.round2(
      cashExpensesList.reduce((acc, e) => acc + e.amount, 0),
    );

    // 4. Pay-ins and Pay-outs
    const cashIn = this.round2(
      entries.filter((e) => e.kind === 'in').reduce((acc, e) => acc + e.amount, 0),
    );
    const cashOut = this.round2(
      entries.filter((e) => e.kind === 'out').reduce((acc, e) => acc + e.amount, 0),
    );

    // 5. Expected cash in drawer
    const expected = this.round2(
      openingFloat + cashSales - cashRefunds - cashExpenses + cashIn - cashOut,
    );

    return {
      openingFloat: this.round2(openingFloat),
      cashSales,
      cashRefunds,
      cashExpenses,
      cashIn,
      cashOut,
      expected,
    };
  }

  /**
   * List cash drawer sessions with calculated summaries
   */
  async listCashSessions(tenantSlug: string, query: GetCashSessionsQueryDto) {
    const tenant = await this.getTenant(tenantSlug);

    const sessions = await this.prisma.cashSession.findMany({
      where: {
        tenantId: tenant.id,
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: {
        entries: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { openedAt: 'desc' },
    });

    const enrichedSessions = await Promise.all(
      sessions.map(async (s) => {
        const summary = await this.computeSessionSummary(
          tenant.id,
          s.branchId,
          s.openedAt,
          s.closedAt,
          s.openingFloat,
          s.entries,
        );

        return {
          id: s.id,
          tenantId: s.tenantId,
          branchId: s.branchId,
          number: s.number,
          openedBy: s.openedBy,
          openedAt: s.openedAt.toISOString(),
          openingFloat: this.round2(s.openingFloat),
          entries: s.entries.map((e) => ({
            id: e.id,
            kind: e.kind as 'in' | 'out',
            amount: this.round2(e.amount),
            reason: e.reason,
            by: e.by,
            at: e.createdAt.toISOString(),
          })),
          closedBy: s.closedBy,
          closedAt: s.closedAt ? s.closedAt.toISOString() : null,
          expectedCash: s.expectedCash !== null ? this.round2(s.expectedCash) : summary.expected,
          countedCash: s.countedCash !== null ? this.round2(s.countedCash) : null,
          variance: s.variance !== null ? this.round2(s.variance) : null,
          notes: s.notes,
          summary,
        };
      }),
    );

    return enrichedSessions;
  }

  /**
   * Get active open cash session for a branch
   */
  async getCurrentCashSession(tenantSlug: string, branchId: string) {
    const tenant = await this.getTenant(tenantSlug);

    const session = await this.prisma.cashSession.findFirst({
      where: {
        tenantId: tenant.id,
        branchId,
        closedAt: null,
      },
      include: {
        entries: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) return null;

    const summary = await this.computeSessionSummary(
      tenant.id,
      session.branchId,
      session.openedAt,
      session.closedAt,
      session.openingFloat,
      session.entries,
    );

    return {
      id: session.id,
      tenantId: session.tenantId,
      branchId: session.branchId,
      number: session.number,
      openedBy: session.openedBy,
      openedAt: session.openedAt.toISOString(),
      openingFloat: this.round2(session.openingFloat),
      entries: session.entries.map((e) => ({
        id: e.id,
        kind: e.kind as 'in' | 'out',
        amount: this.round2(e.amount),
        reason: e.reason,
        by: e.by,
        at: e.createdAt.toISOString(),
      })),
      closedBy: session.closedBy,
      closedAt: null,
      expectedCash: summary.expected,
      countedCash: null,
      variance: null,
      notes: session.notes,
      summary,
    };
  }

  /**
   * Open a new cash drawer shift
   */
  async openCashSession(
    tenantSlug: string,
    dto: OpenCashSessionDto,
    user?: any,
  ) {
    const tenant = await this.getTenant(tenantSlug);

    // Verify branch exists
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId: tenant.id },
    });
    if (!branch) throw new NotFoundException('Branch');

    // Check if a cash drawer is already open for this branch
    const existing = await this.prisma.cashSession.findFirst({
      where: {
        tenantId: tenant.id,
        branchId: dto.branchId,
        closedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException('A cash drawer is already open for this branch.');
    }

    const sessionCount = await this.prisma.cashSession.count({
      where: { tenantId: tenant.id },
    });
    const sessionNumber = `CS-${sessionCount + 1}`;
    const openedBy = dto.by?.trim() || user?.name || user?.email || 'Cashier';

    const session = await this.prisma.cashSession.create({
      data: {
        tenantId: tenant.id,
        branchId: dto.branchId,
        number: sessionNumber,
        openedBy,
        openingFloat: this.round2(dto.openingFloat),
        notes: '',
      },
      include: { entries: true },
    });

    const summary: CashSummary = {
      openingFloat: this.round2(session.openingFloat),
      cashSales: 0,
      cashRefunds: 0,
      cashExpenses: 0,
      cashIn: 0,
      cashOut: 0,
      expected: this.round2(session.openingFloat),
    };

    return {
      id: session.id,
      tenantId: session.tenantId,
      branchId: session.branchId,
      number: session.number,
      openedBy: session.openedBy,
      openedAt: session.openedAt.toISOString(),
      openingFloat: session.openingFloat,
      entries: [],
      closedBy: null,
      closedAt: null,
      expectedCash: null,
      countedCash: null,
      variance: null,
      notes: '',
      summary,
    };
  }

  /**
   * Add a cash entry (Pay in / Pay out)
   */
  async addCashEntry(
    tenantSlug: string,
    sessionId: string,
    dto: AddCashEntryDto,
    user?: any,
  ) {
    const tenant = await this.getTenant(tenantSlug);

    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId: tenant.id },
      include: { entries: true },
    });
    if (!session) throw new NotFoundException('Cash session');
    if (session.closedAt !== null) {
      throw new BadRequestException('Cannot add entries to a closed cash drawer shift.');
    }

    const recordedBy = dto.by?.trim() || user?.name || user?.email || 'Staff';

    await this.prisma.cashEntry.create({
      data: {
        cashSessionId: session.id,
        kind: dto.kind,
        amount: this.round2(dto.amount),
        reason: dto.reason.trim(),
        by: recordedBy,
      },
    });

    // Re-fetch updated session
    const updated = await this.prisma.cashSession.findUnique({
      where: { id: session.id },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });

    if (!updated) throw new NotFoundException('Cash session');

    const summary = await this.computeSessionSummary(
      tenant.id,
      updated.branchId,
      updated.openedAt,
      updated.closedAt,
      updated.openingFloat,
      updated.entries,
    );

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      number: updated.number,
      openedBy: updated.openedBy,
      openedAt: updated.openedAt.toISOString(),
      openingFloat: this.round2(updated.openingFloat),
      entries: updated.entries.map((e) => ({
        id: e.id,
        kind: e.kind as 'in' | 'out',
        amount: this.round2(e.amount),
        reason: e.reason,
        by: e.by,
        at: e.createdAt.toISOString(),
      })),
      closedBy: updated.closedBy,
      closedAt: null,
      expectedCash: summary.expected,
      countedCash: null,
      variance: null,
      notes: updated.notes,
      summary,
    };
  }

  /**
   * Close a cash drawer shift
   */
  async closeCashSession(
    tenantSlug: string,
    sessionId: string,
    dto: CloseCashSessionDto,
    user?: any,
  ) {
    const tenant = await this.getTenant(tenantSlug);

    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId: tenant.id },
      include: { entries: true },
    });
    if (!session) throw new NotFoundException('Cash session');
    if (session.closedAt !== null) {
      throw new BadRequestException('Cash drawer shift is already closed.');
    }

    const closedAt = new Date();
    const closedBy = dto.by?.trim() || user?.name || user?.email || 'Manager';

    const summary = await this.computeSessionSummary(
      tenant.id,
      session.branchId,
      session.openedAt,
      closedAt,
      session.openingFloat,
      session.entries,
    );

    const countedCash = this.round2(dto.countedCash);
    const expectedCash = summary.expected;
    const variance = this.round2(countedCash - expectedCash);

    const updated = await this.prisma.cashSession.update({
      where: { id: session.id },
      data: {
        closedBy,
        closedAt,
        expectedCash,
        countedCash,
        variance,
        notes: dto.notes?.trim() || '',
      },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });

    // Create notification if cash variance is non-zero
    if (Math.abs(variance) > 0) {
      await this.prisma.notification.create({
        data: {
          tenantId: tenant.id,
          branchId: session.branchId,
          type: 'CASH',
          title: 'Cash variance detected',
          body: `${updated.number} closed ${variance > 0 ? 'over' : 'short'} by ${Math.abs(variance)}.`,
        },
      });
    }

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      number: updated.number,
      openedBy: updated.openedBy,
      openedAt: updated.openedAt.toISOString(),
      openingFloat: this.round2(updated.openingFloat),
      entries: updated.entries.map((e) => ({
        id: e.id,
        kind: e.kind as 'in' | 'out',
        amount: this.round2(e.amount),
        reason: e.reason,
        by: e.by,
        at: e.createdAt.toISOString(),
      })),
      closedBy: updated.closedBy,
      closedAt: updated.closedAt ? updated.closedAt.toISOString() : null,
      expectedCash,
      countedCash,
      variance,
      notes: updated.notes,
      summary,
    };
  }

  // =========================================================================
  // EXPENSES & PETTY CASH
  // =========================================================================

  /**
   * List expenses with optional branch and filter
   */
  async listExpenses(tenantSlug: string, query: GetExpensesQueryDto) {
    const tenant = await this.getTenant(tenantSlug);

    const expenses = await this.prisma.expense.findMany({
      where: {
        tenantId: tenant.id,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.date ? { date: query.date } : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return expenses.map((e) => ({
      id: e.id,
      tenantId: e.tenantId,
      branchId: e.branchId,
      category: e.category,
      description: e.description,
      amount: this.round2(e.amount),
      paidFrom: e.paidFrom as 'cash_drawer' | 'bank',
      date: e.date,
      createdBy: e.createdBy,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  /**
   * Create an expense entry
   */
  async createExpense(
    tenantSlug: string,
    dto: CreateExpenseDto,
    user?: any,
  ) {
    const tenant = await this.getTenant(tenantSlug);

    // Verify branch
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId: tenant.id },
    });
    if (!branch) throw new NotFoundException('Branch');

    const amount = this.round2(dto.amount);

    // If paid from cash_drawer, check that drawer is open and has sufficient funds
    if (dto.paidFrom === 'cash_drawer') {
      const activeSession = await this.prisma.cashSession.findFirst({
        where: {
          tenantId: tenant.id,
          branchId: dto.branchId,
          closedAt: null,
        },
        include: { entries: true },
      });

      if (!activeSession) {
        throw new BadRequestException('Open the cash drawer to pay from cash.');
      }

      const summary = await this.computeSessionSummary(
        tenant.id,
        activeSession.branchId,
        activeSession.openedAt,
        activeSession.closedAt,
        activeSession.openingFloat,
        activeSession.entries,
      );

      if (amount > summary.expected) {
        throw new BadRequestException('Not enough cash in the drawer.');
      }
    }

    const createdBy = dto.createdBy?.trim() || user?.name || user?.email || 'Staff';
    const expenseDate = dto.date || new Date().toISOString().slice(0, 10);

    const expense = await this.prisma.expense.create({
      data: {
        tenantId: tenant.id,
        branchId: dto.branchId,
        category: dto.category.toLowerCase(),
        description: dto.description.trim(),
        amount,
        paidFrom: dto.paidFrom,
        date: expenseDate,
        createdBy,
      },
    });

    return {
      id: expense.id,
      tenantId: expense.tenantId,
      branchId: expense.branchId,
      category: expense.category,
      description: expense.description,
      amount: this.round2(expense.amount),
      paidFrom: expense.paidFrom as 'cash_drawer' | 'bank',
      date: expense.date,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt.toISOString(),
    };
  }

  /**
   * Delete an expense
   */
  async deleteExpense(tenantSlug: string, expenseId: string) {
    const tenant = await this.getTenant(tenantSlug);

    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, tenantId: tenant.id },
    });
    if (!expense) throw new NotFoundException('Expense');

    // If paid from cash_drawer, ensure it doesn't belong to a closed session
    if (expense.paidFrom === 'cash_drawer') {
      const closedSession = await this.prisma.cashSession.findFirst({
        where: {
          tenantId: tenant.id,
          branchId: expense.branchId,
          openedAt: { lte: expense.createdAt },
          closedAt: { not: null, gte: expense.createdAt },
        },
      });

      if (closedSession) {
        throw new BadRequestException(
          "This cash expense belongs to a closed drawer and can't be deleted.",
        );
      }
    }

    await this.prisma.expense.delete({
      where: { id: expense.id },
    });

    return { ok: true, message: 'Expense deleted successfully' };
  }
}
