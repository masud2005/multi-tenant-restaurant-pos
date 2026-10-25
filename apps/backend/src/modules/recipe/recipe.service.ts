import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveRecipeDto } from './dto/save-recipe.dto';
import { NotFoundException } from '../../common/exceptions/business.exception';

@Injectable()
export class RecipeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List recipe costs and profit margins for all active menu items of a restaurant tenant,
   * calculated against current ingredient unit costs of a specified branch.
   */
  async listRecipeCosts(tenantSlug: string, branchId?: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        recipeLines: {
          include: {
            ingredient: {
              include: {
                branchStocks: branchId ? { where: { branchId } } : true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return menuItems.map((item) => {
      let plateCost = 0;
      const recipe = item.recipeLines.map((line) => {
        const ing = line.ingredient;
        const bStock = ing?.branchStocks?.[0];
        const unitCost = bStock?.unitCost ?? ing?.costPerUnit ?? 0;
        const lineCost = Math.round(unitCost * line.quantity * 100) / 100;
        plateCost += lineCost;

        return {
          id: line.id,
          ingredientId: line.ingredientId,
          ingredientKey: line.ingredientId,
          name: ing?.name ?? 'Unknown',
          unit: line.unit || ing?.unit || '',
          qty: line.quantity,
          quantity: line.quantity,
          unitCost,
          lineCost,
          missing: !ing || ing.isDeleted,
        };
      });

      plateCost = Math.round(plateCost * 100) / 100;
      const price = item.price;
      const margin = Math.round((price - plateCost) * 100) / 100;
      const costPct =
        price > 0 ? Math.round((plateCost / price) * 1000) / 10 : 0;

      return {
        itemId: item.id,
        name: item.name,
        categoryId: item.categoryId,
        categoryName: item.category?.name ?? '',
        price,
        cost: plateCost,
        margin,
        costPct,
        recipe,
      };
    });
  }

  /**
   * Save or replace recipe lines for a menu item in a single atomic transaction.
   */
  async saveRecipe(tenantSlug: string, menuItemId: string, dto: SaveRecipeDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const menuItem = await this.prisma.menuItem.findFirst({
      where: {
        id: menuItemId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item');
    }

    const rawLines = dto.lines ?? dto.recipe ?? [];
    const validLines = rawLines.filter(
      (line) => (line.quantity ?? line.qty ?? 0) > 0,
    );

    return await this.prisma.$transaction(async (tx) => {
      // 1. Remove previous recipe lines for this menu item
      await tx.recipeLine.deleteMany({
        where: { menuItemId },
      });

      // 2. Insert new recipe lines
      if (validLines.length > 0) {
        await tx.recipeLine.createMany({
          data: validLines.map((line) => ({
            menuItemId,
            ingredientId: line.ingredientId ?? line.ingredientKey!,
            quantity: line.quantity ?? line.qty ?? 0,
            unit: line.unit?.trim() || '',
            variantId: line.variantId || null,
          })),
        });
      }

      // 3. Return updated menu item with its new recipe lines and ingredient details
      return tx.menuItem.findUnique({
        where: { id: menuItemId },
        include: {
          recipeLines: {
            include: {
              ingredient: true,
            },
          },
        },
      });
    });
  }
}
