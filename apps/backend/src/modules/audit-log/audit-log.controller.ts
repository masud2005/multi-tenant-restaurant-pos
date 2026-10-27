import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { CreateAuditLogDto, GetAuditLogsQueryDto } from './dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Audit Logs')
@Controller('tenants')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get(':tenantSlug/audit-logs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUDIT_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get audit logs for the restaurant',
    description:
      'Retrieves immutable audit trail with filtering for entity, action, date range, and text search.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Restaurant slug or UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getAuditLogs(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetAuditLogsQueryDto,
  ) {
    const result = await this.auditLogService.findAll(tenantSlug, query);
    return ResponseHelper.success(result, 'Audit logs retrieved successfully');
  }

  @Post(':tenantSlug/audit-logs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUDIT_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record an audit log entry',
    description: 'Records an operational or administrative action in the audit trail.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
  })
  @ApiResponse({
    status: 201,
    description: 'Audit log recorded successfully',
  })
  async createAuditLog(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateAuditLogDto,
    @Req() req: any,
  ) {
    // If not supplied, enrich with IP and user-agent from request
    if (!dto.ipAddress && req?.ip) {
      dto.ipAddress = req.ip;
    }
    if (!dto.userAgent && req?.headers?.['user-agent']) {
      dto.userAgent = req.headers['user-agent'];
    }

    const log = await this.auditLogService.createLog(tenantSlug, dto);
    return ResponseHelper.created(log, 'Audit log recorded successfully');
  }

  @Get(':tenantSlug/audit-logs/stats')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUDIT_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get audit log statistics',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
  })
  async getStats(@Param('tenantSlug') tenantSlug: string) {
    const stats = await this.auditLogService.getStats(tenantSlug);
    return ResponseHelper.success(stats, 'Audit stats retrieved successfully');
  }
}
