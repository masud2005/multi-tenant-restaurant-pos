import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Bell,
  Check,
  CheckCheck,
  CircleDollarSign,
  ExternalLink,
  Inbox,
  Package,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  Users,
  Utensils,
} from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import {
  useDeleteNotificationMutation,
  useMarkNotificationsReadMutation,
  useMarkSingleNotificationReadMutation,
  useNotificationsQuery,
} from "@/app/api";
import { useRealtimeNotifications } from "@/features/notifications/use-realtime-notifications";
import { PageHeader, EmptyState, SkeletonCard } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/$tenantSlug/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Tablewise POS" },
      { name: "description", content: "View all real-time restaurant alerts, inventory warnings, and system notices." },
    ],
  }),
  component: () => (
    <RequirePermission perm="notifications.view">
      <NotificationsPage />
    </RequirePermission>
  ),
});

function NotificationsPage() {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  useRealtimeNotifications(tenant.id);
  const {
    data: notifications = [],
    isLoading,
    isFetching,
    refetch,
  } = useNotificationsQuery(tenant.id, {
    pollingInterval: 30000,
    refetchOnFocus: true,
  });
  const [markAllRead, { isLoading: marking }] = useMarkNotificationsReadMutation();
  const [markSingleRead] = useMarkSingleNotificationReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (filter === "unread" && n.read) return false;
    if (typeFilter !== "ALL" && n.type?.toUpperCase() !== typeFilter) return false;
    return true;
  });

  const handleMarkAll = async () => {
    try {
      await markAllRead(tenant.id).unwrap();
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("Couldn't update notifications.");
    }
  };

  const handleMarkSingle = async (notificationId: string) => {
    try {
      await markSingleRead({ tenantId: tenant.id, notificationId }).unwrap();
      toast.success("Marked as read");
    } catch {
      toast.error("Couldn't update notification");
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification({ tenantId: tenant.id, notificationId }).unwrap();
      toast.success("Notification removed");
    } catch {
      toast.error("Couldn't delete notification");
    }
  };

  const handleNavigate = (link?: string | null) => {
    if (!link) return;
    const target = link.startsWith("/app")
      ? link
      : `/app/${tenant.slug}${link.startsWith("/") ? link : `/${link}`}`;
    navigate({ to: target as any });
  };

  const getIcon = (type?: string, title?: string) => {
    const t = (type || title || "").toUpperCase();
    if (t.includes("INVENTORY") || t.includes("STOCK")) return <Package className="size-5 text-amber-500" />;
    if (t.includes("ORDER") || t.includes("KITCHEN")) return <Utensils className="size-5 text-blue-500" />;
    if (t.includes("RESERVATION") || t.includes("TABLE")) return <Users className="size-5 text-purple-500" />;
    if (t.includes("CASH") || t.includes("VARIANCE") || t.includes("PAYMENT"))
      return <CircleDollarSign className="size-5 text-emerald-500" />;
    if (t.includes("WELCOME") || t.includes("SYSTEM")) return <Sparkles className="size-5 text-primary" />;
    return <Tag className="size-5 text-muted-foreground" />;
  };

  const getTypeBadge = (type?: string) => {
    if (!type) return null;
    const map: Record<string, { label: string; className: string }> = {
      INVENTORY: { label: "Inventory", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
      ORDER: { label: "Order", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
      RESERVATION: { label: "Reservation", className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
      CASH: { label: "Cash & Shift", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
      STAFF: { label: "Staff", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
      SYSTEM: { label: "System", className: "bg-muted text-muted-foreground" },
    };
    const info = map[type.toUpperCase()];
    if (!info) return null;
    return (
      <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 ${info.className}`}>
        {info.label}
      </Badge>
    );
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return "Recently";
    try {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return "Recently";
      return formatDistanceToNow(parsed, { addSuffix: true });
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications Center"
        description={`Real-time operational alerts, inventory thresholds, and system notices for ${tenant.name}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
              title="Refresh notifications"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button variant="default" size="sm" onClick={handleMarkAll} disabled={marking} className="gap-2">
                <CheckCheck className="size-4" /> Mark all read
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              All Alerts
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {notifications.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unread" className="gap-2">
              Unread
              {unreadCount > 0 && (
                <Badge variant="default" className="text-xs px-1.5 py-0 bg-primary">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {["ALL", "INVENTORY", "ORDER", "RESERVATION", "CASH"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${
                typeFilter === t
                  ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {t === "ALL" ? "All Types" : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-8" />}
          title={filter === "unread" ? "No unread alerts" : "No notifications found"}
          description={
            filter === "unread"
              ? "You are completely caught up! Great job."
              : "Operational alerts from orders, stock, and reservations will appear here."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className={`transition-all duration-200 border ${
                item.read
                  ? "bg-card/60 border-border/60 opacity-90 hover:opacity-100"
                  : "bg-card border-primary/40 shadow-xs"
              }`}
            >
              <CardContent className="p-4 flex items-start gap-4">
                <div className="mt-0.5 rounded-full p-2.5 bg-muted/60 shrink-0">
                  {getIcon(item.type, item.title)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground flex items-center gap-2">
                        {item.title}
                        {!item.read && (
                          <span className="size-2 rounded-full bg-primary inline-block shrink-0" title="Unread alert" />
                        )}
                      </p>
                      {getTypeBadge(item.type)}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <div>
                      {item.link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleNavigate(item.link)}
                          className="h-7 px-2 text-xs text-primary font-medium hover:underline gap-1 -ml-2"
                        >
                          View Details
                          <ExternalLink className="size-3" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {!item.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMarkSingle(item.id)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Mark as read"
                        >
                          <Check className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="size-7 text-muted-foreground hover:text-destructive"
                        title="Delete notification"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
