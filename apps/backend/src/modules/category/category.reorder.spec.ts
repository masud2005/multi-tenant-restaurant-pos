import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CategoryService } from './category.service';
import { NotFoundException } from '../../common/exceptions/business.exception';

describe('CategoryService - Category Move & Reorder', () => {
  let categoryService: CategoryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: vi.fn(),
      },
      category: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (arg) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        if (typeof arg === 'function') {
          return arg(mockPrisma);
        }
        return arg;
      }),
    };

    categoryService = new CategoryService(mockPrisma);
  });

  const tenant = { id: 'tenant_1', slug: 'sultans-dine' };
  const categories = [
    { id: 'cat_1', tenantId: 'tenant_1', name: 'Starters', sort: 0, isActive: true },
    { id: 'cat_2', tenantId: 'tenant_1', name: 'Mains', sort: 1, isActive: true },
    { id: 'cat_3', tenantId: 'tenant_1', name: 'Desserts', sort: 2, isActive: true },
  ];

  describe('moveCategory', () => {
    it('throws NotFoundException if restaurant tenant does not exist', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        categoryService.moveCategory('missing-tenant', 'cat_1', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if category does not exist for the tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.category.findMany.mockResolvedValue(categories);
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(
        categoryService.moveCategory(tenant.slug, 'cat_non_existent', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('swaps category down with the next adjacent category (dir: 1)', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.category.findMany
        .mockResolvedValueOnce(categories)
        .mockResolvedValueOnce([
          { ...categories[1], sort: 0 },
          { ...categories[0], sort: 1 },
          { ...categories[2], sort: 2 },
        ]);

      mockPrisma.category.update.mockImplementation(({ where, data }: any) => ({
        id: where.id,
        sort: data.sort,
      }));

      const result = await categoryService.moveCategory(tenant.slug, 'cat_1', 1);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat_2' },
        data: { sort: 0 },
      });
      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat_1' },
        data: { sort: 1 },
      });
      expect(result).toHaveLength(3);
    });

    it('swaps category up with the previous adjacent category (dir: -1)', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.category.findMany
        .mockResolvedValueOnce(categories)
        .mockResolvedValueOnce([
          { ...categories[0], sort: 0 },
          { ...categories[2], sort: 1 },
          { ...categories[1], sort: 2 },
        ]);

      const result = await categoryService.moveCategory(tenant.slug, 'cat_3', -1);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat_3' },
        data: { sort: 1 },
      });
      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat_2' },
        data: { sort: 2 },
      });
      expect(result).toBeDefined();
    });

    it('does not swap if category is already at top boundary and moved up (dir: -1)', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.category.findMany.mockResolvedValue(categories);

      const result = await categoryService.moveCategory(tenant.slug, 'cat_1', -1);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual(categories);
    });

    it('does not swap if category is already at bottom boundary and moved down (dir: 1)', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.category.findMany.mockResolvedValue(categories);

      const result = await categoryService.moveCategory(tenant.slug, 'cat_3', 1);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual(categories);
    });
  });

  describe('reorderCategories', () => {
    it('throws NotFoundException if tenant is not found', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        categoryService.reorderCategories('unknown-tenant', ['cat_1', 'cat_2']),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates sort order of each category in list based on position', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.category.updateMany.mockResolvedValue({ count: 1 });
      const reorderedList = [
        { ...categories[2], sort: 0 },
        { ...categories[0], sort: 1 },
        { ...categories[1], sort: 2 },
      ];
      mockPrisma.category.findMany.mockResolvedValue(reorderedList);

      const result = await categoryService.reorderCategories(tenant.slug, [
        'cat_3',
        'cat_1',
        'cat_2',
      ]);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
        where: { id: 'cat_3', tenantId: tenant.id },
        data: { sort: 0 },
      });
      expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
        where: { id: 'cat_1', tenantId: tenant.id },
        data: { sort: 1 },
      });
      expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
        where: { id: 'cat_2', tenantId: tenant.id },
        data: { sort: 2 },
      });
      expect(result).toEqual(reorderedList);
    });
  });
});

