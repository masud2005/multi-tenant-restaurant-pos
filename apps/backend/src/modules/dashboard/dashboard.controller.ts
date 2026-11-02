import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { GetDashboardQueryDto } from './dto/get-dashboard-query.dto';

@ApiTags('(Tenant) Dashboard')
@Controller('tenants')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':tenantSlug/dashboard/summary')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DASHBOARD_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get aggregated dashboard summary metrics',
    description:
      'Aggregates today sales, active orders, kitchen queue, table occupancy, 7-day sales breakdown, top selling items, low stock alerts, and recent orders for the tenant or specific branch.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Tenant slug or tenant ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant or branch not found' })
  async getSummary(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetDashboardQueryDto,
  ) {
    const summary = await this.dashboardService.getSummary(tenantSlug, query);
    return ResponseHelper.success(
      summary,
      'Dashboard summary retrieved successfully',
    );
  }
}

