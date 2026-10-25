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
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { GetSuppliersQueryDto } from './dto/get-suppliers-query.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Suppliers')
@Controller('tenants')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post(':tenantSlug/suppliers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new supplier',
    description: 'Creates a new supplier vendor for the restaurant tenant.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 201,
    description: 'Supplier created successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  @ApiResponse({
    status: 409,
    description: 'Supplier with this name already exists',
  })
  async createSupplier(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateSupplierDto,
  ) {
    const supplier = await this.supplierService.createSupplier(tenantSlug, dto);
    return ResponseHelper.created(supplier, 'Supplier created successfully');
  }

  @Get(':tenantSlug/suppliers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all suppliers for a restaurant',
    description:
      'Retrieves all suppliers for the tenant with optional search query and active status filtering.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Suppliers retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getSuppliers(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetSuppliersQueryDto,
  ) {
    const suppliers = await this.supplierService.getSuppliers(
      tenantSlug,
      query,
    );
    return ResponseHelper.success(
      suppliers,
      'Suppliers retrieved successfully',
    );
  }

  @Get(':tenantSlug/suppliers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get details of a single supplier by ID',
    description: 'Retrieves single supplier information and order statistics.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
    description: 'Supplier ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Supplier or restaurant not found',
  })
  async getSupplierById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const supplier = await this.supplierService.getSupplierById(tenantSlug, id);
    return ResponseHelper.success(
      supplier,
      'Supplier retrieved successfully',
    );
  }

  @Put(':tenantSlug/suppliers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update an existing supplier',
    description:
      'Updates supplier information such as contact, supplies, payment terms, or active status.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
    description: 'Supplier ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Supplier or restaurant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Supplier with this name already exists',
  })
  async updateSupplier(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    const supplier = await this.supplierService.updateSupplier(
      tenantSlug,
      id,
      dto,
    );
    return ResponseHelper.success(
      supplier,
      'Supplier updated successfully',
    );
  }

  @Delete(':tenantSlug/suppliers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Soft-delete a supplier',
    description:
      'Soft-deletes a supplier by setting isDeleted to true and active to false.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
    description: 'Supplier ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Supplier or restaurant not found',
  })
  async deleteSupplier(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const result = await this.supplierService.deleteSupplier(tenantSlug, id);
    return ResponseHelper.success(result, 'Supplier deleted successfully');
  }
}
