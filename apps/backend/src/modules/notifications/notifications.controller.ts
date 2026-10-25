import {
  Body,
  Controller,
  Delete,
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
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, GetNotificationsQueryDto } from './dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Notifications')
@Controller('tenants')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get(':tenantSlug/notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all notifications for the restaurant',
    description: 'Retrieves tenant notifications with optional filters for unread status, type, and branch.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getNotifications(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetNotificationsQueryDto,
  ) {
    const notifications = await this.notificationsService.findAll(tenantSlug, query);
    return ResponseHelper.success(notifications, 'Notifications retrieved successfully');
  }

  @Get(':tenantSlug/notifications/unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get count of unread notifications',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  async getUnreadCount(@Param('tenantSlug') tenantSlug: string) {
    const result = await this.notificationsService.getUnreadCount(tenantSlug);
    return ResponseHelper.success(result, 'Unread count retrieved successfully');
  }

  @Post(':tenantSlug/notifications')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a notification manually or via system integrations',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
  })
  async createNotification(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateNotificationDto,
  ) {
    const notification = await this.notificationsService.create(tenantSlug, dto);
    return ResponseHelper.created(notification, 'Notification created successfully');
  }

  @Patch(':tenantSlug/notifications/:notificationId/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark a specific notification as read',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'notificationId',
    example: 'notification-uuid',
  })
  async markAsRead(
    @Param('tenantSlug') tenantSlug: string,
    @Param('notificationId') notificationId: string,
  ) {
    const notification = await this.notificationsService.markAsRead(tenantSlug, notificationId);
    return ResponseHelper.success(notification, 'Notification marked as read');
  }

  @Post(':tenantSlug/notifications/mark-all-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark all notifications as read for the restaurant',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  async markAllAsRead(@Param('tenantSlug') tenantSlug: string) {
    const result = await this.notificationsService.markAllAsRead(tenantSlug);
    return ResponseHelper.success(result, 'All notifications marked as read');
  }

  @Delete(':tenantSlug/notifications/:notificationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a notification',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'notificationId',
    example: 'notification-uuid',
  })
  async deleteNotification(
    @Param('tenantSlug') tenantSlug: string,
    @Param('notificationId') notificationId: string,
  ) {
    const result = await this.notificationsService.deleteNotification(tenantSlug, notificationId);
    return ResponseHelper.success(result, 'Notification deleted successfully');
  }
}
