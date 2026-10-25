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
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { GetPurchaseOrdersQueryDto } from './dto/get-purchase-orders-query.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('(Tenant) Purchase Orders')
@Controller('tenants')
export class PurchaseOrderController {
  constructor(
    private readonly purchaseOrderService: PurchaseOrderService,
  ) {}

  @Post(':tenantSlug/purchase-orders')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new purchase order',
    description:
      'Creates a new purchase order selecting a supplier, branch, and items with quantities and unit costs.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 201,
    description: 'Purchase order created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or inactive supplier / invalid items',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant, branch, or supplier not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Purchase order with this PO number already exists',
  })
  async createPurchaseOrder(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: any,
  ) {
    const order = await this.purchaseOrderService.createPurchaseOrder(
      tenantSlug,
      dto,
      user,
    );
    return ResponseHelper.created(
      order,
      'Purchase order created successfully',
    );
  }

  @Get(':tenantSlug/purchase-orders')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all purchase orders for a restaurant',
    description:
      'Retrieves purchase orders with optional filtering by branch, supplier, status, or search term.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase orders retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getPurchaseOrders(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetPurchaseOrdersQueryDto,
  ) {
    const orders = await this.purchaseOrderService.getPurchaseOrders(
      tenantSlug,
      query,
    );
    return ResponseHelper.success(
      orders,
      'Purchase orders retrieved successfully',
    );
  }

  @Get(':tenantSlug/purchase-orders/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get details of a single purchase order by ID',
    description:
      'Retrieves details of a purchase order, including supplier, branch, items with ingredients, and goods receipts.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'id',
    example: 'cuid',
    description: 'Purchase Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase order retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Purchase order or restaurant not found',
  })
  async getPurchaseOrderById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const order = await this.purchaseOrderService.getPurchaseOrderById(
      tenantSlug,
      id,
    );
    return ResponseHelper.success(
      order,
      'Purchase order retrieved successfully',
    );
  }

  @Put(':tenantSlug/purchase-orders/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update an existing purchase order',
    description:
      'Updates purchase order details (only draft orders can have items/supplier edited) or updates order status.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'id',
    example: 'cuid',
    description: 'Purchase Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase order updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or inactive supplier / invalid items',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Purchase order, branch, or supplier not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Cannot edit non-draft order or invalid status transition',
  })
  async updatePurchaseOrder(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    const order = await this.purchaseOrderService.updatePurchaseOrder(
      tenantSlug,
      id,
      dto,
    );
    return ResponseHelper.success(
      order,
      'Purchase order updated successfully',
    );
  }

  @Delete(':tenantSlug/purchase-orders/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel / delete a purchase order',
    description:
      'Cancels and soft-deletes a purchase order by setting status to CANCELLED.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'id',
    example: 'cuid',
    description: 'Purchase Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase order cancelled successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Purchase order or restaurant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Orders with received goods cannot be deleted or cancelled',
  })
  async deletePurchaseOrder(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const result = await this.purchaseOrderService.deletePurchaseOrder(
      tenantSlug,
      id,
    );
    return ResponseHelper.success(
      result,
      'Purchase order cancelled successfully',
    );
  }
}

