import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { GetMenuItemsQueryDto } from './dto/get-menu-items-query.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class MenuItemService {
  constructor(private readonly prisma: PrismaService) {}

  async createMenuItem(tenantSlug: string, dto: CreateMenuItemDto) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Verify category exists and belongs to this tenant
    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        tenantId: tenant.id,
      },
    });

    if (!category) {
      throw new NotFoundException('Category');
    }

    const trimmedName = dto.name.trim();

    // 3. Check duplicate item name for this tenant (case-insensitive and not deleted)
    const existingItem = await this.prisma.menuItem.findFirst({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existingItem) {
      throw new AlreadyExistsException('A menu item with this name');
    }

    // 4. Validate modifierGroupIds if provided
    if (dto.modifierGroupIds && dto.modifierGroupIds.length > 0) {
      const validGroupCount = await this.prisma.modifierGroup.count({
        where: {
          id: { in: dto.modifierGroupIds },
          tenantId: tenant.id,
          isDeleted: false,
        },
      });

      if (validGroupCount !== dto.modifierGroupIds.length) {
        throw new BadRequestException('One or more modifier groups are invalid');
      }
    }

    // 5. Validate branchIds in branchOverrides if provided
    if (dto.branchOverrides && dto.branchOverrides.length > 0) {
      const branchIds = dto.branchOverrides.map((b) => b.branchId);
      const validBranchCount = await this.prisma.branch.count({
        where: {
          id: { in: branchIds },
          tenantId: tenant.id,
        },
      });

      if (validBranchCount !== branchIds.length) {
        throw new BadRequestException('One or more branch IDs are invalid');
      }
    }

    // 6. Create menu item with nested variants and branch overrides
    const item = await this.prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        categoryId: dto.categoryId,
        name: trimmedName,
        description: dto.description?.trim() ?? '',
        price: dto.price ?? 0.0,
        available: dto.available ?? true,
        tags: dto.tags ?? [],
        modifierGroupIds: dto.modifierGroupIds ?? [],
        variants:
          dto.variants && dto.variants.length > 0
            ? {
                create: dto.variants.map((v) => ({
                  name: v.name.trim(),
                  priceDelta: v.priceDelta ?? 0.0,
                })),
              }
            : undefined,
        branchOverrides:
          dto.branchOverrides && dto.branchOverrides.length > 0
            ? {
                create: dto.branchOverrides.map((b) => ({
                  branchId: b.branchId,
                  price: b.price ?? null,
                  isAvailable: b.isAvailable ?? true,
                })),
              }
            : undefined,
      },
      include: {
        category: true,
        variants: {
          orderBy: { createdAt: 'asc' },
        },
        branchOverrides: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return item;
  }

  async getAllMenuItems(tenantSlug: string, query?: GetMenuItemsQueryDto) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Build where filter
    const where: any = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    if (query?.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query?.search) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    if (query?.available !== undefined) {
      where.available = query.available;
    }

    // 3. Fetch items with relations
    const items = await this.prisma.menuItem.findMany({
      where,
      include: {
        category: true,
        variants: {
          orderBy: { createdAt: 'asc' },
        },
        branchOverrides: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4. If branchId query is provided, compute effective price & availability
    if (query?.branchId) {
      return items.map((item) => {
        const branchOverride = item.branchOverrides.find(
          (b) => b.branchId === query.branchId,
        );

        return {
          ...item,
          effectivePrice: branchOverride?.price ?? item.price,
          effectiveAvailable: branchOverride?.isAvailable ?? item.available,
          branchOverride: branchOverride ?? null,
        };
      });
    }

    return items;
  }

  async getMenuItemById(
    tenantSlug: string,
    itemId: string,
    branchId?: string,
  ) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch specific item
    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: itemId,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        category: true,
        variants: {
          orderBy: { createdAt: 'asc' },
        },
        branchOverrides: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item');
    }

    if (branchId) {
      const branchOverride = item.branchOverrides.find(
        (b) => b.branchId === branchId,
      );

      return {
        ...item,
        effectivePrice: branchOverride?.price ?? item.price,
        effectiveAvailable: branchOverride?.isAvailable ?? item.available,
        branchOverride: branchOverride ?? null,
      };
    }

    return item;
  }

  async updateMenuItem(
    tenantSlug: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ) {
    // 1. Verify item exists in tenant and is not deleted
    const item = await this.getMenuItemById(tenantSlug, itemId);

    // 2. If categoryId is provided, verify it belongs to this tenant
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, tenantId: item.tenantId },
      });

      if (!category) {
        throw new NotFoundException('Category');
      }
    }

    // 3. If name is being changed, verify uniqueness among non-deleted items
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing = await this.prisma.menuItem.findFirst({
        where: {
          tenantId: item.tenantId,
          isDeleted: false,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
          id: { not: itemId },
        },
      });

      if (existing) {
        throw new AlreadyExistsException('A menu item with this name');
      }
    }

    // 4. Validate modifierGroupIds if provided
    if (dto.modifierGroupIds && dto.modifierGroupIds.length > 0) {
      const validGroupCount = await this.prisma.modifierGroup.count({
        where: {
          id: { in: dto.modifierGroupIds },
          tenantId: item.tenantId,
          isDeleted: false,
        },
      });

      if (validGroupCount !== dto.modifierGroupIds.length) {
        throw new BadRequestException('One or more modifier groups are invalid');
      }
    }

    // 5. Validate branchIds in branchOverrides if provided
    if (dto.branchOverrides && dto.branchOverrides.length > 0) {
      const branchIds = dto.branchOverrides.map((b) => b.branchId);
      const validBranchCount = await this.prisma.branch.count({
        where: {
          id: { in: branchIds },
          tenantId: item.tenantId,
        },
      });

      if (validBranchCount !== branchIds.length) {
        throw new BadRequestException('One or more branch IDs are invalid');
      }
    }

    // 6. Atomically update item, variants, and branch overrides
    return this.prisma.$transaction(async (tx) => {
      if (dto.variants !== undefined) {
        await tx.menuItemVariant.deleteMany({
          where: { menuItemId: itemId },
        });

        if (dto.variants.length > 0) {
          await tx.menuItemVariant.createMany({
            data: dto.variants.map((v) => ({
              menuItemId: itemId,
              name: v.name.trim(),
              priceDelta: v.priceDelta ?? 0.0,
            })),
          });
        }
      }

      if (dto.branchOverrides !== undefined) {
        await tx.branchMenuItemOverride.deleteMany({
          where: { menuItemId: itemId },
        });

        if (dto.branchOverrides.length > 0) {
          await tx.branchMenuItemOverride.createMany({
            data: dto.branchOverrides.map((b) => ({
              branchId: b.branchId,
              menuItemId: itemId,
              price: b.price ?? null,
              isAvailable: b.isAvailable ?? true,
            })),
          });
        }
      }

      return tx.menuItem.update({
        where: { id: itemId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && {
            description: dto.description.trim(),
          }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.available !== undefined && { available: dto.available }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.modifierGroupIds !== undefined && {
            modifierGroupIds: dto.modifierGroupIds,
          }),
        },
        include: {
          category: true,
          variants: {
            orderBy: { createdAt: 'asc' },
          },
          branchOverrides: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async deleteMenuItem(tenantSlug: string, itemId: string) {
    // 1. Verify item exists in tenant and is not deleted
    await this.getMenuItemById(tenantSlug, itemId);

    // 2. Soft delete menu item
    await this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        available: false,
      },
    });

    return { message: 'Menu item deleted successfully' };
  }

  async toggleMenuItemAvailability(
    tenantSlug: string,
    itemId: string,
    available: boolean,
  ) {
    // 1. Verify item exists in tenant and is not deleted
    await this.getMenuItemById(tenantSlug, itemId);

    // 2. Update availability
    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: { available },
      include: {
        category: true,
        variants: {
          orderBy: { createdAt: 'asc' },
        },
        branchOverrides: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Fetches the complete POS menu bundle (categories, available items,
   * modifier groups, and combos) in a single optimized query.
   */
  async getPosMenuBundle(tenantSlug: string, branchId?: string) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch categories, items, modifiers, and combos in parallel
    const [categories, items, modifierGroups, combos] = await Promise.all([
      // Categories sorted by sort order
      this.prisma.category.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
        },
        orderBy: { sort: 'asc' },
      }),

      // Active menu items with size variants & branch price overrides
      this.prisma.menuItem.findMany({
        where: {
          tenantId: tenant.id,
          isDeleted: false,
          available: true,
        },
        include: {
          variants: {
            orderBy: { createdAt: 'asc' },
          },
          branchOverrides: branchId
            ? {
                where: { branchId },
              }
            : true,
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Modifier groups (toppings / options) with active options
      this.prisma.modifierGroup.findMany({
        where: {
          tenantId: tenant.id,
          isDeleted: false,
          isActive: true,
        },
        include: {
          options: {
            where: { isDeleted: false, isActive: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Combos with constituent menu items
      this.prisma.combo.findMany({
        where: {
          tenantId: tenant.id,
          isDeleted: false,
          available: true,
        },
        include: {
          items: {
            include: {
              menuItem: {
                select: { id: true, name: true, price: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // 3. Compute effective price and availability if branchId is specified
    const formattedItems = items
      .map((item) => {
        if (!branchId) return item;
        const branchOverride = item.branchOverrides.find(
          (b) => b.branchId === branchId,
        );
        return {
          ...item,
          price: branchOverride?.price ?? item.price,
          available: branchOverride?.isAvailable ?? item.available,
          branchOverride: branchOverride ?? null,
        };
      })
      .filter((item) => item.available);

    return {
      categories,
      items: formattedItems,
      modifierGroups,
      combos,
    };
  }
}

