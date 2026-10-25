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
  ApiQuery,
} from '@nestjs/swagger';
import { GoodsReceiptService } from './goods-receipt.service';
import { ReceiveGoodsDto, GetGoodsReceiptsQueryDto } from './dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('(Tenant) Goods Receiving')
@Controller('tenants')
export class GoodsReceiptController {
  constructor(
    private readonly goodsReceiptService: GoodsReceiptService,
  ) {}

  @Post(':tenantSlug/goods-receipts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Receive delivery against a purchase order',
    description:
      'Receives items from supplier delivery, increases BranchStock, logs StockMovement audit records, and updates Purchase Order status.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 201,
    description: 'Goods received and inventory updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, order in draft, or over-receiving quantity',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant or purchase order not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Purchase order already fully received or cancelled',
  })
  async receiveGoods(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: ReceiveGoodsDto,
    @CurrentUser() user: any,
  ) {
    const receipt = await this.goodsReceiptService.receiveGoods(
      tenantSlug,
      dto,
      user,
    );
    return ResponseHelper.created(
      receipt,
      'Goods received and inventory updated successfully',
    );
  }

  @Get(':tenantSlug/goods-receipts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all goods received notes (GRNs)',
    description:
      'Retrieves all goods receipts for the restaurant with optional filtering by branch, supplier, PO, date range, or search term.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Goods receipts retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getGoodsReceipts(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetGoodsReceiptsQueryDto,
  ) {
    const receipts = await this.goodsReceiptService.getGoodsReceipts(
      tenantSlug,
      query,
    );
    return ResponseHelper.success(
      receipts,
      'Goods receipts retrieved successfully',
    );
  }

  @Get(':tenantSlug/goods-receipts/awaiting-orders')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get purchase orders awaiting delivery',
    description:
      'Retrieves purchase orders in SENT or PARTIALLY_RECEIVED status that are waiting to be received at the branch.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Optional branch ID filter',
  })
  @ApiResponse({
    status: 200,
    description: 'Awaiting purchase orders retrieved successfully',
  })
  async getAwaitingOrders(
    @Param('tenantSlug') tenantSlug: string,
    @Query('branchId') branchId?: string,
  ) {
    const orders = await this.goodsReceiptService.getAwaitingOrders(
      tenantSlug,
      branchId,
    );
    return ResponseHelper.success(
      orders,
      'Awaiting purchase orders retrieved successfully',
    );
  }

  @Get(':tenantSlug/goods-receipts/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get details of a single goods receipt by ID',
    description:
      'Retrieves full details of a Goods Received Note including lines, items, costs, supplier, and PO.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
    description: 'Goods receipt ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Goods receipt retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Goods receipt not found' })
  async getGoodsReceiptById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const receipt = await this.goodsReceiptService.getGoodsReceiptById(
      tenantSlug,
      id,
    );
    return ResponseHelper.success(
      receipt,
      'Goods receipt retrieved successfully',
    );
  }
}

