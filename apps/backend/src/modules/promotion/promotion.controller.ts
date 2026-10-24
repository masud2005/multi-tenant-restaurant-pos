import {
  Body,
  Controller,
  Delete,
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
} from '@nestjs/swagger';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { GetPromotionsQueryDto } from './dto/get-promotions-query.dto';
import { CheckPromotionQueryDto } from './dto/check-promotion-query.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Promotions')
@Controller('tenants')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post(':tenantSlug/promotions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROMOTIONS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new promo code / discount',
    description:
      'Creates a new promotional discount code for the tenant restaurant with business validation.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Restaurant slug or ID',
  })
  @ApiResponse({
    status: 201,
    description: 'Promotion created successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 409,
    description: 'Promotion with this code already exists',
  })
  async createPromotion(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreatePromotionDto,
  ) {
    const promotion = await this.promotionService.createPromotion(
      tenantSlug,
      dto,
    );
    return ResponseHelper.created(
      promotion,
      'Promotion created successfully',
    );
  }

  @Get(':tenantSlug/promotions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROMOTIONS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List and filter promotions',
    description:
      'Retrieves promotions with search, status filtering, and pagination support.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Restaurant slug or ID',
  })
  async getPromotions(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetPromotionsQueryDto,
  ) {
    const result = await this.promotionService.getPromotions(
      tenantSlug,
      query,
    );
    return ResponseHelper.success(
      result,
      'Promotions retrieved successfully',
    );
  }

  @Get(':tenantSlug/promotions/validate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DISCOUNTS_APPLY, Permission.PROMOTIONS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Validate promo code for POS checkout',
    description:
      'Validates promo code lifecycle, usage cap, min spend, and computes order discount in real-time.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
  })
  async validatePromotion(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: CheckPromotionQueryDto,
  ) {
    const result = await this.promotionService.checkPromotionValidity(
      tenantSlug,
      query.code,
      query.subtotal,
    );
    return ResponseHelper.success(result, 'Promotion is valid');
  }

  @Get(':tenantSlug/promotions/by-code/:code')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DISCOUNTS_APPLY, Permission.PROMOTIONS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Find promotion by exact promo code',
    description:
      'Looks up a promotion by exact code and returns computed availability metrics.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
  })
  @ApiParam({
    name: 'code',
    example: 'WEEKEND20',
  })
  async getPromotionByCode(
    @Param('tenantSlug') tenantSlug: string,
    @Param('code') code: string,
  ) {
    const result = await this.promotionService.checkPromotionValidity(
      tenantSlug,
      code,
    );
    return ResponseHelper.success(result.promotion, 'Promotion found');
  }

  @Get(':tenantSlug/promotions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROMOTIONS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get promotion by ID',
    description:
      'Retrieves promotion details, remaining uses, and computed status by ID.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
  })
  @ApiParam({
    name: 'id',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  async getPromotionById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const promotion = await this.promotionService.getPromotionById(
      tenantSlug,
      id,
    );
    return ResponseHelper.success(
      promotion,
      'Promotion retrieved successfully',
    );
  }

  @Put(':tenantSlug/promotions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROMOTIONS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update an existing promotion',
    description:
      'Updates promotion fields like name, discount value, dates, active status, or usage limits.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
  })
  @ApiParam({
    name: 'id',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  @ApiResponse({ status: 409, description: 'Promo code conflict' })
  async updatePromotion(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    const updated = await this.promotionService.updatePromotion(
      tenantSlug,
      id,
      dto,
    );
    return ResponseHelper.success(
      updated,
      'Promotion updated successfully',
    );
  }

  @Delete(':tenantSlug/promotions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROMOTIONS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete promotion',
    description: 'Soft deletes a promotion from the restaurant records.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
  })
  @ApiParam({
    name: 'id',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async deletePromotion(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const result = await this.promotionService.deletePromotion(
      tenantSlug,
      id,
    );
    return ResponseHelper.success(
      result,
      'Promotion deleted successfully',
    );
  }
}
