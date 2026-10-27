import { io, Socket } from "socket.io-client";
import type { Notification } from "@/types/domain";

let socket: Socket | null = null;
let currentTenantId: string | null = null;

const SOCKET_SERVER_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_BACKEND_SOCKET_URL"]) ||
  "http://localhost:4000/notifications";

/**
 * Returns or initializes a shared Socket.IO connection for real-time notifications
 */
export function getNotificationSocket(tenantId: string): Socket {
  if (socket && currentTenantId === tenantId && socket.connected) {
    return socket;
  }

  if (socket && currentTenantId !== tenantId) {
    socket.emit("leaveTenant", { tenantId: currentTenantId });
    socket.disconnect();
    socket = null;
  }

  currentTenantId = tenantId;

  socket = io(SOCKET_SERVER_URL, {
    query: { tenantId },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    socket?.emit("joinTenant", { tenantId });
  });

  return socket;
}

/**
 * Cleanly disconnects the notification socket
 */
export function disconnectNotificationSocket() {
  if (socket) {
    if (currentTenantId) {
      socket.emit("leaveTenant", { tenantId: currentTenantId });
    }
    socket.disconnect();
    socket = null;
    currentTenantId = null;
  }
}

export type NotificationEventListener = (notification: Notification) => void;
export type NotificationsUpdatedListener = (data: { tenantId: string; action: string; notificationId?: string }) => void;
