import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(tenantSlug: string, dto: CreateCategoryDto) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const trimmedName = dto.name.trim();

    // 2. Check if category with this name already exists for this tenant (case-insensitive)
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        tenantId: tenant.id,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existingCategory) {
      throw new AlreadyExistsException('A category with this name');
    }

    // 3. Auto-calculate sort order if not provided (append to end of list)
    let sortOrder = dto.sort;
    if (sortOrder === undefined || sortOrder === null) {
      sortOrder = await this.prisma.category.count({
        where: { tenantId: tenant.id },
      });
    }

    // 4. Create category
    const category = await this.prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: trimmedName,
        description: dto.description?.trim() || '',
        sort: sortOrder,
        isActive: true,
      },
    });

    return category;
  }

  async getAllCategories(tenantSlug: string, activeOnly: boolean = true) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch categories ordered by sort position
    return this.prisma.category.findMany({
      where: {
        tenantId: tenant.id,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { sort: 'asc' },
    });
  }

  async getCategoryById(tenantSlug: string, categoryId: string) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch specific category
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: tenant.id,
      },
    });

    if (!category) {
      throw new NotFoundException('Category');
    }

    return category;
  }

  async updateCategory(
    tenantSlug: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    // 1. Verify category exists for this tenant
    const category = await this.getCategoryById(tenantSlug, categoryId);

    // 2. If name is being changed, verify uniqueness
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          tenantId: category.tenantId,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
          id: { not: categoryId },
        },
      });

      if (existingCategory) {
        throw new AlreadyExistsException('A category with this name');
      }
    }

    // 3. Update category
    const updatedCategory = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.sort !== undefined && { sort: dto.sort }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return updatedCategory;
  }

  async deleteCategory(tenantSlug: string, categoryId: string) {
    // 1. Verify category exists for this tenant
    await this.getCategoryById(tenantSlug, categoryId);

    // 2. Soft delete category (set isActive to false to preserve historical records)
    await this.prisma.category.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    return { message: 'Category deleted successfully' };
  }
}
