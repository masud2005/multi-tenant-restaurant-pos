import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiderService } from './rider.service';
import { NotFoundException } from '../../common/exceptions/business.exception';

describe('RiderService', () => {
  let riderService: RiderService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: vi.fn(),
      },
      branch: {
        findFirst: vi.fn(),
      },
      rider: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };

    riderService = new RiderService(mockPrisma);
  });

  const tenant = { id: 't_saffron', slug: 'saffron-ember', name: 'Saffron & Ember' };
  const branch = { id: 'b_se_gulshan', name: 'Gulshan', tenantId: 't_saffron', isActive: true };

  describe('createRider', () => {
    it('should successfully create a new rider', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.branch.findFirst.mockResolvedValue(branch);

      const created = {
        id: 'r_1',
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'Babul Mia',
        phone: '+8801611000123',
        isActive: true,
        isDeleted: false,
        branch: { id: branch.id, name: branch.name },
      };
      mockPrisma.rider.create.mockResolvedValue(created);

      const result = await riderService.createRider(tenant.slug, {
        branchId: branch.id,
        name: '  Babul Mia  ',
        phone: '  +8801611000123  ',
      });

      expect(result).toEqual(created);
      expect(mockPrisma.rider.create).toHaveBeenCalledWith({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          name: 'Babul Mia',
          phone: '+8801611000123',
          isActive: true,
        },
        include: {
          branch: { select: { id: true, name: true } },
        },
      });
    });

    it('should throw NotFoundException if tenant does not exist', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        riderService.createRider('invalid-slug', {
          branchId: 'b_1',
          name: 'Babul',
          phone: '123',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRiders', () => {
    it('should return riders list with filtering', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      const ridersList = [
        { id: 'r_1', name: 'Babul Mia', phone: '+8801611000123', isActive: true },
        { id: 'r_2', name: 'Shohel Rana', phone: '+8801611000456', isActive: true },
      ];
      mockPrisma.rider.findMany.mockResolvedValue(ridersList);

      const result = await riderService.getRiders(tenant.slug, {
        branchId: branch.id,
        activeOnly: true,
      });

      expect(result).toEqual(ridersList);
      expect(mockPrisma.rider.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: tenant.id,
          branchId: branch.id,
          isActive: true,
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
        },
      });
    });
  });

  describe('getRiderById', () => {
    it('should return rider if found', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      const rider = { id: 'r_1', name: 'Babul Mia' };
      mockPrisma.rider.findFirst.mockResolvedValue(rider);

      const result = await riderService.getRiderById(tenant.slug, 'r_1');
      expect(result).toEqual(rider);
    });

    it('should throw NotFoundException if rider not found', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.rider.findFirst.mockResolvedValue(null);

      await expect(
        riderService.getRiderById(tenant.slug, 'non-existent')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRider', () => {
    it('should update rider details', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      const existing = { id: 'r_1', branchId: branch.id, tenantId: tenant.id };
      mockPrisma.rider.findFirst.mockResolvedValue(existing);

      const updated = { ...existing, name: 'Babul Mia Updated', phone: '+8801699999999' };
      mockPrisma.rider.update.mockResolvedValue(updated);

      const result = await riderService.updateRider(tenant.slug, 'r_1', {
        name: 'Babul Mia Updated',
        phone: '+8801699999999',
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.rider.update).toHaveBeenCalledWith({
        where: { id: 'r_1' },
        data: {
          name: 'Babul Mia Updated',
          phone: '+8801699999999',
          branchId: undefined,
          isActive: undefined,
        },
        include: {
          branch: { select: { id: true, name: true } },
        },
      });
    });
  });

  describe('deleteRider', () => {
    it('should soft-delete rider', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      const existing = { id: 'r_1', name: 'Babul Mia', isDeleted: false };
      mockPrisma.rider.findFirst.mockResolvedValue(existing);
      mockPrisma.rider.update.mockResolvedValue({ ...existing, isDeleted: true });

      const result = await riderService.deleteRider(tenant.slug, 'r_1');
      expect(result).toEqual({
        success: true,
        message: 'Rider Babul Mia deleted successfully',
      });
      expect(mockPrisma.rider.update).toHaveBeenCalledWith({
        where: { id: 'r_1' },
        data: expect.objectContaining({
          isDeleted: true,
          isActive: false,
        }),
      });
    });
  });
});

