import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useOrdersQuery } from "@/app/api";
import { ORDER_STATUS, ORDER_TYPE_LABELS } from "@/features/orders/order-labels";
import { PageHeader, EmptyState, ErrorState } from "@/components/common/states";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUSES = ["active", "all", "in_kitchen", "ready", "served", "completed", "cancelled"] as const;
const PAGE = 15;

export const Route = createFileRoute("/app/$tenantSlug/orders")({
  validateSearch: z.object({
    status: z.enum(STATUSES).optional().catch("active"),
    q: z.string().optional().catch(""),
    page: z.number().int().min(1).optional().catch(1),
  }),
  head: () => ({ meta: [{ title: "Orders — Tablewise POS" }, { name: "description", content: "Track and manage orders." }] }),
  component: OrdersLayout,
});

function OrdersLayout() {
  const matchRoute = useMatchRoute();
  const isDetail = matchRoute({ to: "/app/$tenantSlug/orders/$orderId", fuzzy: true });
  return <RequirePermission perm="orders.view">{isDetail ? <Outlet /> : <OrdersList />}</RequirePermission>;
}

const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  active: "Active",
  all: "All",
  in_kitchen: "In kitchen",
  ready: "Ready",
  served: "Served",
  completed: "Completed",
  cancelled: "Voided",
};

function OrdersList() {
  const { tenant, branch } = useTenant();
  const money = useMoney();
  const navigate = useNavigate({ from: Route.fullPath });
  const { status = "active", q = "", page = 1 } = Route.useSearch();
  const [term, setTerm] = useState(q);
  useEffect(() => setTerm(q), [q]);
  const orders = useOrdersQuery({ tenantId: tenant.id, branchId: branch.id, status, search: q }, { pollingInterval: 10000 });
  const rows = orders.data ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div>
      <PageHeader title="Orders" description={`${branch.name} branch`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Status filter">
          {STATUSES.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              onClick={() => navigate({ search: (p) => ({ ...p, status: s, page: 1 }) })}
              className={cn("rounded-full border px-3 py-1 text-sm", status === s ? "border-foreground bg-foreground text-background" : "hover:bg-accent")}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <form
          role="search"
          className="relative ml-auto w-full sm:w-64"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: (p) => ({ ...p, q: term.trim(), page: 1 }) });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by Order #, guest name, table..." className="pl-8" aria-label="Search orders" />
        </form>
      </div>

      {orders.isLoading && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}
      {orders.isError && <ErrorState message="Couldn't load orders." onRetry={orders.refetch} />}
      {orders.data && rows.length === 0 && (
        <EmptyState
          title="No orders here"
          body={q ? `Nothing matches “${q}”.` : "New orders from the POS will appear here."}
          action={
            <Button asChild size="sm">
              <Link to="/app/$tenantSlug/pos" params={{ tenantSlug: tenant.slug }}>Open POS</Link>
            </Button>
          }
        />
      )}
      {view.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Guest / table</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Payment</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {view.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate({ to: "/app/$tenantSlug/orders/$orderId", params: { tenantSlug: tenant.slug, orderId: o.id } })}>
                  <td className="px-4 py-2.5">
                    <Link to="/app/$tenantSlug/orders/$orderId" params={{ tenantSlug: tenant.slug, orderId: o.id }} className="tabular font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{ORDER_TYPE_LABELS[o.type]}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{[o.tableName, o.customerName].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{format(new Date(o.createdAt), "MMM d, HH:mm")}</td>
                  <td className="px-4 py-2.5"><Badge variant={ORDER_STATUS[o.status].variant}>{ORDER_STATUS[o.status].label}</Badge></td>
                  <td className="px-4 py-2.5">
                    {o.paid >= o.totals.total ? <Badge variant="success">Paid</Badge> : o.paid > 0 ? <Badge variant="warning">Partial</Badge> : <Badge variant="muted">Unpaid</Badge>}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right font-medium">{money(o.totals.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => navigate({ search: (p) => ({ ...p, page: page - 1 }) })}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => navigate({ search: (p) => ({ ...p, page: page + 1 }) })}>Next</Button>
        </div>
      )}
    </div>
  );
}
