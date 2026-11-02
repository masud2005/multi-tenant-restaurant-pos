import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantRoleService } from './tenant-role.service';
import { UserRole } from '../../../prisma/generated/client';
import {
  BadRequestException,
} from '@nestjs/common';
import {
  ConflictException,
  NotFoundException,
} from '../../common/exceptions/business.exception';

describe('TenantRoleService - Custom Roles', () => {
  let service: TenantRoleService;
  let mockPrisma: any;

  const mockTenant = {
    id: 'tenant-123',
    slug: 'sultans-dine',
    name: "Sultan's Dine",
  };

  const now = new Date('2026-11-02T10:00:00.000Z');

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      tenantRole: {
        createMany: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      customRole: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      staffMember: {
        updateMany: vi.fn(),
      },
    };

    service = new TenantRoleService(mockPrisma);
  });

  describe('getCustomRoles', () => {
    it('should return list of formatted custom roles for a tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.customRole.findMany.mockResolvedValue([
        {
          id: 'crole-1',
          tenantId: mockTenant.id,
          name: 'Head Sommelier',
          description: 'Cellar manager',
          color: 'indigo',
          baseRole: UserRole.WAITER,
          permissions: ['pos.use', 'tables.view'],
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.getCustomRoles(mockTenant.slug);

      expect(result).toEqual([
        {
          id: 'crole-1',
          name: 'Head Sommelier',
          description: 'Cellar manager',
          color: 'indigo',
          baseRole: 'waiter',
          permissions: ['pos.use', 'tables.view'],
          isCustom: true,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ]);
    });
  });

  describe('createCustomRole', () => {
    it('should successfully create a new custom role', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.customRole.findFirst.mockResolvedValue(null);
      mockPrisma.customRole.create.mockResolvedValue({
        id: 'crole-new',
        tenantId: mockTenant.id,
        name: 'Shift Lead',
        description: 'Supervises evening shifts',
        color: 'sky',
        baseRole: UserRole.CASHIER,
        permissions: ['pos.use', 'cash.manage'],
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.createCustomRole(mockTenant.slug, {
        name: '  Shift Lead  ',
        description: 'Supervises evening shifts',
        color: 'sky',
        baseRole: UserRole.CASHIER,
        permissions: ['pos.use', 'cash.manage'],
      });

      expect(result.id).toBe('crole-new');
      expect(result.name).toBe('Shift Lead');
      expect(result.baseRole).toBe('cashier');
      expect(mockPrisma.customRole.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenant.id,
          name: 'Shift Lead',
          description: 'Supervises evening shifts',
          color: 'sky',
          baseRole: UserRole.CASHIER,
          permissions: ['pos.use', 'cash.manage'],
        },
      });
    });

    it('should throw BadRequestException if role name is reserved system role', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

      await expect(
        service.createCustomRole(mockTenant.slug, {
          name: 'Manager',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if duplicate custom role name exists', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.customRole.findFirst.mockResolvedValue({
        id: 'existing-id',
        name: 'Floor Captain',
      });

      await expect(
        service.createCustomRole(mockTenant.slug, {
          name: 'Floor Captain',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateCustomRole', () => {
    it('should update role fields and sync staff member names if name changed', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.customRole.findFirst
        .mockResolvedValueOnce({
          id: 'crole-1',
          tenantId: mockTenant.id,
          name: 'Old Name',
        })
        .mockResolvedValueOnce(null); // No duplicate name found

      mockPrisma.customRole.update.mockResolvedValue({
        id: 'crole-1',
        tenantId: mockTenant.id,
        name: 'New Name',
        description: 'Updated description',
        color: 'teal',
        baseRole: UserRole.MANAGER,
        permissions: ['reports.view'],
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.updateCustomRole(mockTenant.slug, 'crole-1', {
        name: 'New Name',
        description: 'Updated description',
        color: 'teal',
        baseRole: UserRole.MANAGER,
        permissions: ['reports.view'],
      });

      expect(result.name).toBe('New Name');
      expect(result.baseRole).toBe('manager');
      expect(mockPrisma.staffMember.updateMany).toHaveBeenCalledWith({
        where: { customRoleId: 'crole-1' },
        data: { customRoleName: 'New Name' },
      });
    });

    it('should throw NotFoundException if custom role does not exist', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.customRole.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCustomRole(mockTenant.slug, 'non-existent', {
          name: 'Barista',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCustomRole', () => {
    it('should detach role from staff and delete custom role', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.customRole.findFirst.mockResolvedValue({
        id: 'crole-del',
        tenantId: mockTenant.id,
        name: 'Old Role',
      });

      const result = await service.deleteCustomRole(mockTenant.slug, 'crole-del');

      expect(result.success).toBe(true);
      expect(mockPrisma.staffMember.updateMany).toHaveBeenCalledWith({
        where: { customRoleId: 'crole-del' },
        data: {
          customRoleId: null,
          customRoleName: null,
        },
      });
      expect(mockPrisma.customRole.delete).toHaveBeenCalledWith({
        where: { id: 'crole-del' },
      });
    });
  });
});

