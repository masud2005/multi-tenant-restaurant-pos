import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { GetCustomersQueryDto } from './dto/get-customers-query.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';
import { LoyaltyTransactionType, Prisma } from '../../../prisma/generated/client';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Resolve tenant by slug or ID
   */
  private async getTenant(tenantSlug: string) {
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

  /**
   * Create a new customer for a restaurant
   */
  async createCustomer(tenantSlug: string, dto: CreateCustomerDto) {
    const tenant = await this.getTenant(tenantSlug);

    const trimmedName = dto.name.trim();
    const trimmedPhone = dto.phone.trim();

    // 1. Phone number is mandatory; check for existing customer with same phone in this restaurant
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        phone: trimmedPhone,
        isDeleted: false,
      },
    });

    if (existingCustomer) {
      throw new AlreadyExistsException(
        `Customer with phone number "${trimmedPhone}"`,
      );
    }

    // 2. If tier is provided, verify it belongs to this tenant
    if (dto.tierId) {
      const tier = await this.prisma.loyaltyTier.findFirst({
        where: {
          id: dto.tierId,
          tenantId: tenant.id,
          isActive: true,
        },
      });

      if (!tier) {
        throw new NotFoundException('Loyalty Tier');
      }
    }

    const initialPoints = dto.initialPoints && dto.initialPoints > 0 ? dto.initialPoints : 0;

    // 3. Atomically create customer and optional welcome bonus loyalty transaction
    const customer = await this.prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          tenantId: tenant.id,
          name: trimmedName,
          phone: trimmedPhone,
          address: dto.address?.trim() || '',
          notes: dto.notes?.trim() || '',
          tierId: dto.tierId || null,
          loyaltyPoints: initialPoints,
          totalSpent: 0.0,
        },
        include: {
          tier: true,
        },
      });

      if (initialPoints > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            tenantId: tenant.id,
            customerId: newCustomer.id,
            points: initialPoints,
            type: LoyaltyTransactionType.EARNED,
            reason: 'Welcome / Registration Bonus',
            balanceAfter: initialPoints,
          },
        });
      }

      return newCustomer;
    });

    return customer;
  }

  /**
   * Get all customers for a restaurant with filtering, search, and pagination
   */
  async getCustomers(tenantSlug: string, query: GetCustomersQueryDto) {
    const tenant = await this.getTenant(tenantSlug);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.tierId) {
      where.tierId = query.tierId;
    }

    if (query.name) {
      where.name = {
        contains: query.name.trim(),
        mode: 'insensitive',
      };
    }

    if (query.phone) {
      where.phone = {
        contains: query.phone.trim(),
        mode: 'insensitive',
      };
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tier: {
            select: {
              id: true,
              name: true,
              pointMultiplier: true,
              discountPercent: true,
              color: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Fast phone search for POS cashier checkout
   */
  async getCustomerByPhone(tenantSlug: string, phone: string) {
    const tenant = await this.getTenant(tenantSlug);
    const cleanPhone = phone.trim();

    const customer = await this.prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        phone: cleanPhone,
        isDeleted: false,
      },
      include: {
        tier: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with phone "${cleanPhone}"`);
    }

    return customer;
  }

  /**
   * Get customer details by ID (including recent orders and points history)
   */
  async getCustomerById(tenantSlug: string, id: string) {
    const tenant = await this.getTenant(tenantSlug);

    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        tier: true,
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            type: true,
            status: true,
            total: true,
            paid: true,
            createdAt: true,
          },
        },
        loyaltyTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer');
    }

    return customer;
  }

  /**
   * Update an existing customer profile
   */
  async updateCustomer(
    tenantSlug: string,
    id: string,
    dto: UpdateCustomerDto,
  ) {
    const tenant = await this.getTenant(tenantSlug);

    // 1. Verify customer exists
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer');
    }

    // 2. If phone is updated, check for duplicate phone
    if (dto.phone && dto.phone.trim() !== customer.phone) {
      const duplicate = await this.prisma.customer.findFirst({
        where: {
          tenantId: tenant.id,
          phone: dto.phone.trim(),
          isDeleted: false,
          NOT: { id: customer.id },
        },
      });

      if (duplicate) {
        throw new AlreadyExistsException(
          `Another customer already has phone number "${dto.phone.trim()}"`,
        );
      }
    }

    // 3. Update customer
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() : undefined,
        address: dto.address !== undefined ? dto.address.trim() : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() : undefined,
        tierId: dto.tierId !== undefined ? dto.tierId : undefined,
        loyaltyPoints: dto.loyaltyPoints !== undefined ? dto.loyaltyPoints : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
      include: {
        tier: true,
      },
    });

    return updated;
  }

  /**
   * Soft delete a customer
   */
  async deleteCustomer(tenantSlug: string, id: string) {
    const tenant = await this.getTenant(tenantSlug);

    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer');
    }

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { success: true, message: 'Customer deleted successfully' };
  }
}
