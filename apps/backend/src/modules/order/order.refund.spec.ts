import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from './order.service';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  LoyaltyTransactionType,
} from '../../../prisma/generated/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('OrderService - Order Refunds', () => {
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
      orderRefund: {
        create: vi.fn(),
      },
      loyaltySettings: {
        findUnique: vi.fn(),
      },
      customer: {
        update: vi.fn(),
      },
      loyaltyTransaction: {
        create: vi.fn(),
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
    status: OrderStatus.COMPLETED,
    total: 1000,
    paid: 1000,
    refunded: 0,
    payments: [
      { id: 'p_1', method: PaymentMethod.CARD, amount: 600 },
      { id: 'p_2', method: PaymentMethod.CASH, amount: 400 },
    ],
    refunds: [],
    customer: { id: 'c_1', name: 'Rahim', loyaltyPoints: 20 },
    customerId: 'c_1',
  };

  describe('refundOrder', () => {
    it('throws NotFoundException if order does not exist', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        orderService.refundOrder(tenant.slug, 'ord_missing', {
          amount: 500,
          method: PaymentMethod.CARD,
          reason: 'Customer complaint',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if nothing left to refund', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        refunded: 1000,
      });

      await expect(
        orderService.refundOrder(tenant.slug, baseOrder.id, {
          amount: 100,
          method: PaymentMethod.CARD,
          reason: 'Customer complaint',
        })
      ).rejects.toThrow(/Nothing left to refund/);
    });

    it('throws BadRequestException if refund amount exceeds refundable balance', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        paid: 800,
        refunded: 200,
      });

      await expect(
        orderService.refundOrder(tenant.slug, baseOrder.id, {
          amount: 700,
          method: PaymentMethod.CARD,
          reason: 'Customer complaint',
        })
      ).rejects.toThrow(/Refund amount exceeds refundable balance/);
    });

    it('throws BadRequestException if method was not used on the order', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        payments: [{ id: 'p_1', method: PaymentMethod.CASH, amount: 1000 }],
      });

      await expect(
        orderService.refundOrder(tenant.slug, baseOrder.id, {
          amount: 500,
          method: PaymentMethod.CARD,
          reason: 'Return',
        })
      ).rejects.toThrow(/Refund method CARD was not used to pay/);
    });

    it('successfully processes full refund and updates order refunded amount', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({ ...baseOrder });

      const createdRefund = {
        id: 'ref_1',
        orderId: baseOrder.id,
        amount: 600,
        method: PaymentMethod.CARD,
        reason: 'Dish returned',
        by: 'Manager John',
      };
      mockPrisma.orderRefund.create.mockResolvedValue(createdRefund);

      const updatedOrder = {
        ...baseOrder,
        refunded: 600,
      };
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      mockPrisma.loyaltySettings.findUnique.mockResolvedValue({
        spendAmountPerPoint: 100,
      });

      const result = await orderService.refundOrder(
        tenant.slug,
        baseOrder.id,
        {
          amount: 600,
          method: PaymentMethod.CARD,
          reason: 'Dish returned',
          by: 'Manager John',
        },
        { fullName: 'Manager John' }
      );

      expect(mockPrisma.orderRefund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: baseOrder.id,
          amount: 600,
          method: PaymentMethod.CARD,
          reason: 'Dish returned',
          by: 'Manager John',
        }),
      });

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: baseOrder.id },
        data: { refunded: 600 },
        include: expect.any(Object),
      });

      // 600 / 100 = 6 points deducted from customer
      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c_1' },
        data: { loyaltyPoints: 14 },
      });

      expect(mockPrisma.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: tenant.id,
          customerId: 'c_1',
          orderId: baseOrder.id,
          points: -6,
          type: LoyaltyTransactionType.REFUNDED,
        }),
      });

      expect(result.refund).toEqual(createdRefund);
      expect(result.order).toEqual(updatedOrder);
    });
  });
});
