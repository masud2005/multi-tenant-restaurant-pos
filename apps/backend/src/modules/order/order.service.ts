import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderLineDto } from './dto/create-order-line.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import {
  KitchenStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Prisma,
  TableStatus,
} from '../../../prisma/generated/client';

export interface AuthenticatedUser {
  id: string;
  tenantId?: string;
  branchId?: string;
  role?: string;
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Round number to 2 decimal places
   */
  private round2(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  /**
   * Helper: Generate incremental daily order number (e.g. #1001, #1002)
   */
  private async generateOrderNumber(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const prisma = tx || this.prisma;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrderCount = await prisma.order.count({
      where: {
        tenantId,
        createdAt: { gte: today },
      },
    });

    return `#${1001 + todayOrderCount}`;
  }

  /**
   * Helper: Resolve tenant by either slug or id
   */
  private async resolveTenant(tenantSlugOrId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlugOrId }, { id: tenantSlugOrId }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }
    return tenant;
  }

  /**
   * Create a new order with atomic transaction, price validation & anti-tampering protection
   */
  async createOrder(
    tenantSlug: string,
    dto: CreateOrderDto,
    currentUser?: AuthenticatedUser,
  ) {
    // ১. টেন্যান্ট রিজলভ
    const tenant = await this.resolveTenant(tenantSlug);

    // ২. স্টাফ ও ব্রাঞ্চ অথেন্টিকেশন (DTO নির্ভর নয়, সেশন নির্ভর)
    const effectiveBranchId = currentUser?.branchId || dto.branchId;
    if (!effectiveBranchId) {
      throw new ForbiddenException('Staff must be assigned to an active branch.');
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: effectiveBranchId,
        tenantId: tenant.id,
        isActive: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Active branch not found for this tenant.');
    }

    // ৩. ডাইন-ইন ও ডেলিভারি স্পেসিফিক ফিল্ড ভ্যালিডেশন
    let tableName: string | null = null;
    if (dto.type === OrderType.DINE_IN) {
      if (!dto.tableId) {
        throw new BadRequestException('A valid tableId is required for Dine-In orders.');
      }

      const table = await this.prisma.diningTable.findFirst({
        where: {
          OR: [
            { id: dto.tableId },
            { name: dto.tableName || dto.tableId },
          ],
          branchId: branch.id,
          tenantId: tenant.id,
          isDeleted: false,
        },
      });

      if (!table) {
        throw new NotFoundException('Selected dining table was not found in this branch.');
      }

      // টেবিল অলরেডি অন্য রানিং অর্ডারে অকুপাইড কি না তা চেক
      if (table.status === TableStatus.OCCUPIED) {
        throw new ConflictException(`Table ${table.name} is currently occupied.`);
      }

      tableName = table.name;
      dto.tableId = table.id;
    } else if (dto.type === OrderType.DELIVERY) {
      if (!dto.deliveryAddress?.trim() || !dto.customerPhone?.trim()) {
        throw new BadRequestException(
          'Customer phone and delivery address are mandatory for delivery orders.',
        );
      }
    }

    // ৪. কাস্টমার ভ্যালিডেশন (যদি ফিল্ড থাকে)
    let customerId = dto.customerId;
    if (customerId) {
      const cust = await this.prisma.customer.findFirst({
        where: { id: customerId, tenantId: tenant.id, isDeleted: false },
      });
      if (!cust) {
        customerId = undefined; // ইনভ্যালিড ফরেন কি আটকাতে
      }
    }

    // ৫. মেন্যু আইটেম ব্যাচ ফেচ (N+1 কোয়েরি এভয়েড এবং প্রাইস ট্যাম্পারিং রোধ)
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Order must contain at least one line item.');
    }

    const targetItemIds = Array.from(
      new Set(dto.lines.map((l) => l.menuItemId || l.itemId).filter(Boolean)),
    ) as string[];

    const dbMenuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: targetItemIds },
        tenantId: tenant.id,
        available: true,
        isDeleted: false,
      },
      include: {
        variants: true,
      },
    });

    const itemMap = new Map<string, (typeof dbMenuItems)[0]>();
    for (const item of dbMenuItems) {
      itemMap.set(item.id, item);
      itemMap.set(item.name.toLowerCase().trim(), item);
    }

    // ৬. সার্ভার সাইড প্রাইস ও ফিন্যান্সিয়াল ক্যালকুলেশন
    let subtotalCents = 0;

    const validatedLines = dto.lines.map((line) => {
      const itemId = line.menuItemId || line.itemId;
      const dbItem = itemId ? itemMap.get(itemId) : itemMap.get(line.name?.toLowerCase().trim());

      if (!dbItem) {
        throw new BadRequestException(`Menu item "${line.name}" is unavailable or does not exist.`);
      }

      // ভ্যারিয়েন্ট থাকলে ভ্যারিয়েন্টের প্রাইস, নয়তো বেস আইটেমের প্রাইস
      let resolvedUnitPrice = Number(dbItem.price);
      let selectedVariantName: string | null = null;

      if (line.variantId) {
        const variant = dbItem.variants.find((v) => v.id === line.variantId);
        if (!variant) {
          throw new BadRequestException(`Invalid variant selected for ${dbItem.name}.`);
        }
        resolvedUnitPrice =
          (variant as any).price !== undefined
            ? Number((variant as any).price)
            : Number(dbItem.price) + Number(variant.priceDelta || 0);
        selectedVariantName = variant.name;
      }

      // মডিফায়ার কস্ট
      const modifiersCost = (line.modifiers || []).reduce(
        (sum, mod) => sum + Number(mod.price || 0),
        0,
      );

      const lineTotal = (resolvedUnitPrice + modifiersCost) * Number(line.qty);
      subtotalCents += Math.round(lineTotal * 100);

      return {
        menuItemId: dbItem.id,
        name: dbItem.name,
        variantId: line.variantId || null,
        variantName: selectedVariantName || line.variantName || null,
        qty: Number(line.qty),
        unitPrice: resolvedUnitPrice,
        notes: line.notes?.trim() || '',
        modifiers: line.modifiers?.length
          ? {
              create: line.modifiers.map((m) => ({
                groupId: m.groupId || null,
                optionId: m.optionId || null,
                name: m.name,
                price: Number(m.price || 0),
              })),
            }
          : undefined,
      };
    });

    const subtotal = subtotalCents / 100;

    // ৭. ডিসকাউন্ট ভ্যালিডেশন
    let discountAmount = 0;
    if (dto.discount && dto.discount.value > 0) {
      discountAmount =
        dto.discount.kind === 'percent'
          ? (subtotal * Math.min(Number(dto.discount.value), 100)) / 100
          : Number(dto.discount.value);
    }
    discountAmount = Math.min(this.round2(discountAmount), subtotal);

    const netAmount = this.round2(subtotal - discountAmount);

    // ৮. সার্ভিস চার্জ ও ট্যাক্স
    const serviceCharge =
      dto.type === OrderType.DINE_IN
        ? this.round2(netAmount * Number(tenant.serviceChargeRate || 0))
        : 0;

    const tax = this.round2(
      (netAmount + serviceCharge) * Number(tenant.taxRate || 0),
    );

    const grandTotal = this.round2(netAmount + serviceCharge + tax);

    // ৯. সম্পূর্ণ অ্যাটমিক ট্রানজ্যাকশন (ডাটাবেজ কনসিস্টেন্সি ও সেফটি নিশ্চিত করতে)
    return await this.prisma.$transaction(async (tx) => {
      // ট্রানজ্যাকশনের ভেতর সিকুয়েন্সিয়াল অর্ডার নাম্বার জেনারেশন
      const orderNumber = await this.generateOrderNumber(tenant.id, tx);

      // A. অর্ডার এবং নেস্টেড লাইন আইটেমস তৈরি
      const createdOrder = await tx.order.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          orderNumber,
          type: dto.type,
          tableId: dto.tableId || null,
          tableName: tableName || null,
          customerId: customerId || null,
          customerName: dto.customerName?.trim() || '',
          customerPhone: dto.customerPhone?.trim() || '',
          deliveryAddress: dto.deliveryAddress?.trim() || null,
          notes: dto.notes?.trim() || '',
          createdBy: currentUser?.id || dto.createdBy?.trim() || 'Staff',
          status: OrderStatus.IN_KITCHEN,
          kitchenStatus: KitchenStatus.NEW,
          subtotal,
          discount: discountAmount,
          discountKind: dto.discount?.kind || null,
          discountReason: dto.discount?.reason || null,
          promoCode: dto.discount?.promoCode || null,
          serviceCharge,
          tax,
          total: grandTotal,
          paid: dto.payment ? Number(dto.payment.amount) : 0.0,

          lines: {
            create: validatedLines,
          },

          payments: dto.payment
            ? {
                create: {
                  method: dto.payment.method,
                  amount: Number(dto.payment.amount),
                  tendered: Number(dto.payment.tendered ?? dto.payment.amount),
                  change: Number(dto.payment.change ?? 0),
                  reference: dto.payment.reference?.trim() || '',
                },
              }
            : undefined,
        },
        include: {
          lines: {
            include: {
              modifiers: true,
            },
          },
          payments: true,
          table: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // B. ডাইন-ইন হলে একই ট্রানজ্যাকশনে টেবিল স্টেট আপডেট
      if (dto.type === OrderType.DINE_IN && dto.tableId) {
        await tx.diningTable.update({
          where: { id: dto.tableId },
          data: {
            status: TableStatus.OCCUPIED,
            currentOrderId: createdOrder.id,
          },
        });
      }

      return createdOrder;
    });
  }

  /**
   * Get all orders with flexible filters (branch, status, kitchenStatus, type, search, date)
   */
  async getOrders(tenantSlug: string, query?: GetOrdersQueryDto) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Build where filter
    const where: Prisma.OrderWhereInput = {
      tenantId: tenant.id,
    };

    if (query?.branchId) {
      where.branchId = query.branchId;
    }

    // 3. Status handling (active, all, in_kitchen, ready, served, completed, cancelled)
    if (query?.status) {
      const s = query.status.toLowerCase().trim();
      if (s === 'active') {
        // "active" orders for POS & Floor management
        where.status = {
          in: [OrderStatus.IN_KITCHEN, OrderStatus.READY, OrderStatus.SERVED],
        };
      } else if (s !== 'all') {
        // Map string to OrderStatus enum (case-insensitive & handles hyphen/underscore)
        const upper = s.toUpperCase().replace('-', '_');
        if (Object.values(OrderStatus).includes(upper as OrderStatus)) {
          where.status = upper as OrderStatus;
        }
      }
    }

    // 4. Kitchen status handling (NEW, PREPARING, READY, BUMPED)
    if (query?.kitchenStatus) {
      const ks = query.kitchenStatus.toUpperCase().replace('-', '_');
      if (Object.values(KitchenStatus).includes(ks as KitchenStatus)) {
        where.kitchenStatus = ks as KitchenStatus;
      }
    }

    // 5. Order Type handling (DINE_IN, TAKEAWAY, PICKUP, COUNTER, DELIVERY)
    if (query?.type) {
      const ot = query.type.toUpperCase().replace('-', '_');
      if (Object.values(OrderType).includes(ot as OrderType)) {
        where.type = ot as OrderType;
      }
    }

    // 6. Dining Table filter
    if (query?.tableId) {
      where.tableId = query.tableId;
    }

    // 7. Search query across order number, customer name, customer phone, table name
    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { customerName: { contains: term, mode: 'insensitive' } },
        { customerPhone: { contains: term, mode: 'insensitive' } },
        { tableName: { contains: term, mode: 'insensitive' } },
      ];
    }

    // 8. Date range filters
    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // 9. Fetch orders with all necessary relations ordered newest to oldest
    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query?.limit ? Number(query.limit) : undefined,
      include: {
        lines: {
          include: {
            modifiers: true,
          },
        },
        payments: true,
        refunds: true,
        table: {
          select: {
            id: true,
            name: true,
            area: true,
            seats: true,
            status: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return orders;
  }

  /**
   * Get single order by ID with complete details
   */
  async getOrderById(tenantSlug: string, orderId: string) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Fetch order with lines, modifiers, payments, refunds and table
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: orderId },
          { orderNumber: orderId },
        ],
        tenantId: tenant.id,
      },
      include: {
        lines: {
          include: {
            modifiers: true,
          },
        },
        payments: true,
        refunds: true,
        table: {
          select: {
            id: true,
            name: true,
            area: true,
            seats: true,
            status: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order');
    }

    return order;
  }

  /**
   * Add new items/lines to an existing active order (Running Order / Add-on)
   */
  async addOrderLines(
    tenantSlug: string,
    orderId: string,
    newLines: CreateOrderLineDto[],
  ) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Fetch existing order
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: tenant.id,
      },
      include: {
        lines: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order');
    }

    if (
      existingOrder.status === OrderStatus.COMPLETED ||
      existingOrder.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot add items to a completed or cancelled order',
      );
    }

    if (!newLines || newLines.length === 0) {
      throw new BadRequestException('At least one line item is required');
    }

    // 3. Compute cost of new lines
    const addedSubtotal = this.round2(
      newLines.reduce((total, line) => {
        const modifiersCost = (line.modifiers || []).reduce(
          (mSum, m) => mSum + Number(m.price || 0),
          0,
        );
        return (
          total +
          (Number(line.unitPrice) + modifiersCost) * Number(line.qty)
        );
      }, 0),
    );

    const newSubtotal = this.round2(existingOrder.subtotal + addedSubtotal);

    let discountAmount = existingOrder.discount;
    discountAmount = this.round2(Math.min(discountAmount, newSubtotal));

    const netAmount = newSubtotal - discountAmount;
    const serviceCharge =
      existingOrder.type === OrderType.DINE_IN
        ? this.round2(netAmount * (tenant.serviceChargeRate || 0))
        : 0;

    const tax = this.round2(
      (netAmount + serviceCharge) * (tenant.taxRate || 0),
    );

    const grandTotal = this.round2(netAmount + serviceCharge + tax);

    // Validate menuItem IDs to prevent FK violations
    const addedMenuItemIds = newLines
      .map((l) => l.menuItemId || l.itemId)
      .filter((id): id is string => Boolean(id));
    const validAddedMenuItems = addedMenuItemIds.length
      ? await this.prisma.menuItem.findMany({
          where: { id: { in: addedMenuItemIds }, tenantId: tenant.id },
          select: { id: true },
        })
      : [];
    const validAddedMenuItemSet = new Set(validAddedMenuItems.map((m) => m.id));

    // 4. Save new lines and update order totals in a transaction
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Create new lines and their modifiers
      for (const line of newLines) {
        const rawItemId = line.menuItemId || line.itemId;
        const validItemId = rawItemId && validAddedMenuItemSet.has(rawItemId) ? rawItemId : null;
        await tx.orderLine.create({
          data: {
            orderId: existingOrder.id,
            menuItemId: validItemId,
            name: line.name,
            variantId: line.variantId || null,
            variantName: line.variantName || null,
            qty: line.qty,
            unitPrice: line.unitPrice,
            notes: line.notes || '',
            modifiers: line.modifiers?.length
              ? {
                  create: line.modifiers.map((m) => ({
                    groupId: m.groupId || null,
                    optionId: m.optionId || null,
                    name: m.name,
                    price: m.price,
                  })),
                }
              : undefined,
          },
        });
      }

      // Update Order totals and set kitchenStatus to NEW
      return tx.order.update({
        where: { id: existingOrder.id },
        data: {
          subtotal: newSubtotal,
          discount: discountAmount,
          serviceCharge,
          tax,
          total: grandTotal,
          kitchenStatus: KitchenStatus.NEW,
          sentToKitchenAt: new Date(),
        },
        include: {
          lines: {
            include: {
              modifiers: true,
            },
          },
          payments: true,
          refunds: true,
          table: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    return updatedOrder;
  }

  /**
   * Advance kitchen ticket status (NEW -> PREPARING -> READY -> BUMPED)
   * or set to a specific kitchen status if targetStatus is provided
   */
  async advanceKitchenStatus(
    tenantSlug: string,
    orderId: string,
    targetStatus?: KitchenStatus,
  ) {
    const tenant = await this.resolveTenant(tenantSlug);

    const order = await this.prisma.order.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { id: orderId },
          { orderNumber: orderId },
          { orderNumber: `#${orderId.replace(/^#/, '')}` },
        ],
      },
    });
    if (!order) throw new NotFoundException('Order');

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update status of a cancelled order');
    }

    const KITCHEN_FLOW: Record<KitchenStatus, KitchenStatus | null> = {
      [KitchenStatus.NEW]: KitchenStatus.PREPARING,
      [KitchenStatus.PREPARING]: KitchenStatus.READY,
      [KitchenStatus.READY]: KitchenStatus.BUMPED,
      [KitchenStatus.BUMPED]: null,
    };

    const nextStatus = targetStatus || KITCHEN_FLOW[order.kitchenStatus];
    if (!nextStatus) {
      throw new BadRequestException('Kitchen ticket already bumped');
    }

    const updateData: Prisma.OrderUpdateInput = {
      kitchenStatus: nextStatus,
    };

    if (nextStatus === KitchenStatus.READY) {
      updateData.readyAt = new Date();
      if (order.status === OrderStatus.IN_KITCHEN) {
        updateData.status = OrderStatus.READY;
      }
    }

    return this.prisma.order.update({
      where: { id: order.id },
      data: updateData,
      include: {
        lines: { include: { modifiers: true } },
        table: true,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Mark order as SERVED (Food delivered to table by waiter)
   */
  async markOrderServed(tenantSlug: string, orderId: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const order = await this.prisma.order.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { id: orderId },
          { orderNumber: orderId },
          { orderNumber: `#${orderId.replace(/^#/, '')}` },
        ],
      },
    });
    if (!order) throw new NotFoundException('Order');

    const updateData: Prisma.OrderUpdateInput = {
      status: OrderStatus.SERVED,
    };

    if (order.kitchenStatus === KitchenStatus.READY) {
      updateData.kitchenStatus = KitchenStatus.BUMPED;
    }

    if (order.paid >= order.total && order.total > 0) {
      updateData.status = OrderStatus.COMPLETED;
      updateData.completedAt = new Date();

      if (order.tableId) {
        await this.prisma.diningTable.update({
          where: { id: order.tableId },
          data: {
            status: TableStatus.CLEANING,
            currentOrderId: null,
          },
        });
      }
    }

    return this.prisma.order.update({
      where: { id: order.id },
      data: updateData,
      include: {
        lines: { include: { modifiers: true } },
        table: true,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Record a payment on an existing order (Take payment / Split payment)
   */
  async addPayment(
    tenantSlug: string,
    orderId: string,
    dto: CreateOrderPaymentDto,
  ) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Fetch order
    const order = await this.prisma.order.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { id: orderId },
          { orderNumber: orderId },
          { orderNumber: `#${orderId.replace(/^#/, '')}` },
        ],
      },
      include: {
        payments: true,
      },
    });
    if (!order) throw new NotFoundException('Order');

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot add payment to a cancelled order');
    }

    const due = this.round2(Math.max(0, order.total - order.paid));
    if (due <= 0.004) {
      throw new BadRequestException('Order is already fully paid');
    }

    const amount = this.round2(Math.min(dto.amount, due));
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    let tendered = dto.tendered ? this.round2(dto.tendered) : amount;
    let change = 0;

    if (dto.method === PaymentMethod.CASH) {
      if (tendered < amount) {
        throw new BadRequestException('Tendered cash is less than payment amount');
      }
      change = dto.change !== undefined ? this.round2(dto.change) : this.round2(tendered - amount);
    } else {
      tendered = amount;
      change = 0;
    }

    // 3. Atomic transaction: create payment & update order paid total
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.orderPayment.create({
        data: {
          orderId: order.id,
          method: dto.method,
          amount,
          tendered,
          change,
          reference: dto.reference?.trim() || '',
        },
      });

      const newPaid = this.round2(order.paid + amount);
      const isFullyPaid = newPaid >= order.total - 0.004;

      const orderUpdateData: Prisma.OrderUpdateInput = {
        paid: newPaid,
      };

      if (isFullyPaid && order.status === OrderStatus.SERVED) {
        orderUpdateData.status = OrderStatus.COMPLETED;
        orderUpdateData.completedAt = new Date();

        if (order.tableId) {
          await tx.diningTable.update({
            where: { id: order.tableId },
            data: {
              status: TableStatus.CLEANING,
              currentOrderId: null,
            },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: orderUpdateData,
        include: {
          lines: { include: { modifiers: true } },
          payments: true,
          refunds: true,
          table: true,
          branch: { select: { id: true, name: true } },
        },
      });

      return {
        payment,
        order: updatedOrder,
      };
    });

    return result;
  }
}
