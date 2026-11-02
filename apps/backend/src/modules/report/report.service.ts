import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  KitchenStatus,
  MovementReason,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from '../../../prisma/generated/client';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { GetReportQueryDto } from './dto/get-report-query.dto';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTenant(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    return tenant;
  }

  private async resolveBranch(tenantId: string, branchId?: string) {
    if (!branchId || branchId === 'all') {
      return null;
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        tenantId,
        OR: [{ id: branchId }, { name: branchId }],
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch');
    }

    return branch;
  }

  private resolveDateRange(range?: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    if (range === 'today') {
      return { start: todayStart, end: todayEnd, daysCount: 1 };
    } else if (range === '30d') {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 29,
        0,
        0,
        0,
        0,
      );
      return { start, end: todayEnd, daysCount: 30 };
    } else {
      // Default: 7d
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6,
        0,
        0,
        0,
        0,
      );
      return { start, end: todayEnd, daysCount: 7 };
    }
  }

  // ==================== 1. Inventory Valuation Report ====================

  async getInventoryReport(tenantSlug: string, query: GetReportQueryDto) {
    const tenant = await this.resolveTenant(tenantSlug);
    const branch = await this.resolveBranch(tenant.id, query.branchId);

    const branchFilter = branch ? { branchId: branch.id } : {};

    const branchStocks =
      (await this.prisma.branchStock.findMany({
        where: {
          tenantId: tenant.id,
          ...branchFilter,
        },
        include: {
          ingredient: true,
        },
      })) || [];

    const totalValuation = Math.round(
      branchStocks.reduce(
        (sum, bs) =>
          sum +
          bs.currentStock *
            (bs.unitCost || bs.ingredient?.costPerUnit || 0),
        0,
      ),
    );

    const totalItems = branchStocks.length;

    const lowStockList = branchStocks
      .filter((bs) => bs.currentStock <= bs.reorderLevel)
      .map((bs) => ({
        id: bs.ingredient.id,
        name: bs.ingredient.name,
        unit: bs.ingredient.unit,
        stock: bs.currentStock,
        reorderLevel: bs.reorderLevel,
        unitCost: bs.unitCost || bs.ingredient.costPerUnit || 0,
      }));

    const lowStockCount = lowStockList.length;

    // Wastage and recent stock movements
    const movements =
      (await this.prisma.stockMovement.findMany({
        where: {
          tenantId: tenant.id,
          ...branchFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          ingredient: true,
        },
      })) || [];

    const wastageCost = Math.round(
      movements
        .filter((m) => m.reason === MovementReason.WASTE)
        .reduce((sum, m) => {
          const cost = m.ingredient?.costPerUnit || 0;
          return sum + Math.abs(m.quantity) * cost;
        }, 0),
    );

    const topMovements = movements.slice(0, 8).map((m) => ({
      ingredientId: m.ingredientId,
      name: m.ingredient?.name || m.ingredientId,
      qty: m.quantity,
      reason: m.reason.toLowerCase(),
    }));

    return {
      totalValuation,
      totalItems,
      lowStockCount,
      wastageCost,
      lowStockList,
      topMovements,
    };
  }

  // ==================== 2. Operations Status Report ====================

  async getOperationsReport(tenantSlug: string, query: GetReportQueryDto) {
    const tenant = await this.resolveTenant(tenantSlug);
    const branch = await this.resolveBranch(tenant.id, query.branchId);
    const { start } = this.resolveDateRange(query.range);

    const branchFilter = branch ? { branchId: branch.id } : {};

    const orders =
      (await this.prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          ...branchFilter,
          createdAt: { gte: start },
        },
      })) || [];

    const statusMapping: Record<string, OrderStatus> = {
      in_kitchen: OrderStatus.IN_KITCHEN,
      ready: OrderStatus.READY,
      served: OrderStatus.SERVED,
      completed: OrderStatus.COMPLETED,
      cancelled: OrderStatus.CANCELLED,
    };

    const ordersByStatus = (
      ['in_kitchen', 'ready', 'served', 'completed', 'cancelled'] as const
    ).map((status) => ({
      status,
      count: orders.filter((o) => o.status === statusMapping[status]).length,
    }));

    const orderTypeMap = new Map<string, { count: number; revenue: number }>();
    for (const o of orders) {
      const typeStr = o.type.toLowerCase();
      const existing = orderTypeMap.get(typeStr) || { count: 0, revenue: 0 };
      existing.count += 1;
      if (o.status !== OrderStatus.CANCELLED) {
        existing.revenue =
          Math.round((existing.revenue + (o.total || 0)) * 100) / 100;
      }
      orderTypeMap.set(typeStr, existing);
    }

    const ordersByType = Array.from(orderTypeMap.entries()).map(
      ([type, stats]) => ({
        type: type as OrderType,
        count: stats.count,
        revenue: stats.revenue,
      }),
    );

    const kitchenBumpsCount = orders.filter(
      (o) =>
        o.kitchenStatus === KitchenStatus.READY ||
        o.kitchenStatus === KitchenStatus.BUMPED,
    ).length;

    // Average prep / fulfillment time in minutes
    const completedOrdersWithTimes = orders.filter(
      (o) => o.sentToKitchenAt && (o.readyAt || o.completedAt),
    );
    let avgPrepTimeMinutes = 14.5;
    if (completedOrdersWithTimes.length > 0) {
      const totalMinutes = completedOrdersWithTimes.reduce((sum, o) => {
        const end = (o.readyAt || o.completedAt)!.getTime();
        const start = o.sentToKitchenAt.getTime();
        const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
        return sum + diffMinutes;
      }, 0);
      avgPrepTimeMinutes =
        Math.round((totalMinutes / completedOrdersWithTimes.length) * 10) / 10;
    }

    // Table turnover stats
    const tables =
      (await this.prisma.diningTable.findMany({
        where: {
          tenantId: tenant.id,
          isDeleted: false,
          ...branchFilter,
        },
      })) || [];

    const tableTurnover = tables.map((t) => {
      const tableOrders = orders.filter((o) => o.tableId === t.id);
      return {
        tableId: t.id,
        name: t.name,
        orderCount: tableOrders.length,
        totalRevenue:
          Math.round(
            tableOrders.reduce((sum, o) => sum + (o.total || 0), 0) * 100,
          ) / 100,
      };
    });

    // Staff roster summary
    const staffMembers =
      (await this.prisma.staffMember.findMany({
        where: {
          tenantId: tenant.id,
          isDeleted: false,
        },
        select: {
          id: true,
          name: true,
        },
      })) || [];

    const staffShiftsSummary = staffMembers.map((s) => ({
      staffId: s.id,
      name: s.name,
      shiftsCount: 0,
      totalHours: 0,
    }));

    return {
      avgPrepTimeMinutes,
      ordersByStatus,
      ordersByType,
      kitchenBumpsCount,
      tableTurnover,
      staffShiftsSummary,
    };
  }

  // ==================== 3. Sales Analytics Report ====================

  async getSalesReport(tenantSlug: string, query: GetReportQueryDto) {
    const tenant = await this.resolveTenant(tenantSlug);
    const branch = await this.resolveBranch(tenant.id, query.branchId);
    const { start } = this.resolveDateRange(query.range);

    const branchFilter = branch ? { branchId: branch.id } : {};

    const orders =
      (await this.prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          ...branchFilter,
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: start },
        },
        include: {
          lines: {
            include: {
              menuItem: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      })) || [];

    const totalRevenue = Math.round(
      orders.reduce((sum, o) => sum + (o.total || 0), 0),
    );
    const totalRefunds = Math.round(
      orders.reduce((sum, o) => sum + (o.refunded || 0), 0),
    );
    const netSales = Math.max(0, totalRevenue - totalRefunds);
    const totalOrders = orders.length;
    const avgOrderValue =
      totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Item sales aggregation
    const itemMap = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    const categoryMap = new Map<string, { count: number; revenue: number }>();

    for (const o of orders) {
      for (const line of o.lines || []) {
        const existingItem = itemMap.get(line.name) || {
          name: line.name,
          qty: 0,
          revenue: 0,
        };
        existingItem.qty += line.qty;
        existingItem.revenue =
          Math.round(
            (existingItem.revenue + line.unitPrice * line.qty) * 100,
          ) / 100;
        itemMap.set(line.name, existingItem);

        const catName = line.menuItem?.category?.name || 'Uncategorized';
        const existingCat = categoryMap.get(catName) || {
          count: 0,
          revenue: 0,
        };
        existingCat.count += line.qty;
        existingCat.revenue =
          Math.round(
            (existingCat.revenue + line.unitPrice * line.qty) * 100,
          ) / 100;
        categoryMap.set(catName, existingCat);
      }
    }

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const totalCatRevenue = Array.from(categoryMap.values()).reduce(
      (sum, c) => sum + c.revenue,
      0,
    );
    const salesByCategory = Array.from(categoryMap.entries()).map(
      ([category, val]) => ({
        category,
        count: val.count,
        revenue: val.revenue,
        percentage:
          totalCatRevenue > 0
            ? Math.round((val.revenue / totalCatRevenue) * 1000) / 10
            : 0,
      }),
    );

    return {
      totalRevenue,
      netSales,
      totalOrders,
      avgOrderValue,
      metrics: {
        totalRevenue,
        netSales,
        totalOrders,
        avgOrderValue,
      },
      topItems,
      salesByCategory,
    };
  }

  // ==================== 4. Financial Analytics Report ====================

  async getFinancialReport(tenantSlug: string, query: GetReportQueryDto) {
    const tenant = await this.resolveTenant(tenantSlug);
    const branch = await this.resolveBranch(tenant.id, query.branchId);
    const { start } = this.resolveDateRange(query.range);

    const branchFilter = branch ? { branchId: branch.id } : {};

    const orders =
      (await this.prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          ...branchFilter,
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: start },
        },
        include: {
          payments: true,
        },
      })) || [];

    const grossSales = Math.round(
      orders.reduce((sum, o) => sum + (o.total || 0), 0),
    );
    const discounts = Math.round(
      orders.reduce((sum, o) => sum + (o.discount || 0), 0),
    );
    const taxes = Math.round(
      orders.reduce((sum, o) => sum + (o.tax || 0), 0),
    );
    const serviceCharges = Math.round(
      orders.reduce((sum, o) => sum + (o.serviceCharge || 0), 0),
    );
    const refunds = Math.round(
      orders.reduce((sum, o) => sum + (o.refunded || 0), 0),
    );
    const netRevenue = Math.max(0, grossSales - refunds);
    const expensesTotal = 0; // Expenses table integration placeholder
    const netProfit = netRevenue - expensesTotal;

    // Breakdown by payment method
    const paymentMap = new Map<
      PaymentMethod,
      { count: number; total: number }
    >();
    for (const o of orders) {
      const orderPayments =
        o.payments && o.payments.length > 0
          ? o.payments
          : [{ method: PaymentMethod.CASH, amount: o.total }];

      for (const p of orderPayments) {
        const method = p.method || PaymentMethod.CASH;
        const existing = paymentMap.get(method) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total = Math.round((existing.total + (p.amount || 0)) * 100) / 100;
        paymentMap.set(method, existing);
      }
    }

    const byPaymentMethod = [
      PaymentMethod.CASH,
      PaymentMethod.CARD,
      PaymentMethod.MOBILE,
    ].map((method) => {
      const data = paymentMap.get(method) || { count: 0, total: 0 };
      return {
        method: method.toLowerCase() as any,
        count: data.count,
        total: data.total,
      };
    });

    return {
      grossSales,
      discounts,
      taxes,
      serviceCharges,
      refunds,
      netRevenue,
      expensesTotal,
      netProfit,
      byPaymentMethod,
    };
  }
}

