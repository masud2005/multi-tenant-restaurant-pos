import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
import {
  KitchenStatus,
  OrderStatus,
  TableStatus,
} from '../../../prisma/generated/client';
import { NotFoundException } from '../../common/exceptions/business.exception';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockPrisma: any;

  const mockTenant = {
    id: 't_saffron',
    slug: 'saffron-ember',
    name: 'Saffron & Ember',
  };

  const mockBranch = {
    id: 'b_se_gulshan',
    tenantId: 't_saffron',
    name: 'Gulshan',
  };

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: vi.fn(),
      },
      branch: {
        findFirst: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      diningTable: {
        count: vi.fn(),
      },
      orderLine: {
        findMany: vi.fn(),
      },
      branchStock: {
        findMany: vi.fn(),
      },
    };

    service = new DashboardService(mockPrisma);
  });

  it('should throw NotFoundException if tenant does not exist', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(null);

    await expect(
      service.getSummary('unknown-slug', { branchId: 'b_1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException if branch is specified but does not exist', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
    mockPrisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      service.getSummary(mockTenant.slug, { branchId: 'non-existent' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should calculate and return all aggregated dashboard summary metrics correctly', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
    mockPrisma.branch.findFirst.mockResolvedValue(mockBranch);

    const now = new Date();
    const todayOrder = {
      id: 'o_1',
      paid: 1500,
      total: 1500,
      createdAt: now,
    };

    // 1. Today paid orders
    mockPrisma.order.findMany
      .mockResolvedValueOnce([todayOrder, { id: 'o_2', paid: 500, total: 500, createdAt: now }]) // todayPaidOrders
      .mockResolvedValueOnce([todayOrder]) // past7DaysOrders
      .mockResolvedValueOnce([
        {
          id: 'o_1',
          tenantId: mockTenant.id,
          branchId: mockBranch.id,
          orderNumber: 'ORD-101',
          type: 'DINE_IN',
          tableId: 't_1',
          tableName: 'Table 1',
          customerId: null,
          customerName: 'Rahim',
          customerPhone: '+8801711111111',
          notes: '',
          status: OrderStatus.IN_KITCHEN,
          kitchenStatus: KitchenStatus.PREPARING,
          subtotal: 1400,
          discount: 0,
          serviceCharge: 0,
          tax: 100,
          total: 1500,
          paid: 1500,
          refunded: 0,
          deliveryAddress: null,
          deliveryStatus: null,
          riderId: null,
          riderName: null,
          dispatchedAt: null,
          deliveredAt: null,
          createdAt: now,
          sentToKitchenAt: now,
          readyAt: null,
          completedAt: null,
          lines: [
            {
              id: 'l_1',
              menuItemId: 'm_1',
              name: 'Chicken Dum Biryani',
              variantId: null,
              variantName: null,
              qty: 2,
              unitPrice: 450,
              notes: '',
              modifiers: [],
            },
          ],
          payments: [
            {
              id: 'p_1',
              method: 'CASH',
              amount: 1500,
              tendered: 1500,
              change: 0,
              reference: '',
              createdAt: now,
            },
          ],
          refunds: [],
        },
      ]); // rawRecentOrders

    // 2. Counts: activeOrders, kitchenQueue, totalTables, occupiedTables
    mockPrisma.order.count
      .mockResolvedValueOnce(3) // activeOrders
      .mockResolvedValueOnce(2); // kitchenQueue

    mockPrisma.diningTable.count
      .mockResolvedValueOnce(10) // totalTables
      .mockResolvedValueOnce(4); // occupiedTables

    // 3. Top selling lines
    mockPrisma.orderLine.findMany.mockResolvedValueOnce([
      { name: 'Chicken Dum Biryani', qty: 15, unitPrice: 450 },
      { name: 'Mutton Kacchi', qty: 20, unitPrice: 650 },
    ]);

    // 4. Low stock branch stocks
    mockPrisma.branchStock.findMany.mockResolvedValueOnce([
      {
        id: 'bs_1',
        tenantId: mockTenant.id,
        branchId: mockBranch.id,
        currentStock: 3.5,
        reorderLevel: 5.0,
        idealStock: 10.0,
        ingredient: {
          id: 'ing_1',
          tenantId: mockTenant.id,
          name: 'Basmati Rice',
          code: 'ING-RICE',
          category: 'Dry Goods',
          unit: 'kg',
          costPerUnit: 120,
        },
      },
      {
        id: 'bs_2',
        tenantId: mockTenant.id,
        branchId: mockBranch.id,
        currentStock: 15.0,
        reorderLevel: 5.0,
        idealStock: 20.0,
        ingredient: {
          id: 'ing_2',
          tenantId: mockTenant.id,
          name: 'Cooking Oil',
          code: 'ING-OIL',
          category: 'Oils',
          unit: 'L',
          costPerUnit: 180,
        },
      },
    ]);

    const result = await service.getSummary(mockTenant.slug, {
      branchId: mockBranch.id,
    });

    expect(result.todaySales).toBe(2000);
    expect(result.todayOrders).toBe(2);
    expect(result.avgTicket).toBe(1000);
    expect(result.activeOrders).toBe(3);
    expect(result.kitchenQueue).toBe(2);
    expect(result.totalTables).toBe(10);
    expect(result.occupiedTables).toBe(4);
    expect(result.salesByDay).toHaveLength(7);
    expect(result.topItems).toHaveLength(2);
    expect(result.topItems[0]?.name).toBe('Mutton Kacchi');
    expect(result.topItems[0]?.qty).toBe(20);
    expect(result.lowStock).toHaveLength(1);
    expect(result.lowStock[0]?.name).toBe('Basmati Rice');
    expect(result.lowStock[0]?.stock).toBe(3.5);
    expect(result.recentOrders).toHaveLength(1);
    expect(result.recentOrders[0]?.number).toBe('ORD-101');
  });

  it('should return 0 avgTicket when todayOrders is 0', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
    mockPrisma.branch.findFirst.mockResolvedValue(null);

    mockPrisma.order.findMany
      .mockResolvedValueOnce([]) // todayPaidOrders
      .mockResolvedValueOnce([]) // past7DaysOrders
      .mockResolvedValueOnce([]); // rawRecentOrders

    mockPrisma.order.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrisma.diningTable.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrisma.orderLine.findMany.mockResolvedValueOnce([]);
    mockPrisma.branchStock.findMany.mockResolvedValueOnce([]);

    const result = await service.getSummary(mockTenant.slug, {});

    expect(result.todaySales).toBe(0);
    expect(result.todayOrders).toBe(0);
    expect(result.avgTicket).toBe(0);
  });
});

