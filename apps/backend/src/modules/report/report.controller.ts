import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ReportService } from './report.service';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { GetReportQueryDto } from './dto/get-report-query.dto';

@ApiTags('(Tenant) Reports & Analytics')
@Controller('tenants')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get(':tenantSlug/reports/inventory')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REPORTS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get inventory stock valuation and movements report',
    description:
      'Calculates total ingredient stock valuation, item count, low-stock threshold alerts, recorded wastage cost, and top stock movements.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Tenant slug or ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory valuation report retrieved successfully',
  })
  async getInventoryReport(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetReportQueryDto,
  ) {
    const report = await this.reportService.getInventoryReport(
      tenantSlug,
      query,
    );
    return ResponseHelper.success(
      report,
      'Inventory report retrieved successfully',
    );
  }

  @Get(':tenantSlug/reports/operations')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REPORTS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get operations velocity and mechanics report',
    description:
      'Aggregates orders by status, orders by dine-in/takeaway/delivery type, kitchen bump counts, dining table turnover, and staff roster summary.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Tenant slug or ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Operations report retrieved successfully',
  })
  async getOperationsReport(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetReportQueryDto,
  ) {
    const report = await this.reportService.getOperationsReport(
      tenantSlug,
      query,
    );
    return ResponseHelper.success(
      report,
      'Operations report retrieved successfully',
    );
  }

  @Get(':tenantSlug/reports/sales')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REPORTS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get sales performance report',
    description:
      'Aggregates total revenue, net sales, order volume, average order value, top items, and category distribution.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Tenant slug or ID',
  })
  async getSalesReport(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetReportQueryDto,
  ) {
    const report = await this.reportService.getSalesReport(tenantSlug, query);
    return ResponseHelper.success(
      report,
      'Sales report retrieved successfully',
    );
  }

  @Get(':tenantSlug/reports/financial')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REPORTS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get financial breakdown report',
    description:
      'Aggregates gross sales, discounts, taxes, service charges, refunds, net profit, and payment method distribution.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Tenant slug or ID',
  })
  async getFinancialReport(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetReportQueryDto,
  ) {
    const report = await this.reportService.getFinancialReport(
      tenantSlug,
      query,
    );
    return ResponseHelper.success(
      report,
      'Financial report retrieved successfully',
    );
  }
}

