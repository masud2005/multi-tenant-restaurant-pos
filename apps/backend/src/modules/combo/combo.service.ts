import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class ComboService {
  constructor(private readonly prisma: PrismaService) {}

  async createCombo(tenantSlug: string, dto: CreateComboDto) {
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

    // 2. Check if a non-deleted combo with same name exists for this tenant
    const existing = await this.prisma.combo.findFirst({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new AlreadyExistsException('A combo with this name');
    }

    // 3. Process items / components array
    const rawItems = dto.items ?? dto.components ?? [];
    const itemMap = new Map<string, number>();

    for (const item of rawItems) {
      const itemId = item.itemId.trim();
      const qty = item.quantity ?? item.qty ?? 1;
      if (qty <= 0) {
        throw new BadRequestException('Item quantity must be at least 1');
      }
      itemMap.set(itemId, (itemMap.get(itemId) ?? 0) + qty);
    }

    const normalizedItems = Array.from(itemMap.entries()).map(
      ([menuItemId, quantity]) => ({
        menuItemId,
        quantity,
      }),
    );

    // 4. Create combo with items
    const combo = await this.prisma.combo.create({
      data: {
        tenantId: tenant.id,
        name: trimmedName,
        description: dto.description?.trim() ?? '',
        price: dto.price ?? 0.0,
        available: dto.available ?? true,
        items:
          normalizedItems.length > 0
            ? {
                create: normalizedItems,
              }
            : undefined,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return {
      ...combo,
      components: combo.items.map((it) => ({
        itemId: it.menuItemId,
        qty: it.quantity,
      })),
    };
  }

  async getAllCombos(tenantSlug: string) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch all non-deleted combos with items
    const combos = await this.prisma.combo.findMany({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return combos.map((combo) => ({
      ...combo,
      components: combo.items.map((it) => ({
        itemId: it.menuItemId,
        qty: it.quantity,
      })),
    }));
  }

  async getComboById(tenantSlug: string, comboId: string) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch specific non-deleted combo with items
    const combo = await this.prisma.combo.findFirst({
      where: {
        id: comboId,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!combo) {
      throw new NotFoundException('Combo');
    }

    return {
      ...combo,
      components: combo.items.map((it) => ({
        itemId: it.menuItemId,
        qty: it.quantity,
      })),
    };
  }

  async updateCombo(tenantSlug: string, comboId: string, dto: UpdateComboDto) {
    // 1. Verify combo exists in tenant and is not deleted
    const combo = await this.getComboById(tenantSlug, comboId);

    // 2. If name is being changed, verify uniqueness among non-deleted combos
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing = await this.prisma.combo.findFirst({
        where: {
          tenantId: combo.tenantId,
          isDeleted: false,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
          id: { not: comboId },
        },
      });

      if (existing) {
        throw new AlreadyExistsException('A combo with this name');
      }
    }

    // 3. Atomically update combo and optionally replace items
    return this.prisma.$transaction(async (tx) => {
      const rawItems = dto.items ?? dto.components;

      if (rawItems !== undefined) {
        await tx.comboItem.deleteMany({
          where: { comboId },
        });

        const itemMap = new Map<string, number>();
        for (const item of rawItems) {
          const itemId = item.itemId.trim();
          const qty = item.quantity ?? item.qty ?? 1;
          if (qty <= 0) {
            throw new BadRequestException('Item quantity must be at least 1');
          }
          itemMap.set(itemId, (itemMap.get(itemId) ?? 0) + qty);
        }

        const normalizedItems = Array.from(itemMap.entries()).map(
          ([menuItemId, quantity]) => ({
            comboId,
            menuItemId,
            quantity,
          }),
        );

        if (normalizedItems.length > 0) {
          await tx.comboItem.createMany({
            data: normalizedItems,
          });
        }
      }

      const updatedCombo = await tx.combo.update({
        where: { id: comboId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && {
            description: dto.description.trim(),
          }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.available !== undefined && { available: dto.available }),
        },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return {
        ...updatedCombo,
        components: updatedCombo.items.map((it) => ({
          itemId: it.menuItemId,
          qty: it.quantity,
        })),
      };
    });
  }

  async deleteCombo(tenantSlug: string, comboId: string) {
    // 1. Verify combo exists in tenant and is not deleted
    await this.getComboById(tenantSlug, comboId);

    // 2. Soft delete combo
    await this.prisma.combo.update({
      where: { id: comboId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        available: false,
      },
    });

    return { message: 'Combo deleted successfully' };
  }
}

