import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { CreateLoyaltyTierDto } from './dto/create-loyalty-tier.dto';
import { UpdateLoyaltyTierDto } from './dto/update-loyalty-tier.dto';
import { UpdateLoyaltySettingsDto } from './dto/update-loyalty-settings.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Loyalty Settings & Tiers')
@Controller('tenants')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // ==========================================
  // LOYALTY SETTINGS
  // ==========================================

  @Get(':tenantSlug/loyalty/settings')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get restaurant loyalty settings',
    description:
      'Fetches current point earning rates, point redemption values, and thresholds. Initializes defaults if first time.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  async getSettings(@Param('tenantSlug') tenantSlug: string) {
    const settings = await this.loyaltyService.getSettings(tenantSlug);
    return ResponseHelper.success(
      settings,
      'Loyalty settings retrieved successfully',
    );
  }

  @Put(':tenantSlug/loyalty/settings')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update restaurant loyalty settings',
    description:
      'Configure spend-per-point, point redemption value in currency, and minimum points required to redeem.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  async updateSettings(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: UpdateLoyaltySettingsDto,
  ) {
    const settings = await this.loyaltyService.updateSettings(tenantSlug, dto);
    return ResponseHelper.success(
      settings,
      'Loyalty settings updated successfully',
    );
  }

  // ==========================================
  // LOYALTY TIERS
  // ==========================================

  @Get(':tenantSlug/loyalty/tiers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all loyalty tiers',
    description:
      'Retrieves all configured membership tiers (e.g. Bronze, Silver, Gold) with member counts. Auto-seeds defaults if empty.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  async getTiers(@Param('tenantSlug') tenantSlug: string) {
    const tiers = await this.loyaltyService.getTiers(tenantSlug);
    return ResponseHelper.success(tiers, 'Loyalty tiers retrieved successfully');
  }

  @Post(':tenantSlug/loyalty/tiers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new loyalty tier rule',
    description:
      'Creates a new customer tier with minimum spend threshold, point multiplier, discount percent, and UI badge color.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiResponse({ status: 201, description: 'Tier created successfully' })
  @ApiResponse({ status: 409, description: 'Tier name already exists' })
  async createTier(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateLoyaltyTierDto,
  ) {
    const tier = await this.loyaltyService.createTier(tenantSlug, dto);
    return ResponseHelper.created(tier, 'Loyalty tier created successfully');
  }

  @Get(':tenantSlug/loyalty/tiers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get tier details by ID',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
  })
  async getTierById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const tier = await this.loyaltyService.getTierById(tenantSlug, id);
    return ResponseHelper.success(tier, 'Loyalty tier retrieved');
  }

  @Put(':tenantSlug/loyalty/tiers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update loyalty tier rule',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
  })
  async updateTier(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateLoyaltyTierDto,
  ) {
    const updated = await this.loyaltyService.updateTier(tenantSlug, id, dto);
    return ResponseHelper.success(updated, 'Loyalty tier updated successfully');
  }

  @Delete(':tenantSlug/loyalty/tiers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete loyalty tier',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
  })
  async deleteTier(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const result = await this.loyaltyService.deleteTier(tenantSlug, id);
    return ResponseHelper.success(result, 'Loyalty tier deleted successfully');
  }
}
