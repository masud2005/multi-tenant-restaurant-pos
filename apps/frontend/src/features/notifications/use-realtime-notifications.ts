import { useEffect } from "react";
import { toast } from "sonner";
import { useAppDispatch } from "@/app/hooks";
import { api } from "@/app/api";
import { getNotificationSocket } from "@/services/socket-client";
import type { Notification } from "@/types/domain";

/**
 * Subscribes to real-time WebSocket notifications for the current tenant.
 * Automatically refreshes RTK Query cache and displays instant toast alerts.
 */
export function useRealtimeNotifications(
  tenantId: string,
  options?: { onNewNotification?: (n: Notification) => void }
) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!tenantId) return;

    const socket = getNotificationSocket(tenantId);

    const handleNew = (notification: Notification) => {
      // 1. Immediately invalidate RTK Query notifications tag to refresh UI in 0ms
      dispatch(api.util.invalidateTags(["Notification"]));

      // 2. Show live instant Toast notification
      toast(notification.title || "New Notification", {
        description: notification.body,
        duration: 5000,
      });

      options?.onNewNotification?.(notification);
    };

    const handleUpdated = () => {
      dispatch(api.util.invalidateTags(["Notification"]));
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:read", handleUpdated);
    socket.on("notification:all-read", handleUpdated);
    socket.on("notification:deleted", handleUpdated);
    socket.on("notifications:updated", handleUpdated);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:read", handleUpdated);
      socket.off("notification:all-read", handleUpdated);
      socket.off("notification:deleted", handleUpdated);
      socket.off("notifications:updated", handleUpdated);
    };
  }, [tenantId, dispatch]);
}
