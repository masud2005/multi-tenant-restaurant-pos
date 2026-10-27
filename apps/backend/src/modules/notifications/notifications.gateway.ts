import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: Socket) {
    const tenantId =
      client.handshake.query.tenantId ||
      client.handshake.headers['x-tenant-id'];

    if (tenantId && typeof tenantId === 'string') {
      const room = `tenant_${tenantId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} automatically joined room ${room}`);
    } else {
      this.logger.log(`Client ${client.id} connected to notification gateway`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('joinTenant')
  handleJoinTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    if (!data?.tenantId) {
      return { success: false, message: 'tenantId is required' };
    }
    const room = `tenant_${data.tenantId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('leaveTenant')
  handleLeaveTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    if (!data?.tenantId) return;
    const room = `tenant_${data.tenantId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  /**
   * Broadcast a newly created notification in real-time to all connected users of this tenant
   */
  sendNotificationToTenant(tenantId: string, notification: any) {
    const room = `tenant_${tenantId}`;
    this.logger.log(`Broadcasting new notification to room ${room}: ${notification.title}`);
    this.server.to(room).emit('notification:new', notification);
    // Also emit general notification event
    this.server.to(room).emit('notifications:updated', { tenantId, action: 'created' });
  }

  /**
   * Broadcast notification read status update
   */
  sendNotificationRead(tenantId: string, notificationId: string) {
    const room = `tenant_${tenantId}`;
    this.server.to(room).emit('notification:read', { tenantId, notificationId });
    this.server.to(room).emit('notifications:updated', { tenantId, action: 'read', notificationId });
  }

  /**
   * Broadcast mark-all-read update
   */
  sendAllNotificationsRead(tenantId: string) {
    const room = `tenant_${tenantId}`;
    this.server.to(room).emit('notification:all-read', { tenantId });
    this.server.to(room).emit('notifications:updated', { tenantId, action: 'all-read' });
  }

  /**
   * Broadcast notification deletion
   */
  sendNotificationDeleted(tenantId: string, notificationId: string) {
    const room = `tenant_${tenantId}`;
    this.server.to(room).emit('notification:deleted', { tenantId, notificationId });
    this.server.to(room).emit('notifications:updated', { tenantId, action: 'deleted', notificationId });
  }
}
