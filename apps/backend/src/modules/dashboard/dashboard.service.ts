import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  KitchenStatus,
  OrderStatus,
  TableStatus,
} from '../../../prisma/generated/client';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { GetDashboardQueryDto } from './dto/get-dashboard-query.dto';

@Injectable()
export class DashboardService {
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

  async getSummary(tenantSlug: string, query: GetDashboardQueryDto) {
    const tenant = await this.resolveTenant(tenantSlug);
    const branch = await this.resolveBranch(tenant.id, query.branchId);

    const branchFilter = branch ? { branchId: branch.id } : {};

    // Base filter for active/valid orders (exclude cancelled)
    const nonCancelledOrdersWhere: any = {
      tenantId: tenant.id,
      ...branchFilter,
      status: { not: OrderStatus.CANCELLED },
    };

    // Time boundaries (start of today 00:00:00 local server time)
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const sevenDaysAgo = new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000);

    // 1. Today's sales and order count
    const todayPaidOrders = await this.prisma.order.findMany({
      where: {
        ...nonCancelledOrdersWhere,
        paid: { gt: 0 },
        createdAt: { gte: startOfDay },
      },
      select: {
        id: true,
        paid: true,
        total: true,
      },
    });

    const todaySales =
      Math.round(
        (todayPaidOrders || []).reduce((sum, o) => sum + (o.paid || 0), 0) * 100,
      ) / 100;
    const todayOrders = (todayPaidOrders || []).length;
    const avgTicket =
      todayOrders > 0
        ? Math.round((todaySales / todayOrders) * 100) / 100
        : 0;

    // 2. Active orders count (in kitchen, ready, served)
    const activeOrders = await this.prisma.order.count({
      where: {
        ...nonCancelledOrdersWhere,
        status: {
          in: [OrderStatus.IN_KITCHEN, OrderStatus.READY, OrderStatus.SERVED],
        },
      },
    });

    // 3. Kitchen queue count (new or preparing)
    const kitchenQueue = await this.prisma.order.count({
      where: {
        ...nonCancelledOrdersWhere,
        kitchenStatus: { in: [KitchenStatus.NEW, KitchenStatus.PREPARING] },
      },
    });

    // 4. Dining tables statistics
    const tableWhere: any = {
      tenantId: tenant.id,
      isDeleted: false,
      ...branchFilter,
    };

    const totalTables = await this.prisma.diningTable.count({
      where: tableWhere,
    });

    const occupiedTables = await this.prisma.diningTable.count({
      where: {
        ...tableWhere,
        status: TableStatus.OCCUPIED,
      },
    });

    // 5. Sales by day (Last 7 days)
    const past7DaysOrders =
      (await this.prisma.order.findMany({
        where: {
          ...nonCancelledOrdersWhere,
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          createdAt: true,
          paid: true,
        },
      })) || [];

