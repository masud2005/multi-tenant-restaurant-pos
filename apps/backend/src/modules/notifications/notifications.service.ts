import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto, GetNotificationsQueryDto } from './dto';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { Prisma } from '../../../prisma/generated/client';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Helper to resolve tenant by either slug or UUID
   */
  async resolveTenant(tenantSlugOrId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlugOrId }, { id: tenantSlugOrId }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    return tenant;
  }

  /**
   * Create a new notification for a tenant (and optionally a branch)
   * Broadcasts immediately via WebSocket Gateway
   */
  async create(tenantSlugOrId: string, dto: CreateNotificationDto) {
    const tenant = await this.resolveTenant(tenantSlugOrId);

    // Verify branch if provided
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId: tenant.id },
      });
      if (!branch) {
        dto.branchId = undefined;
      }
    }

    const created = await this.prisma.notification.create({
      data: {
        tenantId: tenant.id,
        branchId: dto.branchId || null,
        type: dto.type,
        title: dto.title.trim(),
        body: dto.body.trim(),
        link: dto.link?.trim() || '',
        metadata: dto.metadata ?? Prisma.JsonNull,
        read: false,
      },
    });

    // Real-time broadcast to all connected devices in this tenant's room
    try {
      this.notificationsGateway.sendNotificationToTenant(tenant.id, created);
    } catch {
      // Gateway emit failure should not block database persistence
    }

    return created;
  }

  /**
   * Retrieve notifications for a tenant with optional filters
   */
  async findAll(tenantSlugOrId: string, query: GetNotificationsQueryDto = {}) {
    const tenant = await this.resolveTenant(tenantSlugOrId);

    const where: Prisma.NotificationWhereInput = {
      tenantId: tenant.id,
    };

    if (query.unreadOnly === 'true') {
      where.read = false;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    const limit = query.limit ? Math.min(Math.max(parseInt(query.limit, 10), 1), 100) : 50;

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Count unread notifications for a tenant
   */
  async getUnreadCount(tenantSlugOrId: string) {
    const tenant = await this.resolveTenant(tenantSlugOrId);

    const count = await this.prisma.notification.count({
      where: {
        tenantId: tenant.id,
        read: false,
      },
    });

    return { count };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(tenantSlugOrId: string, notificationId: string) {
    const tenant = await this.resolveTenant(tenantSlugOrId);

    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId: tenant.id },
    });

    if (!notification) {
      throw new NotFoundException('Notification');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });

    try {
      this.notificationsGateway.sendNotificationRead(tenant.id, notification.id);
    } catch {
      // ignore
    }

    return updated;
  }

  /**
   * Mark all unread notifications as read for a tenant
   */
  async markAllAsRead(tenantSlugOrId: string) {
    const tenant = await this.resolveTenant(tenantSlugOrId);

    const result = await this.prisma.notification.updateMany({
      where: {
        tenantId: tenant.id,
        read: false,
      },
      data: {
        read: true,
      },
    });

    try {
      this.notificationsGateway.sendAllNotificationsRead(tenant.id);
    } catch {
      // ignore
    }

    return { count: result.count, ok: true };
  }

  /**
   * Delete a notification
   */
  async deleteNotification(tenantSlugOrId: string, notificationId: string) {
    const tenant = await this.resolveTenant(tenantSlugOrId);

    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId: tenant.id },
    });

    if (!notification) {
      throw new NotFoundException('Notification');
    }

    await this.prisma.notification.delete({
      where: { id: notification.id },
    });

    try {
      this.notificationsGateway.sendNotificationDeleted(tenant.id, notification.id);
    } catch {
      // ignore
    }

    return { ok: true };
  }
}
