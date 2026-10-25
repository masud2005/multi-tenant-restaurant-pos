import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { GetSuppliersQueryDto } from './dto/get-suppliers-query.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';
import { Prisma } from '../../../prisma/generated/client';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new supplier for a tenant
   */
  async createSupplier(tenantSlug: string, dto: CreateSupplierDto) {
    // 1. Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const trimmedName = dto.name.trim();

    // 2. Check if a non-deleted supplier with this name already exists for this tenant
    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existingSupplier) {
      throw new AlreadyExistsException('A supplier with this name');
    }

    // 3. Create the supplier
    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: trimmedName,
        contact: dto.contact?.trim() || '',
        phone: dto.phone?.trim() || '',
        email: dto.email?.trim() || '',
        address: dto.address?.trim() || '',
        supplies: dto.supplies?.trim() || '',
        paymentTerms: dto.paymentTerms?.trim() || '',
        active: dto.active !== undefined ? dto.active : true,
      },
    });

    return supplier;
  }

  /**
   * Get all suppliers for a tenant with optional filtering and search
   */
  async getSuppliers(tenantSlug: string, query?: GetSuppliersQueryDto) {
    // 1. Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Build where filter conditions
    const where: Prisma.SupplierWhereInput = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    if (query?.activeOnly !== undefined) {
      where.active = query.activeOnly;
    }

    if (query?.search?.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { contact: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { supplies: { contains: searchTerm, mode: 'insensitive' } },
        { address: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // 3. Fetch suppliers ordered by creation time descending
    const suppliers = await this.prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            goodsReceipts: true,
            supplierReturns: true,
          },
        },
      },
    });

    return suppliers;
  }

  /**
   * Get a single supplier by ID
   */
  async getSupplierById(tenantSlug: string, supplierId: string) {
    // 1. Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch specific supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            goodsReceipts: true,
            supplierReturns: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier');
    }

    return supplier;
  }

  /**
   * Update an existing supplier
   */
  async updateSupplier(
    tenantSlug: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ) {
    // 1. Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Verify supplier exists and is not deleted
    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!existingSupplier) {
      throw new NotFoundException('Supplier');
    }

    // 3. If name is being updated, verify uniqueness
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName.toLowerCase() !== existingSupplier.name.toLowerCase()) {
        const conflict = await this.prisma.supplier.findFirst({
          where: {
            tenantId: tenant.id,
            id: { not: supplierId },
            isDeleted: false,
            name: {
              equals: trimmedName,
              mode: 'insensitive',
            },
          },
        });

        if (conflict) {
          throw new AlreadyExistsException('A supplier with this name');
        }
      }
    }

    // 4. Update supplier record
    const updatedSupplier = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.contact !== undefined && { contact: dto.contact.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.email !== undefined && { email: dto.email.trim() }),
        ...(dto.address !== undefined && { address: dto.address.trim() }),
        ...(dto.supplies !== undefined && { supplies: dto.supplies.trim() }),
        ...(dto.paymentTerms !== undefined && {
          paymentTerms: dto.paymentTerms.trim(),
        }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            goodsReceipts: true,
            supplierReturns: true,
          },
        },
      },
    });

    return updatedSupplier;
  }

  /**
   * Soft-delete a supplier (sets isDeleted: true, deletedAt: now, active: false)
   */
  async deleteSupplier(tenantSlug: string, supplierId: string) {
    // 1. Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Verify supplier exists and is not deleted
    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!existingSupplier) {
      throw new NotFoundException('Supplier');
    }

    // 3. Perform soft delete
    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        active: false,
      },
    });

    return { message: 'Supplier deleted successfully' };
  }
}