    const salesByDay: { date: string; sales: number; orders: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const dayStart = new Date(
        startOfDay.getTime() - d * 24 * 60 * 60 * 1000,
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const inDay = past7DaysOrders.filter(
        (o) => o.createdAt >= dayStart && o.createdAt < dayEnd,
      );
      const daySales =
        Math.round(inDay.reduce((s, o) => s + (o.paid || 0), 0) * 100) / 100;

      salesByDay.push({
        date: dayStart.toISOString(),
        sales: daySales,
        orders: inDay.length,
      });
    }

    // 6. Top selling items (Last 7 days, fallback to recent if none in 7 days)
    let orderLines = await this.prisma.orderLine.findMany({
      where: {
        order: {
          ...nonCancelledOrdersWhere,
          createdAt: { gte: sevenDaysAgo },
        },
      },
      select: {
        name: true,
        qty: true,
        unitPrice: true,
      },
    });

    if (!orderLines || orderLines.length === 0) {
      orderLines =
        (await this.prisma.orderLine.findMany({
          where: {
            order: nonCancelledOrdersWhere,
          },
          select: {
            name: true,
            qty: true,
            unitPrice: true,
          },
          take: 100,
        })) || [];
    }

    const itemMap = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    for (const l of orderLines || []) {
      const existing = itemMap.get(l.name) || {
        name: l.name,
        qty: 0,
        revenue: 0,
      };
      existing.qty += l.qty;
      existing.revenue =
        Math.round((existing.revenue + l.unitPrice * l.qty) * 100) / 100;
      itemMap.set(l.name, existing);
    }

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // 7. Low stock ingredients
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

    const lowStock = branchStocks
      .filter((bs) => bs.currentStock <= bs.reorderLevel)
      .map((bs) => ({
        id: bs.ingredient.id,
        tenantId: bs.ingredient.tenantId,
        branchId: bs.branchId,
        name: bs.ingredient.name,
        code: bs.ingredient.code || '',
        category: bs.ingredient.category || '',
        unit: bs.ingredient.unit,
        costPerUnit: bs.ingredient.costPerUnit,
        stock: bs.currentStock,
        currentStock: bs.currentStock,
        reorderLevel: bs.reorderLevel,
        idealStock: bs.idealStock || 0,
      }));

    // 8. Recent orders (Last 6 orders for quick dispatch/navigation)
    const rawRecentOrders =
      (await this.prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          ...branchFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          lines: {
            include: {
              modifiers: true,
            },
          },
          payments: true,
          refunds: true,
        },
      })) || [];

    const recentOrders = rawRecentOrders.map((o) => ({
      id: o.id,
      tenantId: o.tenantId,
      branchId: o.branchId,
      number: o.orderNumber,
      orderNumber: o.orderNumber,
      type: o.type,
      tableId: o.tableId,
      tableName: o.tableName,
      customerId: o.customerId,
      customerName: o.customerName || '',
      customerPhone: o.customerPhone || '',
      notes: o.notes || '',
      status: o.status,
      kitchenStatus: o.kitchenStatus,
      subtotal: o.subtotal,
      discount: o.discount,
      serviceCharge: o.serviceCharge,
      tax: o.tax,
      total: o.total,
      paid: o.paid,
      refunded: o.refunded,
      totals: {
        subtotal: o.subtotal,
        discount: o.discount,
        serviceCharge: o.serviceCharge,
        tax: o.tax,
        total: o.total,
      },
      deliveryAddress: o.deliveryAddress,
      deliveryStatus: o.deliveryStatus,
      riderId: o.riderId,
      riderName: o.riderName,
      dispatchedAt: o.dispatchedAt ? o.dispatchedAt.toISOString() : null,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      sentToKitchenAt: o.sentToKitchenAt
        ? o.sentToKitchenAt.toISOString()
        : o.createdAt.toISOString(),
      readyAt: o.readyAt ? o.readyAt.toISOString() : null,
      completedAt: o.completedAt ? o.completedAt.toISOString() : null,
      lines: (o.lines || []).map((l) => ({
        id: l.id,
        itemId: l.menuItemId,
        name: l.name,
        variantId: l.variantId,
        variantName: l.variantName,
        qty: l.qty,
        unitPrice: l.unitPrice,
        notes: l.notes || '',
        modifiers: (l.modifiers || []).map((m) => ({
          id: m.id,
          modifierId: m.optionId || m.groupId || m.id,
          name: m.name,
          price: m.price,
        })),
      })),
      payments: (o.payments || []).map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount,
        tendered: p.tendered,
        change: p.change,
        reference: p.reference || '',
        createdAt: p.createdAt.toISOString(),
      })),
      refunds: (o.refunds || []).map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason || '',
        by: r.by || '',
        createdBy: r.by || '',
        createdAt: r.createdAt.toISOString(),
      })),
    }));

    return {
      todaySales,
      todayOrders,
      avgTicket,
      activeOrders,
      kitchenQueue,
      occupiedTables,
      totalTables,
      salesByDay,
      topItems,
      lowStock,
      recentOrders,
    };
  }
}
