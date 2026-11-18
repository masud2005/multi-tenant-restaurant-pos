import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StockTransferService } from './stock-transfer.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { ReceiveStockTransferDto } from './dto/receive-stock-transfer.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Inventory: Stock Transfers')
@Controller('tenants')
export class StockTransferController {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Get(':tenantSlug/stock-transfers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List inter-branch stock transfers' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiResponse({ status: 200, description: 'Stock transfers retrieved successfully' })
  async listTransfers(
    @Param('tenantSlug') tenantSlug: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.stockTransferService.listTransfers(tenantSlug, { branchId, status });
    return ResponseHelper.success(data, 'Stock transfers retrieved successfully');
  }

  @Get(':tenantSlug/stock-transfers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get stock transfer details by ID' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiParam({ name: 'id', example: 'transfer-uuid' })
  async getTransfer(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const data = await this.stockTransferService.getTransfer(tenantSlug, id);
    return ResponseHelper.success(data, 'Stock transfer retrieved successfully');
  }

  @Post(':tenantSlug/stock-transfers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate and dispatch stock transfer to another branch' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  async createTransfer(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateStockTransferDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.stockTransferService.createTransfer(tenantSlug, dto, user);
    return ResponseHelper.success(data, 'Stock transfer dispatched successfully');
  }

  @Post(':tenantSlug/stock-transfers/:id/receive')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm receipt of stock transfer at destination branch' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiParam({ name: 'id', example: 'transfer-uuid' })
  async receiveTransfer(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: ReceiveStockTransferDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.stockTransferService.receiveTransfer(tenantSlug, id, dto, user);
    return ResponseHelper.success(data, 'Stock transfer received and stock updated');
  }

  @Post(':tenantSlug/stock-transfers/:id/cancel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel in-transit stock transfer and restore stock' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiParam({ name: 'id', example: 'transfer-uuid' })
  async cancelTransfer(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.stockTransferService.cancelTransfer(tenantSlug, id, user);
    return ResponseHelper.success(data, 'Stock transfer cancelled');
  }
}
