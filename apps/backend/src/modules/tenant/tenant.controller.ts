import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Restaurant Identity & Settings')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(':tenantSlug/settings')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get restaurant brand identity, taxes and receipt settings' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings(@Param('tenantSlug') tenantSlug: string) {
    const data = await this.tenantService.getTenantSettings(tenantSlug);
    return ResponseHelper.success(data, 'Restaurant settings retrieved');
  }

  @Patch(':tenantSlug/settings')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update restaurant brand identity, theme, taxes and receipt footer' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.tenantService.updateTenantSettings(tenantSlug, dto, user);
    return ResponseHelper.success(data, 'Restaurant settings updated successfully');
  }

  @Put(':tenantSlug/settings')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update restaurant brand identity, theme, taxes and receipt footer (PUT alias)' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  async putSettings(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.tenantService.updateTenantSettings(tenantSlug, dto, user);
    return ResponseHelper.success(data, 'Restaurant settings updated successfully');
  }
}
