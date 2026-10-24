import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RecipeService } from './recipe.service';
import { SaveRecipeDto } from './dto/save-recipe.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Recipes')
@Controller('tenants')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Get(':tenantSlug/recipes')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.RECIPES_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recipe costs and profit margins for all menu items',
    description:
      'Calculates plate cost, profit margins, and food cost percentage for all active menu items against current branch ingredient costs.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description:
      'Optional branch ID to calculate costs using branch-specific stock unit costs',
  })
  @ApiResponse({
    status: 200,
    description: 'Recipe costs retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getRecipeCosts(
    @Param('tenantSlug') tenantSlug: string,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.recipeService.listRecipeCosts(
      tenantSlug,
      branchId,
    );
    return ResponseHelper.success(data, 'Recipe costs retrieved successfully');
  }

  @Put(':tenantSlug/menu-items/:itemId/recipe')
  @Put(':tenantSlug/recipes/:itemId')
  @Post(':tenantSlug/menu-items/:itemId/recipe')
  @Post(':tenantSlug/recipes/:itemId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MENU_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Save or update recipe for a menu item',
    description:
      'Replaces the ingredients and portion quantities required to prepare a single serving of a menu item.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'itemId',
    example: 'uuid',
    description: 'Menu item ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Recipe saved successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Menu item or restaurant not found' })
  async saveRecipe(
    @Param('tenantSlug') tenantSlug: string,
    @Param('itemId') itemId: string,
    @Body() dto: SaveRecipeDto,
  ) {
    const item = await this.recipeService.saveRecipe(tenantSlug, itemId, dto);
    return ResponseHelper.success(item, 'Recipe saved successfully');
  }
}
