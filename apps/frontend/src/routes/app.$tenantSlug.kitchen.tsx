import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { Maximize2 } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useAdvanceKitchenMutation, useOrdersQuery } from "@/app/api";
import { errorMessage } from "@/app/base-api";
import { ORDER_TYPE_LABELS } from "@/features/orders/order-labels";
import { PageHeader, EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { KitchenStatus, Order } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/kitchen")({
  head: () => ({ meta: [{ title: "Kitchen display — Tablewise POS" }, { name: "description", content: "Live kitchen order tickets." }] }),
  component: () => (
    <RequirePermission perm="kitchen.view">
      <KitchenPage />
    </RequirePermission>
  ),
});

const COLUMNS: { status: KitchenStatus; title: string; action: string }[] = [
  { status: "new", title: "New", action: "Start" },
  { status: "preparing", title: "Preparing", action: "Mark ready" },
  { status: "ready", title: "Ready for pickup", action: "Bump" },
];

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function KitchenPage() {
  const { tenant, branch } = useTenant();
  const orders = useOrdersQuery({ tenantId: tenant.id, branchId: branch.id, status: "all" }, { pollingInterval: 5000 });
  const tickets = (orders.data ?? []).filter((o) => o.status !== "cancelled" && o.kitchenStatus !== "bumped").sort((a, b) => a.sentToKitchenAt.localeCompare(b.sentToKitchenAt));

  return (
    <div>
      <PageHeader
        title="Kitchen display"
        description={`${branch.name} · refreshes every 5 seconds`}
        actions={
          <Button variant="outline" size="sm" onClick={() => document.documentElement.requestFullscreen?.().catch(() => toast.error("Full screen isn't available here."))}>
            <Maximize2 className="size-4" /> Full screen
          </Button>
        }
      />
      {orders.isLoading && <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>}
      {orders.isError && <ErrorState message="Couldn't load tickets." onRetry={orders.refetch} />}
      {orders.data && (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((c) => {
            const list = tickets.filter((t) => t.kitchenStatus === c.status);
            return (
              <section key={c.status} aria-label={c.title} className="rounded-lg bg-muted/60 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
                  {c.title} <span className="tabular rounded-full bg-background px-2 text-xs">{list.length}</span>
                </h2>
                <div className="space-y-3">
                  {list.length === 0 && <EmptyState title="No tickets" />}
                  {list.map((o) => <Ticket key={o.id} order={o} action={c.action} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Ticket({ order, action }: { order: Order; action: string }) {
  const { tenant } = useTenant();
  const now = useNow();
  const [advance, { isLoading }] = useAdvanceKitchenMutation();
  const mins = differenceInMinutes(now, new Date(order.sentToKitchenAt));
  const late = mins >= 15 && order.kitchenStatus !== "ready";
  const handleAdvance = async () => {
    try {
      const res = await advance({ tenantId: tenant.id, orderId: order.id }).unwrap();
      const statusLabel =
        res.kitchenStatus === "preparing"
          ? "is now preparing"
          : res.kitchenStatus === "ready"
          ? "is ready for pickup"
          : "bumped";
      toast.success(`Ticket ${order.number} ${statusLabel}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <article className={cn("rounded-lg border bg-card shadow-sm", late && "border-destructive/60")}>
      <header className={cn("flex items-center justify-between rounded-t-lg border-b px-3 py-2", order.kitchenStatus === "ready" ? "bg-success/15" : late ? "bg-destructive/10" : "bg-primary-soft")}>
        <span className="tabular font-bold">{order.number}</span>
        <span className="text-xs">{ORDER_TYPE_LABELS[order.type]}{order.tableName && ` · ${order.tableName}`}</span>
        <span className={cn("tabular text-xs font-semibold", late && "text-destructive")}>{mins}m</span>
      </header>
      <ul className="space-y-1.5 px-3 py-2.5 text-sm">
        {order.lines.map((l) => (
          <li key={l.id}>
            <span className="tabular font-bold">{l.qty}×</span> {l.name}
            {l.variantName && <span className="text-muted-foreground"> ({l.variantName})</span>}
            {l.modifiers.length > 0 && <p className="pl-6 text-xs text-muted-foreground">{l.modifiers.map((m) => m.name).join(" · ")}</p>}
            {l.notes && <p className="pl-6 text-xs font-medium text-destructive">⚠ {l.notes}</p>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="border-t px-3 py-2 text-xs italic text-muted-foreground">{order.notes}</p>}
      <div className="border-t p-2">
        <Button
          className="w-full"
          size="sm"
          variant={order.kitchenStatus === "ready" ? "outline" : "default"}
          disabled={isLoading}
          onClick={handleAdvance}
        >
          {action}
        </Button>
      </div>
    </article>
  );
}
