import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateModifierGroupDto } from './dto/create-modifier-group.dto';
import { CreateModifierOptionDto } from './dto/create-modifier-option.dto';
import { UpdateModifierGroupDto } from './dto/update-modifier-group.dto';
import { UpdateModifierOptionDto } from './dto/update-modifier-option.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class ModifierGroupService {
  constructor(private readonly prisma: PrismaService) {}

  async createModifierGroup(tenantSlug: string, dto: CreateModifierGroupDto) {
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

    // 2. Check if active/non-deleted group with same name exists for this tenant (case-insensitive)
    const existingGroup = await this.prisma.modifierGroup.findFirst({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existingGroup) {
      throw new AlreadyExistsException('A modifier group with this name');
    }

    // 3. Validate min/max constraints
    const min = dto.min ?? 0;
    const max = dto.max ?? 1;

    if (min > max) {
      throw new BadRequestException(
        'Minimum selections cannot exceed maximum selections',
      );
    }

    if (dto.options && dto.options.length > 0 && max > dto.options.length) {
      throw new BadRequestException(
        'Maximum selections cannot exceed the number of available options',
      );
    }

    const isRequired = min > 0;

    // 4. Create modifier group with options
    const group = await this.prisma.modifierGroup.create({
      data: {
        tenantId: tenant.id,
        name: trimmedName,
        min,
        max,
        isRequired,
        options:
          dto.options && dto.options.length > 0
            ? {
                create: dto.options.map((opt) => ({
                  name: opt.name.trim(),
                  price: opt.price ?? 0.0,
                })),
              }
            : undefined,
      },
      include: {
        options: true,
      },
    });

    return group;
  }

  async getAllModifierGroups(tenantSlug: string) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch all non-deleted modifier groups with options
    return this.prisma.modifierGroup.findMany({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        options: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getModifierGroupById(tenantSlug: string, groupId: string) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch specific modifier group with options (must not be deleted)
    const group = await this.prisma.modifierGroup.findFirst({
      where: {
        id: groupId,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        options: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Modifier group');
    }

    return group;
  }

  async updateModifierGroup(
    tenantSlug: string,
    groupId: string,
    dto: UpdateModifierGroupDto,
  ) {
    // 1. Verify group exists in tenant and is not deleted
    const group = await this.getModifierGroupById(tenantSlug, groupId);

    // 2. If name is being changed, verify uniqueness among non-deleted groups
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existingGroup = await this.prisma.modifierGroup.findFirst({
        where: {
          tenantId: group.tenantId,
          isDeleted: false,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
          id: { not: groupId },
        },
      });

      if (existingGroup) {
        throw new AlreadyExistsException('A modifier group with this name');
      }
    }

    // 3. Validate min/max constraints
    const newMin = dto.min !== undefined ? dto.min : group.min;
    const newMax = dto.max !== undefined ? dto.max : group.max;

    if (newMin > newMax) {
      throw new BadRequestException(
        'Minimum selections cannot exceed maximum selections',
      );
    }

    if (dto.options && dto.options.length > 0 && newMax > dto.options.length) {
      throw new BadRequestException(
        'Maximum selections cannot exceed the number of available options',
      );
    }

    const isRequired = newMin > 0;

    // 4. Update group and options atomically
    return this.prisma.$transaction(async (tx) => {
      if (dto.options !== undefined) {
        // Replace existing options with new options array
        await tx.modifierOption.deleteMany({
          where: { groupId },
        });

        if (dto.options.length > 0) {
          await tx.modifierOption.createMany({
            data: dto.options.map((opt) => ({
              groupId,
              name: opt.name.trim(),
              price: opt.price ?? 0.0,
            })),
          });
        }
      }

      return tx.modifierGroup.update({
        where: { id: groupId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.min !== undefined && { min: dto.min }),
          ...(dto.max !== undefined && { max: dto.max }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          isRequired,
        },
        include: {
          options: {
            where: { isDeleted: false },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
  }

  async deleteModifierGroup(tenantSlug: string, groupId: string) {
    // 1. Verify group exists in tenant and is not deleted
    await this.getModifierGroupById(tenantSlug, groupId);

    // 2. Soft delete modifier group and options
    await this.prisma.$transaction([
      this.prisma.modifierOption.updateMany({
        where: { groupId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false,
        },
      }),
      this.prisma.modifierGroup.update({
        where: { id: groupId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false,
        },
      }),
    ]);

    return { message: 'Modifier group deleted successfully' };
  }

  async createModifierOption(
    tenantSlug: string,
    groupId: string,
    dto: CreateModifierOptionDto,
  ) {
    // 1. Verify group exists in tenant and is not deleted
    const group = await this.getModifierGroupById(tenantSlug, groupId);

    const trimmedName = dto.name.trim();

    // 2. Check if active/non-deleted option with same name already exists in this group (case-insensitive)
    const existingOption = await this.prisma.modifierOption.findFirst({
      where: {
        groupId: group.id,
        isDeleted: false,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existingOption) {
      throw new AlreadyExistsException(
        'A modifier option with this name in this group',
      );
    }

    // 3. Create modifier option
    const option = await this.prisma.modifierOption.create({
      data: {
        groupId: group.id,
        name: trimmedName,
        price: dto.price ?? 0.0,
      },
    });

    return option;
  }

  async getAllModifierOptions(tenantSlug: string, groupId: string) {
    // 1. Verify group exists in tenant and is not deleted
    await this.getModifierGroupById(tenantSlug, groupId);

    // 2. Fetch all non-deleted options for this group
    return this.prisma.modifierOption.findMany({
      where: {
        groupId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getModifierOptionById(
    tenantSlug: string,
    groupId: string,
    optionId: string,
  ) {
    // 1. Verify group exists in tenant and is not deleted
    await this.getModifierGroupById(tenantSlug, groupId);

    // 2. Fetch specific non-deleted option
    const option = await this.prisma.modifierOption.findFirst({
      where: {
        id: optionId,
        groupId,
        isDeleted: false,
      },
    });

    if (!option) {
      throw new NotFoundException('Modifier option');
    }

    return option;
  }

  async updateModifierOption(
    tenantSlug: string,
    groupId: string,
    optionId: string,
    dto: UpdateModifierOptionDto,
  ) {
    // 1. Verify option exists in group and is not deleted
    await this.getModifierOptionById(tenantSlug, groupId, optionId);

    // 2. If name is being changed, verify uniqueness among non-deleted options in this group
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existingOption = await this.prisma.modifierOption.findFirst({
        where: {
          groupId,
          isDeleted: false,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
          id: { not: optionId },
        },
      });

      if (existingOption) {
        throw new AlreadyExistsException(
          'A modifier option with this name in this group',
        );
      }
    }

    // 3. Update modifier option
    return this.prisma.modifierOption.update({
      where: { id: optionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteModifierOption(
    tenantSlug: string,
    groupId: string,
    optionId: string,
  ) {
    // 1. Verify option exists in group and is not deleted
    await this.getModifierOptionById(tenantSlug, groupId, optionId);

    // 2. Soft delete modifier option
    await this.prisma.modifierOption.update({
      where: { id: optionId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return { message: 'Modifier option deleted successfully' };
  }
}



