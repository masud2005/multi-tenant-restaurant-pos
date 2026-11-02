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
    // ১টি মাত্র কুয়েরিতে টেন্যান্ট ভেরিফিকেশন এবং সফট ডিলিট একসাথে
    const result = await this.prisma.category.updateMany({
      where: {
        id: categoryId,
        tenant: {
          slug: tenantSlug, // নিশ্চিত করা যে ক্যাটাগরি কেবল এই টেন্যান্টেরই
        },
        isActive: true, // অলরেডি ডিলিট হয়ে থাকলে অপ্রয়োজনীয় রাইট আটকাবে
      },
      data: {
        isActive: false,
      },
    });

    // যদি কোনো রো আপডেট না হয়, তার মানে ক্যাটাগরি নেই অথবা অন্য টেন্যান্টের
    if (result.count === 0) {
      throw new NotFoundException('Category not found or access denied');
    }

    return { message: 'Category deleted successfully' };
  }

  async moveCategory(tenantSlug: string, categoryId: string, dir: -1 | 1) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch all active categories for this tenant in current sort order
    const categories = await this.prisma.category.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });

    // 3. Find target category index
    const currentIndex = categories.findIndex((c) => c.id === categoryId);
    if (currentIndex === -1) {
      const exists = await this.prisma.category.findFirst({
        where: { id: categoryId, tenantId: tenant.id },
      });
      if (!exists) {
        throw new NotFoundException('Category');
      }
      return categories;
    }

    const targetIndex = currentIndex + dir;
    // Boundary check: cannot move beyond the ends of the list
    if (targetIndex < 0 || targetIndex >= categories.length) {
      return categories;
    }

    // 4. Swap positions in array
    const reordered = [...categories];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // 5. Persist normalized sort orders in a transaction
    await this.prisma.$transaction(
      reordered.map((cat, idx) =>
        this.prisma.category.update({
          where: { id: cat.id },
          data: { sort: idx },
        }),
      ),
    );

    // 6. Return updated categories
    return this.prisma.category.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { sort: 'asc' },
    });
  }

  async reorderCategories(tenantSlug: string, categoryIds: string[]) {
    // 1. Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Persist sort orders
    await this.prisma.$transaction(
      categoryIds.map((id, index) =>
        this.prisma.category.updateMany({
          where: { id, tenantId: tenant.id },
          data: { sort: index },
        }),
      ),
    );

    return this.prisma.category.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { sort: 'asc' },
    });
  }
}
