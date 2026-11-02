import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderLineDto } from './dto/create-order-line.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { CreateOrderRefundDto } from './dto/create-order-refund.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { UpdateKitchenStatusDto } from './dto/update-kitchen-status.dto';
import { UpdateOrderDeliveryDto } from './dto/update-order-delivery.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('(Tenant) Orders & POS')
@Controller('tenants')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post(':tenantSlug/orders')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new order (POS Send / Send & Pay)',
    description:
      'Creates a new order with items, variants, modifiers, calculates tax and service charge, updates table status, and optionally handles immediate payment.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully and sent to kitchen',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Restaurant or branch not found' })
  async createOrder(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateOrderDto,
    @CurrentUser() currentUser: any,
  ) {
    const order = await this.orderService.createOrder(
      tenantSlug,
      dto,
      currentUser,
    );
    return ResponseHelper.created(
      order,
      `Order ${order.orderNumber} created successfully`,
    );
  }

  @Get(':tenantSlug/orders')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDERS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all orders with status and search filters',
    description:
      'Retrieves orders for POS, Kitchen Display System (KDS), or Orders list filtered by status (active, all, in_kitchen, etc.), branch, table, or search query.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getOrders(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetOrdersQueryDto,
  ) {
    const orders = await this.orderService.getOrders(tenantSlug, query);
    return ResponseHelper.success(orders, 'Orders retrieved successfully');
  }

  @Get(':tenantSlug/orders/:orderId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDERS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get details of a specific order',
    description:
      'Retrieves complete order details including lines, modifiers, payments, refunds, and table details.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'orderId',
    example: 'uuid',
    description: 'Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Order or restaurant not found' })
  async getOrderById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
  ) {
    const order = await this.orderService.getOrderById(tenantSlug, orderId);
    return ResponseHelper.success(order, 'Order retrieved successfully');
  }

  @Post(':tenantSlug/orders/:orderId/lines')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add more items to an active order (Running Order / Add-on)',
    description:
      'Adds additional line items and modifiers to an existing dining table or running order, re-computes subtotal, tax and total, and resets kitchen ticket to NEW.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'orderId',
    example: 'uuid',
    description: 'Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Items added to order successfully and sent to kitchen',
  })
  @ApiResponse({ status: 400, description: 'Order completed or cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async addOrderLines(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
    @Body() lines: CreateOrderLineDto[],
  ) {
    const order = await this.orderService.addOrderLines(
      tenantSlug,
      orderId,
      lines,
    );
    return ResponseHelper.success(
      order,
      `Items added to order ${order.orderNumber} successfully`,
    );
  }

  @Patch(':tenantSlug/orders/:orderId/kitchen/advance')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.KITCHEN_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Advance kitchen ticket workflow status',
    description:
      'Advances order through kitchen workflow: NEW -> PREPARING -> READY -> BUMPED. When set to READY, updates order status to READY and sets readyAt timestamp.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'orderId',
    example: 'uuid',
    description: 'Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Kitchen status advanced successfully',
  })
  @ApiResponse({ status: 400, description: 'Order cancelled or already bumped' })
  @ApiResponse({ status: 404, description: 'Order or restaurant not found' })
  async advanceKitchen(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
  ) {
    const order = await this.orderService.advanceKitchenStatus(
      tenantSlug,
      orderId,
    );
    return ResponseHelper.success(
      order,
      `Kitchen ticket advanced to ${order.kitchenStatus}`,
    );
  }

  @Patch(':tenantSlug/orders/:orderId/kitchen/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.KITCHEN_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update kitchen ticket status directly',
    description: 'Sets specific kitchen ticket status (NEW, PREPARING, READY, BUMPED).',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'orderId',
    example: 'uuid',
    description: 'Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Kitchen status updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid kitchen status or order cancelled' })
  @ApiResponse({ status: 404, description: 'Order or restaurant not found' })
  async updateKitchenStatus(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateKitchenStatusDto,
  ) {
    const order = await this.orderService.advanceKitchenStatus(
      tenantSlug,
      orderId,
      dto.kitchenStatus,
    );
    return ResponseHelper.success(
      order,
      `Kitchen ticket status set to ${order.kitchenStatus}`,
    );
  }

  @Patch(':tenantSlug/orders/:orderId/serve')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark order as served',
    description:
      'Marks order status as SERVED (food delivered to table). If order was fully prepaid, marks it COMPLETED and releases dining table to CLEANING.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'orderId',
    example: 'uuid',
    description: 'Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Order marked as served successfully',
  })
  @ApiResponse({ status: 404, description: 'Order or restaurant not found' })
  async markServed(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
  ) {
    const order = await this.orderService.markOrderServed(tenantSlug, orderId);
    return ResponseHelper.success(
      order,
      `Order ${order.orderNumber} marked as served`,
    );
  }

  @Post(':tenantSlug/orders/:orderId/payments')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PAYMENTS_PROCESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record a payment for an existing order (Take payment / Split bill)',
    description:
      'Creates a new payment record (CASH, CARD, MOBILE) for an active order, increments paid total, computes change, and marks order completed if served.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'orderId',
    example: 'uuid',
    description: 'Order ID',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment recorded successfully',
  })
  @ApiResponse({ status: 400, description: 'Order cancelled, already paid, or invalid amount' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async addPayment(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderPaymentDto,
  ) {
    const result = await this.orderService.addPayment(tenantSlug, orderId, dto);
    return ResponseHelper.created(
      result,
      `Payment of ${dto.amount} recorded successfully for order ${result.order.orderNumber}`,
    );
  }

  @Post(':tenantSlug/orders/:orderId/refunds')
  @Post(':tenantSlug/orders/:orderId/refund')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFUNDS_PROCESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Process a full or partial refund for an order',
    description:
      'Creates a new refund record for the order, validates refundable amount, updates refunded total, and creates finance audit ledger entries.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'orderId',
    example: 'ord-uuid',
    description: 'Order ID or orderNumber',
  })
  @ApiResponse({
    status: 201,
    description: 'Refund processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid refund amount or exceeds refundable balance',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async refundOrder(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderRefundDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.orderService.refundOrder(
      tenantSlug,
      orderId,
      dto,
      user,
    );
    return ResponseHelper.created(
      result,
      `Refund of ${dto.amount} processed successfully for order ${result.order?.orderNumber || orderId}`,
    );
  }

  @Patch(':tenantSlug/orders/:orderId/delivery')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELIVERY_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update delivery status and dispatch order',
    description:
      'Dispatches delivery order through delivery lifecycle: PENDING -> ASSIGNED -> OUT -> DELIVERED, assigns rider, validates kitchen readiness, and marks order served/completed upon delivery.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  @ApiParam({
    name: 'orderId',
    example: 'uuid',
    description: 'Order ID or Order Number',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Order cancelled, invalid status, or missing rider',
  })
  @ApiResponse({ status: 404, description: 'Order or rider not found' })
  @ApiResponse({ status: 409, description: 'Food not ready in kitchen' })
  async updateDelivery(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderDeliveryDto,
  ) {
    const order = await this.orderService.updateDeliveryStatus(
      tenantSlug,
      orderId,
      dto,
    );
    return ResponseHelper.success(
      order,
      `Order ${order.orderNumber} delivery status updated to ${order.deliveryStatus}`,
    );
  }

  @Patch(':tenantSlug/orders/:orderId/cancel')
  @Post(':tenantSlug/orders/:orderId/cancel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDERS_VOID)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Void / Cancel an active or unpaid order',
    description:
      'Cancels an active order, records the void reason in notes, releases any occupied dining table, and requires any paid balance to be fully refunded first.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'orderId',
    example: 'ord-uuid',
    description: 'Order ID or orderNumber',
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled / voided successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Order is completed or has unrefunded payments',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @Param('tenantSlug') tenantSlug: string,
    @Param('orderId') orderId: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: any,
  ) {
    const order = await this.orderService.cancelOrder(
      tenantSlug,
      orderId,
      dto,
      user,
    );
    return ResponseHelper.success(
      order,
      `Order ${order.orderNumber} has been voided / cancelled`,
    );
  }
}
