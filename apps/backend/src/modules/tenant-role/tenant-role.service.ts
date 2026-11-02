import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { CustomRole, UserRole } from '../../../prisma/generated/client';
import {
  ConflictException,
  NotFoundException,
} from '../../common/exceptions/business.exception';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { CreateCustomRoleDto } from './dto/create-custom-role.dto';
import { UpdateCustomRoleDto } from './dto/update-custom-role.dto';

const STANDARD_ROLE_NAMES = ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER'];

@Injectable()
export class TenantRoleService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTenant(tenantSlug: string) {
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

  private formatCustomRole(role: CustomRole) {
    return {
      id: role.id,
      name: role.name,
      description: role.description || '',
      color: role.color || 'purple',
      baseRole: role.baseRole.toLowerCase(),
      permissions: role.permissions,
      isCustom: true as const,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  async getTenantRoles(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        roles: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // If no roles exist yet for this tenant in DB, auto-populate with sensible defaults
    if (!tenant.roles || tenant.roles.length === 0) {
      const rolesToCreate = Object.entries(DEFAULT_ROLE_PERMISSIONS).map(
        ([role, permissions]) => ({
          tenantId: tenant.id,
          role: role as UserRole,
          permissions: permissions as string[],
        }),
      );

      await this.prisma.tenantRole.createMany({
        data: rolesToCreate,
      });

      return this.prisma.tenantRole.findMany({
        where: { tenantId: tenant.id },
        select: {
          id: true,
          role: true,
          permissions: true,
          updatedAt: true,
        },
        orderBy: { role: 'asc' },
      });
    }

    return tenant.roles.map((r) => ({
      id: r.id,
      role: r.role,
      permissions: r.permissions,
      updatedAt: r.updatedAt,
    }));
  }

  async updateRolePermissions(
    tenantSlug: string,
    roleParam: string,
    dto: UpdateRolePermissionsDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const roleUpper = roleParam.toUpperCase() as UserRole;
    if (!Object.values(UserRole).includes(roleUpper)) {
      throw new BadRequestException(
        `Invalid role: "${roleParam}". Allowed roles are: ${Object.values(UserRole).join(', ')}`,
      );
    }

    // Upsert role permissions for this tenant
    const updated = await this.prisma.tenantRole.upsert({
      where: {
        tenantId_role: {
          tenantId: tenant.id,
          role: roleUpper,
        },
      },
      update: {
        permissions: dto.permissions,
      },
      create: {
        tenantId: tenant.id,
        role: roleUpper,
        permissions: dto.permissions,
      },
    });

    return {
      id: updated.id,
      role: updated.role,
      permissions: updated.permissions,
      updatedAt: updated.updatedAt,
    };
  }

  // ==================== Custom Roles Management ====================

  async getCustomRoles(tenantSlug: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const roles = await this.prisma.customRole.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'asc' },
    });

    return roles.map((r) => this.formatCustomRole(r));
  }

  async getCustomRoleById(tenantSlug: string, id: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const role = await this.prisma.customRole.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!role) {
      throw new NotFoundException('Custom role');
    }

    return this.formatCustomRole(role);
  }

  async createCustomRole(tenantSlug: string, dto: CreateCustomRoleDto) {
    const tenant = await this.resolveTenant(tenantSlug);
    const trimmedName = dto.name.trim();

    if (STANDARD_ROLE_NAMES.includes(trimmedName.toUpperCase())) {
      throw new BadRequestException(
        `"${trimmedName}" is a reserved system role name. Please choose a different name.`,
      );
    }

    const existing = await this.prisma.customRole.findFirst({
      where: {
        tenantId: tenant.id,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`A role named "${trimmedName}" already exists.`);
    }

    const baseRole = dto.baseRole || UserRole.CASHIER;

    // Use default permissions of baseRole if permissions array not explicitly provided
    const permissions =
      dto.permissions !== undefined
        ? dto.permissions
        : (DEFAULT_ROLE_PERMISSIONS[baseRole] || []).map(String);

    const created = await this.prisma.customRole.create({
      data: {
        tenantId: tenant.id,
        name: trimmedName,
        description: dto.description?.trim() || '',
        color: dto.color || 'purple',
        baseRole,
        permissions,
      },
    });

    return this.formatCustomRole(created);
  }

  async updateCustomRole(
    tenantSlug: string,
    id: string,
    dto: UpdateCustomRoleDto,
  ) {
    const tenant = await this.resolveTenant(tenantSlug);

    const existing = await this.prisma.customRole.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!existing) {
      throw new NotFoundException('Custom role');
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (STANDARD_ROLE_NAMES.includes(trimmedName.toUpperCase())) {
        throw new BadRequestException(
          `"${trimmedName}" is a reserved system role name.`,
        );
      }

      const duplicate = await this.prisma.customRole.findFirst({
        where: {
          tenantId: tenant.id,
          name: { equals: trimmedName, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(`A role named "${trimmedName}" already exists.`);
      }
    }

    const updated = await this.prisma.customRole.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || '' }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.baseRole !== undefined && { baseRole: dto.baseRole }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
    });

    // If role name changed, update staff members assigned to this custom role
    if (dto.name !== undefined && dto.name.trim() !== existing.name) {
      await this.prisma.staffMember.updateMany({
        where: { customRoleId: id },
        data: { customRoleName: dto.name.trim() },
      });
    }

    return this.formatCustomRole(updated);
  }

  async updateCustomRolePermissions(
    tenantSlug: string,
    id: string,
    permissions: string[],
  ) {
    const tenant = await this.resolveTenant(tenantSlug);

    const existing = await this.prisma.customRole.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!existing) {
      throw new NotFoundException('Custom role');
    }

    const updated = await this.prisma.customRole.update({
      where: { id },
      data: { permissions },
    });

    return this.formatCustomRole(updated);
  }

  async deleteCustomRole(tenantSlug: string, id: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const existing = await this.prisma.customRole.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!existing) {
      throw new NotFoundException('Custom role');
    }

    // Detach role from all staff members before deletion
    await this.prisma.staffMember.updateMany({
      where: { customRoleId: id },
      data: {
        customRoleId: null,
        customRoleName: null,
      },
    });

    await this.prisma.customRole.delete({
      where: { id },
    });

    return {
      success: true,
      message: `Custom role "${existing.name}" deleted successfully`,
    };
  }
}
