import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { SupplierReturnService } from './supplier-return.service';
import {
  CreateSupplierReturnDto,
  GetSupplierReturnsQueryDto,
} from './dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('(Tenant) Supplier Returns')
@Controller('tenants')
export class SupplierReturnController {
  constructor(
    private readonly supplierReturnService: SupplierReturnService,
  ) {}

  @Post(':tenantSlug/supplier-returns')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record goods returned to a supplier',
    description:
      'Creates a Supplier Return note (RTN), deducts inventory stock immediately, computes credit due, and logs audit stock movements.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 201,
    description: 'Supplier return recorded and stock deducted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or return quantity exceeds stock on hand',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant, branch, supplier, or ingredient not found',
  })
  async createSupplierReturn(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateSupplierReturnDto,
    @CurrentUser() user: any,
  ) {
    const returnRecord =
      await this.supplierReturnService.createSupplierReturn(
        tenantSlug,
        dto,
        user,
      );
    return ResponseHelper.created(
      returnRecord,
      'Supplier return recorded and stock reduced successfully',
    );
  }

  @Get(':tenantSlug/supplier-returns')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all supplier returns for a restaurant',
    description:
      'Retrieves supplier return notes with optional filtering by branch, supplier, date range, or search query.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier returns retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getSupplierReturns(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetSupplierReturnsQueryDto,
  ) {
    const returns = await this.supplierReturnService.getSupplierReturns(
      tenantSlug,
      query,
    );
    return ResponseHelper.success(
      returns,
      'Supplier returns retrieved successfully',
    );
  }

  @Get(':tenantSlug/supplier-returns/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get details of a single supplier return note by ID',
    description:
      'Retrieves full details of a Supplier Return Note including items, credited unit costs, supplier, and branch.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
    description: 'Supplier return ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier return retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Supplier return not found' })
  async getSupplierReturnById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const returnRecord =
      await this.supplierReturnService.getSupplierReturnById(tenantSlug, id);
    return ResponseHelper.success(
      returnRecord,
      'Supplier return retrieved successfully',
    );
  }
}
