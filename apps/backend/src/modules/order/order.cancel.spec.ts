import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from './order.service';
import {
  OrderStatus,
  OrderType,
  TableStatus,
} from '../../../prisma/generated/client';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('OrderService - Order Cancel / Void', () => {
  let orderService: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      diningTable: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    orderService = new OrderService(mockPrisma);
  });

  const tenant = { id: 't_saffron', slug: 'saffron-ember' };
  const baseOrder = {
    id: 'ord_1',
    orderNumber: '#1001',
    tenantId: 't_saffron',
    branchId: 'b_1',
    type: OrderType.DINE_IN,
    status: OrderStatus.IN_KITCHEN,
    tableId: 'tbl_1',
    notes: 'Mild spicy',
    total: 1000,
    paid: 0,
    refunded: 0,
  };

  describe('cancelOrder', () => {
    it('throws NotFoundException if order does not exist', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        orderService.cancelOrder(tenant.slug, 'ord_missing', {
          reason: 'Customer left',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if order is completed', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.COMPLETED,
      });

      await expect(
        orderService.cancelOrder(tenant.slug, baseOrder.id, {
          reason: 'Customer left',
        })
      ).rejects.toThrow(/Completed orders cannot be voided/);
    });

    it('throws BadRequestException if order is already cancelled', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.CANCELLED,
      });

      await expect(
        orderService.cancelOrder(tenant.slug, baseOrder.id, {
          reason: 'Customer left',
        })
      ).rejects.toThrow(/Order is already cancelled/);
    });

    it('throws ConflictException if unrefunded payments remain on the order', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        paid: 500,
        refunded: 0,
      });

      await expect(
        orderService.cancelOrder(tenant.slug, baseOrder.id, {
          reason: 'Customer left',
        })
      ).rejects.toThrow(/Refund all payments before voiding/);
    });

    it('successfully cancels active unpaid order and releases occupied dining table', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        tableId: 'tbl_1',
      });

      mockPrisma.diningTable.findUnique.mockResolvedValue({
        id: 'tbl_1',
        status: TableStatus.OCCUPIED,
        currentOrderId: baseOrder.id,
      });

      const updatedOrder = {
        ...baseOrder,
        status: OrderStatus.CANCELLED,
        notes: 'Mild spicy\nVoided: Customer cancelled food',
      };
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      const result = await orderService.cancelOrder(tenant.slug, baseOrder.id, {
        reason: 'Customer cancelled food',
      });

      expect(mockPrisma.diningTable.update).toHaveBeenCalledWith({
        where: { id: 'tbl_1' },
        data: {
          status: TableStatus.AVAILABLE,
          currentOrderId: null,
        },
      });

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: baseOrder.id },
        data: {
          status: OrderStatus.CANCELLED,
          notes: 'Mild spicy\nVoided: Customer cancelled food',
        },
        include: expect.any(Object),
      });

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('successfully cancels fully refunded order', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        paid: 500,
        refunded: 500,
        tableId: null,
      });

      const updatedOrder = {
        ...baseOrder,
        status: OrderStatus.CANCELLED,
        notes: 'Mild spicy\nVoided: Fully refunded and voided',
      };
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      const result = await orderService.cancelOrder(tenant.slug, baseOrder.id, {
        reason: 'Fully refunded and voided',
      });

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });
});

