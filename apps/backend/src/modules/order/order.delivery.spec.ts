import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from './order.service';
import {
  DeliveryStatus,
  KitchenStatus,
  OrderStatus,
  OrderType,
} from '../../../prisma/generated/client';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('OrderService - Delivery Dispatch', () => {
  let orderService: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: vi.fn(),
      },
      branch: {
        findFirst: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      rider: {
        findFirst: vi.fn(),
      },
      diningTable: {
        update: vi.fn(),
      },
    };

    orderService = new OrderService(mockPrisma);
  });

  const tenant = { id: 't_saffron', slug: 'saffron-ember' };
  const baseOrder = {
    id: 'ord_1',
    orderNumber: '#1001',
    tenantId: 't_saffron',
    branchId: 'b_1',
    type: OrderType.DELIVERY,
    deliveryAddress: 'Gulshan 2, Dhaka',
    deliveryStatus: DeliveryStatus.PENDING,
    kitchenStatus: KitchenStatus.NEW,
    status: OrderStatus.IN_KITCHEN,
    total: 1000,
    paid: 1000,
  };

  describe('updateDeliveryStatus', () => {
    it('should assign a rider when status is ASSIGNED', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({ ...baseOrder });

      const rider = { id: 'rider_1', name: 'Babul Mia', tenantId: tenant.id, isDeleted: false };
      mockPrisma.rider.findFirst.mockResolvedValue(rider);

      const updated = {
        ...baseOrder,
        deliveryStatus: DeliveryStatus.ASSIGNED,
        riderId: rider.id,
        riderName: rider.name,
      };
      mockPrisma.order.update.mockResolvedValue(updated);

      const result = await orderService.updateDeliveryStatus(tenant.slug, baseOrder.id, {
        status: DeliveryStatus.ASSIGNED,
        riderId: rider.id,
      });

      expect(result.deliveryStatus).toBe(DeliveryStatus.ASSIGNED);
      expect(result.riderName).toBe('Babul Mia');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseOrder.id },
          data: expect.objectContaining({
            deliveryStatus: DeliveryStatus.ASSIGNED,
            rider: { connect: { id: rider.id } },
            riderName: 'Babul Mia',
          }),
        })
      );
    });

    it('should throw BadRequestException if assigning without riderId', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({ ...baseOrder });

      await expect(
        orderService.updateDeliveryStatus(tenant.slug, baseOrder.id, {
          status: DeliveryStatus.ASSIGNED,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if dispatching OUT before kitchen is ready', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        deliveryStatus: DeliveryStatus.ASSIGNED,
        kitchenStatus: KitchenStatus.PREPARING,
      });

      await expect(
        orderService.updateDeliveryStatus(tenant.slug, baseOrder.id, {
          status: DeliveryStatus.OUT,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should allow OUT dispatch and bump kitchen ticket if kitchenStatus is READY', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        deliveryStatus: DeliveryStatus.ASSIGNED,
        kitchenStatus: KitchenStatus.READY,
      });

      mockPrisma.order.update.mockResolvedValue({
        ...baseOrder,
        deliveryStatus: DeliveryStatus.OUT,
        kitchenStatus: KitchenStatus.BUMPED,
      });

      const result = await orderService.updateDeliveryStatus(tenant.slug, baseOrder.id, {
        status: DeliveryStatus.OUT,
      });

      expect(result.deliveryStatus).toBe(DeliveryStatus.OUT);
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryStatus: DeliveryStatus.OUT,
            kitchenStatus: KitchenStatus.BUMPED,
          }),
        })
      );
    });

    it('should mark order COMPLETED upon DELIVERED if fully paid', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        deliveryStatus: DeliveryStatus.OUT,
        status: OrderStatus.READY,
        total: 500,
        paid: 500,
      });

      mockPrisma.order.update.mockResolvedValue({
        ...baseOrder,
        deliveryStatus: DeliveryStatus.DELIVERED,
        status: OrderStatus.COMPLETED,
      });

      const result = await orderService.updateDeliveryStatus(tenant.slug, baseOrder.id, {
        status: DeliveryStatus.DELIVERED,
      });

      expect(result.deliveryStatus).toBe(DeliveryStatus.DELIVERED);
      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryStatus: DeliveryStatus.DELIVERED,
            status: OrderStatus.COMPLETED,
          }),
        })
      );
    });
  });
});

