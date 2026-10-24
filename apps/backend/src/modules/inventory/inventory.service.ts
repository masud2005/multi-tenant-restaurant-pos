import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { GetIngredientsQueryDto } from './dto/get-ingredients-query.dto';
import { SubmitStockCountDto } from './dto/submit-stock-count.dto';
import { GetStockCountsQueryDto } from './dto/get-stock-counts-query.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';
import {
  MovementReason,
  Prisma,
  StockCountStatus,
} from '../../../prisma/generated/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new ingredient for a tenant and initialize branch stock
   * across tenant branches (target branch gets opening stock, others get 0 stock).
   */
  async createIngredient(
    tenantSlug: string,
    dto: CreateIngredientDto,
    currentUser?: any,
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

    const trimmedName = dto.name.trim();

    // 2. Check if ingredient with this name already exists for this tenant
    const existing = await this.prisma.ingredient.findFirst({
      where: {
        tenantId: tenant.id,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        isDeleted: false,
      },
    });

    if (existing) {
      throw new AlreadyExistsException('An ingredient with this name');
    }

    // 3. Find tenant branches
    const branches = await this.prisma.branch.findMany({
      where: { tenantId: tenant.id, isActive: true },
    });

    // If branchId is explicitly passed, ensure it exists and belongs to this tenant
    if (dto.branchId) {
      const branchBelongsToTenant = branches.some((b) => b.id === dto.branchId);
      if (!branchBelongsToTenant) {
        const branchExists = await this.prisma.branch.findFirst({
          where: { id: dto.branchId, tenantId: tenant.id },
        });
        if (!branchExists) {
          throw new NotFoundException('Branch');
        }
      }
    }

    const unitCost = dto.costPerUnit ?? dto.unitCost ?? 0;
    const openingStock = dto.openingStock ?? 0;
    const reorderLevel = dto.reorderLevel ?? 0;
    const idealStock = dto.idealStock ?? 0;

    // 4. Create in Prisma transaction to ensure atomicity
    return await this.prisma.$transaction(async (tx) => {
      // Step A: Create master ingredient
      const ingredient = await tx.ingredient.create({
        data: {
          tenantId: tenant.id,
          name: trimmedName,
          code: dto.code?.trim() || '',
          category: dto.category?.trim() || '',
          storageType: dto.storageType?.trim() || '',
          unit: dto.unit.trim(),
          costPerUnit: unitCost,
          isActive: true,
          isDeleted: false,
        },
      });

      // Step B: Initialize BranchStock for each branch
      // (The target branch gets openingStock, other branches get 0 stock)
      for (const branch of branches) {
        const isTargetBranch = dto.branchId
          ? branch.id === dto.branchId
          : branches.length === 1;

        const initialStock = isTargetBranch ? openingStock : 0;

        await tx.branchStock.create({
          data: {
            tenantId: tenant.id,
            branchId: branch.id,
            ingredientId: ingredient.id,
            currentStock: initialStock,
            reorderLevel: reorderLevel,
            idealStock: idealStock,
            unitCost: unitCost,
            lastRestockedAt: initialStock > 0 ? new Date() : null,
          },
        });

        // Step C: Log StockMovement audit trail if initial stock was provided
        if (isTargetBranch && initialStock > 0) {
          await tx.stockMovement.create({
            data: {
              tenantId: tenant.id,
              branchId: branch.id,
              ingredientId: ingredient.id,
              quantity: initialStock,
              previousStock: 0,
              newStock: initialStock,
              unit: dto.unit.trim(),
              reason: MovementReason.ADJUSTMENT,
              reference: 'Opening stock',
              notes: 'Initial stock on creation',
              createdBy:
                currentUser?.name || currentUser?.email || 'System User',
            },
          });
        }
      }

      // Return created ingredient with populated branch stocks
      return tx.ingredient.findUnique({
        where: { id: ingredient.id },
        include: {
          branchStocks: {
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

  /**
   * Get all ingredients for a tenant with optional branch stock calculation,
   * search, category filtering, and low stock filtering.
   */
  async getIngredients(tenantSlug: string, query: GetIngredientsQueryDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const where: Prisma.IngredientWhereInput = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    if (query.activeOnly !== undefined) {
      where.isActive = query.activeOnly;
    }

    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { code: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const branchId = query.branchId;

    if (branchId) {
      const ingredients = await this.prisma.ingredient.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          branchStocks: {
            where: { branchId },
          },
        },
      });

      const formatted = ingredients.map((ing) => {
        const bStock = ing.branchStocks?.[0];
        const stock = bStock?.currentStock ?? 0;
        const reorderLevel = bStock?.reorderLevel ?? 0;
        const unitCost = bStock?.unitCost ?? ing.costPerUnit;

        return {
          id: ing.id,
          key: ing.id,
          tenantId: ing.tenantId,
          branchId,
          name: ing.name,
          code: ing.code,
          category: ing.category,
          storageType: ing.storageType,
          unit: ing.unit,
          stock,
          reorderLevel,
          idealStock: bStock?.idealStock ?? 0,
          unitCost,
          isActive: ing.isActive,
          createdAt: ing.createdAt,
          updatedAt: ing.updatedAt,
        };
      });

      if (query.lowStockOnly) {
        return formatted.filter((item) => item.stock <= item.reorderLevel);
      }

      return formatted;
    }

    return await this.prisma.ingredient.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        branchStocks: {
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
   * Get a single ingredient by ID with branch stock details.
   */
  async getIngredientById(tenantSlug: string, ingredientId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const ingredient = await this.prisma.ingredient.findFirst({
      where: {
        id: ingredientId,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        branchStocks: {
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

    if (!ingredient) {
      throw new NotFoundException('Ingredient');
    }

    return ingredient;
  }

  /**
   * Update an ingredient and optionally its branch stock settings
   * (e.g. reorderLevel, idealStock, unitCost).
   */
  async updateIngredient(
    tenantSlug: string,
    ingredientId: string,
    dto: UpdateIngredientDto,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const existing = await this.prisma.ingredient.findFirst({
      where: {
        id: ingredientId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!existing) {
      throw new NotFoundException('Ingredient');
    }

    // If name is being changed, check for conflict with other ingredients
    if (dto.name) {
      const trimmedName = dto.name.trim();
      if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
        const conflict = await this.prisma.ingredient.findFirst({
          where: {
            tenantId: tenant.id,
            name: {
              equals: trimmedName,
              mode: 'insensitive',
            },
            id: { not: ingredientId },
            isDeleted: false,
          },
        });

        if (conflict) {
          throw new AlreadyExistsException('An ingredient with this name');
        }
      }
    }

    const unitCost = dto.costPerUnit ?? dto.unitCost;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Update ingredient master data
      const ingredientData: Prisma.IngredientUpdateInput = {};

      if (dto.name !== undefined) ingredientData.name = dto.name.trim();
      if (dto.unit !== undefined) ingredientData.unit = dto.unit.trim();
      if (unitCost !== undefined) ingredientData.costPerUnit = unitCost;
      if (dto.code !== undefined) ingredientData.code = dto.code?.trim() || '';
      if (dto.category !== undefined)
        ingredientData.category = dto.category?.trim() || '';
      if (dto.storageType !== undefined)
        ingredientData.storageType = dto.storageType?.trim() || '';
      if (dto.isActive !== undefined) ingredientData.isActive = dto.isActive;

      await tx.ingredient.update({
        where: { id: ingredientId },
        data: ingredientData,
      });

      // 2. If branchId is passed and branch settings changed, update BranchStock
      if (dto.branchId) {
        const branchStockUpdate: Prisma.BranchStockUpdateInput = {};
        if (dto.reorderLevel !== undefined)
          branchStockUpdate.reorderLevel = dto.reorderLevel;
        if (dto.idealStock !== undefined)
          branchStockUpdate.idealStock = dto.idealStock;
        if (unitCost !== undefined) branchStockUpdate.unitCost = unitCost;

        if (Object.keys(branchStockUpdate).length > 0) {
          await tx.branchStock.upsert({
            where: {
              branchId_ingredientId: {
                branchId: dto.branchId,
                ingredientId,
              },
            },
            update: branchStockUpdate,
            create: {
              tenantId: tenant.id,
              branchId: dto.branchId,
              ingredientId,
              reorderLevel: dto.reorderLevel ?? 0,
              idealStock: dto.idealStock ?? 0,
              unitCost: unitCost ?? 0,
              currentStock: 0,
            },
          });
        }
      }

      // 3. Return updated ingredient with populated branch stocks
      return tx.ingredient.findUnique({
        where: { id: ingredientId },
        include: {
          branchStocks: {
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

  /**
   * Soft delete an ingredient (sets isDeleted: true, deletedAt, isActive: false).
   */
  async deleteIngredient(tenantSlug: string, ingredientId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const ingredient = await this.prisma.ingredient.findFirst({
      where: {
        id: ingredientId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient');
    }

    await this.prisma.ingredient.update({
      where: { id: ingredientId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return { message: 'Ingredient deleted successfully' };
  }

  /**
   * Helper: Generate sequential stock count number per branch
   * Format: SC-YYYYMMDD-001
   */
  private async generateStockCountNumber(
    branchId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx ?? this.prisma;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const startOfDay = new Date(yyyy, now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(
      yyyy,
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const countToday = await client.stockCount.count({
      where: {
        branchId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const serial = String(countToday + 1).padStart(3, '0');
    return `SC-${dateStr}-${serial}`;
  }

  /**
   * Submit physical stock count, update live inventory, and log movements atomically
   */
  async submitStockCount(
    tenantSlug: string,
    dto: SubmitStockCountDto,
    currentUser?: any,
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

    // 2. Verify branch exists
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: dto.branchId,
        tenantId: tenant.id,
        isActive: true,
      },
    });
    if (!branch) {
      throw new NotFoundException('Branch');
    }

    // 3. Verify ingredients belong to tenant
    const ingredientIds = dto.counts.map((c) => c.ingredientId);
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        branchStocks: {
          where: { branchId: branch.id },
        },
      },
    });

    const ingMap = new Map(ingredients.map((ing) => [ing.id, ing]));
    for (const item of dto.counts) {
      if (!ingMap.has(item.ingredientId)) {
        throw new BadRequestException(
          `Ingredient ${item.ingredientId} does not exist or is inactive`,
        );
      }
    }

    const createdBy =
      currentUser?.fullName ||
      currentUser?.name ||
      dto.createdBy ||
      'Staff';

    // 4. Atomic transaction
    return await this.prisma.$transaction(async (tx) => {
      const number = await this.generateStockCountNumber(branch.id, tx);

      const linesData: {
        ingredientId: string;
        expected: number;
        counted: number;
        variance: number;
        unitCost: number;
      }[] = [];

      const stockMovementsToCreate: Prisma.StockMovementCreateManyInput[] = [];

      for (const item of dto.counts) {
        const ingredient = ingMap.get(item.ingredientId)!;
        const counted = Math.round(Number(item.counted) * 1000) / 1000;

        if (counted < 0) {
          throw new BadRequestException(
            `Counted quantity cannot be negative for ${ingredient.name}`,
          );
        }

        // BranchStock check or create
        let branchStock = ingredient.branchStocks?.[0];
        if (!branchStock) {
          branchStock = await tx.branchStock.create({
            data: {
              tenantId: tenant.id,
              branchId: branch.id,
              ingredientId: ingredient.id,
              currentStock: 0,
              reorderLevel: 0,
              unitCost: ingredient.costPerUnit ?? 0,
            },
          });
        }

        const expected = branchStock.currentStock;
        const variance = Math.round((counted - expected) * 1000) / 1000;
        const unitCost = branchStock.unitCost ?? ingredient.costPerUnit ?? 0;

        linesData.push({
          ingredientId: ingredient.id,
          expected,
          counted,
          variance,
          unitCost,
        });

        // Update BranchStock
        await tx.branchStock.update({
          where: { id: branchStock.id },
          data: {
            currentStock: counted,
            lastCountedAt: new Date(),
          },
        });

        // If there is any variance, create StockMovement audit record
        if (variance !== 0) {
          stockMovementsToCreate.push({
            tenantId: tenant.id,
            branchId: branch.id,
            ingredientId: ingredient.id,
            quantity: Math.abs(variance),
            previousStock: expected,
            newStock: counted,
            unit: ingredient.unit,
            reason: MovementReason.COUNT,
            reference: number,
            notes: dto.notes?.trim() || `Physical count adjustment (${number})`,
            createdBy,
          });
        }
      }

      // Create StockCount record with lines
      const stockCount = await tx.stockCount.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          number,
          notes: dto.notes?.trim() || '',
          createdBy,
          status: StockCountStatus.COMPLETED,
          lines: {
            create: linesData,
          },
        },
        include: {
          lines: {
            include: {
              ingredient: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
      });

      // Insert stock movements in bulk
      if (stockMovementsToCreate.length > 0) {
        await tx.stockMovement.createMany({
          data: stockMovementsToCreate,
        });
      }

      return {
        id: stockCount.id,
        tenantId: stockCount.tenantId,
        branchId: stockCount.branchId,
        number: stockCount.number,
        status: stockCount.status,
        notes: stockCount.notes,
        createdBy: stockCount.createdBy,
        createdAt: stockCount.createdAt,
        lines: stockCount.lines.map((l) => ({
          id: l.id,
          ingredientId: l.ingredientId,
          name: l.ingredient.name,
          unit: l.ingredient.unit,
          expected: l.expected,
          counted: l.counted,
          variance: l.variance,
          unitCost: l.unitCost,
        })),
      };
    });
  }

  /**
   * Get stock counts with optional branch filtering and pagination
   */
  async getStockCounts(tenantSlug: string, query: GetStockCountsQueryDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });
    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const where: Prisma.StockCountWhereInput = {
      tenantId: tenant.id,
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };

    const limit = query.limit ? Number(query.limit) : 20;
    const offset = query.offset ? Number(query.offset) : 0;

    const [total, counts] = await Promise.all([
      this.prisma.stockCount.count({ where }),
      this.prisma.stockCount.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            select: { id: true, name: true },
          },
          lines: {
            include: {
              ingredient: {
                select: { id: true, name: true, unit: true },
              },
            },
          },
        },
      }),
    ]);

    const formatted = counts.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      branchId: c.branchId,
      branchName: c.branch?.name,
      number: c.number,
      status: c.status,
      notes: c.notes,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      lines: c.lines.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        name: l.ingredient.name,
        unit: l.ingredient.unit,
        expected: l.expected,
        counted: l.counted,
        variance: l.variance,
        unitCost: l.unitCost,
      })),
    }));

    return {
      items: formatted,
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single stock count by ID
   */
  async getStockCountById(tenantSlug: string, id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });
    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const c = await this.prisma.stockCount.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        branch: {
          select: { id: true, name: true },
        },
        lines: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true },
            },
          },
        },
      },
    });

    if (!c) {
      throw new NotFoundException('Stock Count');
    }

    return {
      id: c.id,
      tenantId: c.tenantId,
      branchId: c.branchId,
      branchName: c.branch?.name,
      number: c.number,
      status: c.status,
      notes: c.notes,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      lines: c.lines.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        name: l.ingredient.name,
        unit: l.ingredient.unit,
        expected: l.expected,
        counted: l.counted,
        variance: l.variance,
        unitCost: l.unitCost,
      })),
    };
  }
}
