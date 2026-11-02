import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportService } from './report.service';
import {
  KitchenStatus,
  MovementReason,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from '../../../prisma/generated/client';
import { NotFoundException } from '../../common/exceptions/business.exception';

describe('ReportService', () => {
  let service: ReportService;
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
      branchStock: {
        findMany: vi.fn(),
      },
      stockMovement: {
        findMany: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
      },
      diningTable: {
        findMany: vi.fn(),
      },
      staffMember: {
        findMany: vi.fn(),
      },
    };

    service = new ReportService(mockPrisma);
  });

  describe('getInventoryReport', () => {
    it('should throw NotFoundException if tenant is not found', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.getInventoryReport('unknown-slug', { branchId: 'b_1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate inventory valuation and low stock accurately', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.branch.findFirst.mockResolvedValue(mockBranch);

      mockPrisma.branchStock.findMany.mockResolvedValue([
        {
          id: 'bs_1',
          branchId: mockBranch.id,
          currentStock: 10,
          reorderLevel: 5,
          unitCost: 100,
          ingredient: {
            id: 'ing_1',
            name: 'Basmati Rice',
            unit: 'kg',
            costPerUnit: 100,
          },
        },
        {
          id: 'bs_2',
          branchId: mockBranch.id,
          currentStock: 2,
          reorderLevel: 5,
          unitCost: 200,
          ingredient: {
            id: 'ing_2',
            name: 'Ghee',
            unit: 'kg',
            costPerUnit: 200,
          },
        },
      ]);

      mockPrisma.stockMovement.findMany.mockResolvedValue([
        {
          id: 'm_1',
          ingredientId: 'ing_2',
          quantity: -1,
          reason: MovementReason.WASTE,
          ingredient: { costPerUnit: 200, name: 'Ghee' },
        },
      ]);

      const result = await service.getInventoryReport(mockTenant.slug, {
        branchId: mockBranch.id,
      });

      expect(result.totalValuation).toBe(10 * 100 + 2 * 200); // 1400
      expect(result.totalItems).toBe(2);
      expect(result.lowStockCount).toBe(1);
      expect(result.lowStockList).toHaveLength(1);
      expect(result.lowStockList[0]?.name).toBe('Ghee');
      expect(result.wastageCost).toBe(200);
      expect(result.topMovements).toHaveLength(1);
      expect(result.topMovements[0]?.reason).toBe('waste');
    });
  });

  describe('getOperationsReport', () => {
    it('should calculate operations breakdown, kitchen bumps, and table turnover', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.branch.findFirst.mockResolvedValue(mockBranch);

      const now = new Date();
      const readyAt = new Date(now.getTime() + 15 * 60000);

      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'o_1',
          type: OrderType.DINE_IN,
          status: OrderStatus.SERVED,
          kitchenStatus: KitchenStatus.READY,
          tableId: 'tbl_1',
          total: 1200,
          sentToKitchenAt: now,
          readyAt,
          completedAt: null,
        },
        {
          id: 'o_2',
          type: OrderType.DELIVERY,
          status: OrderStatus.IN_KITCHEN,
          kitchenStatus: KitchenStatus.NEW,
          tableId: null,
          total: 800,
          sentToKitchenAt: now,
          readyAt: null,
          completedAt: null,
        },
      ]);

      mockPrisma.diningTable.findMany.mockResolvedValue([
        {
          id: 'tbl_1',
          name: 'Table 1',
        },
      ]);

      mockPrisma.staffMember.findMany.mockResolvedValue([
        {
          id: 'staff_1',
          name: 'Karim',
        },
      ]);

      const result = await service.getOperationsReport(mockTenant.slug, {
        branchId: mockBranch.id,
        range: '7d',
      });

      expect(result.ordersByStatus.find((s) => s.status === 'served')?.count).toBe(1);
      expect(result.ordersByStatus.find((s) => s.status === 'in_kitchen')?.count).toBe(1);
      expect(result.ordersByType.find((t) => t.type === 'dine_in')?.count).toBe(1);
      expect(result.kitchenBumpsCount).toBe(1);
      expect(result.avgPrepTimeMinutes).toBe(15);
      expect(result.tableTurnover[0]?.orderCount).toBe(1);
      expect(result.tableTurnover[0]?.totalRevenue).toBe(1200);
      expect(result.staffShiftsSummary[0]?.name).toBe('Karim');
    });
  });

  describe('getSalesReport', () => {
    it('should aggregate revenue, order volume, and category distribution', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.branch.findFirst.mockResolvedValue(mockBranch);

      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'o_1',
          total: 1000,
          refunded: 0,
          lines: [
            {
              name: 'Kacchi Biryani',
              qty: 2,
              unitPrice: 500,
              menuItem: { category: { name: 'Main Course' } },
            },
          ],
        },
      ]);

      const result = await service.getSalesReport(mockTenant.slug, {
        branchId: mockBranch.id,
        range: '7d',
      });

      expect(result.totalRevenue).toBe(1000);
      expect(result.netSales).toBe(1000);
      expect(result.totalOrders).toBe(1);
      expect(result.avgOrderValue).toBe(1000);
      expect(result.topItems[0]?.name).toBe('Kacchi Biryani');
      expect(result.salesByCategory[0]?.category).toBe('Main Course');
    });
  });

  describe('getFinancialReport', () => {
    it('should aggregate gross sales, taxes, discounts, and payment methods', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.branch.findFirst.mockResolvedValue(mockBranch);

      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'o_1',
          total: 1100,
          discount: 100,
          tax: 100,
          serviceCharge: 50,
          refunded: 0,
          payments: [
            { method: PaymentMethod.CASH, amount: 1100 },
          ],
        },
      ]);

      const result = await service.getFinancialReport(mockTenant.slug, {
        branchId: mockBranch.id,
        range: 'today',
      });

      expect(result.grossSales).toBe(1100);
      expect(result.discounts).toBe(100);
      expect(result.taxes).toBe(100);
      expect(result.netRevenue).toBe(1100);
      expect(result.byPaymentMethod.find((m) => m.method === 'cash')?.total).toBe(1100);
    });
  });
});

