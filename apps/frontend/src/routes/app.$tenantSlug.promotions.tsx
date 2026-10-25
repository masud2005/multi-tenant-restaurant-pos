import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarClock,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Trash2,
} from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import {
  useDeletePromotionMutation,
  usePromotionsQuery,
  useSavePromotionMutation,
} from "@/features/people/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { todayIso } from "@/services/people.service";
import { DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Field, num } from "@/components/common/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Promotion } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions & Discounts — Tablewise POS" },
      {
        name: "description",
        content: "Promo codes cashiers can apply at the POS.",
      },
    ],
  }),
  component: () => (
    <RequirePermission perm="promotions.manage">
      <Promotions />
    </RequirePermission>
  ),
});

type PromotionStatusKey = "live" | "scheduled" | "ended" | "used_up" | "paused";

function statusOf(p: Promotion): {
  key: PromotionStatusKey;
  label: string;
  variant: "success" | "info" | "warning" | "muted";
} {
  const today = todayIso();
  if (!p.active) return { key: "paused", label: "Paused", variant: "muted" };
  if (today < p.startsAt)
    return { key: "scheduled", label: "Scheduled", variant: "info" };
  if (today > p.endsAt)
    return { key: "ended", label: "Ended", variant: "muted" };
  if (p.maxUses !== null && p.uses >= p.maxUses)
    return { key: "used_up", label: "Used up", variant: "warning" };
  return { key: "live", label: "Live", variant: "success" };
}

function Promotions() {
  const { tenant } = useTenant();
  const money = useMoney();
  const list = usePromotionsQuery(tenant.id);
  const [save] = useSavePromotionMutation();
  const [deletePromo, deleteState] = useDeletePromotionMutation();
  const [editing, setEditing] = useState<Promotion | "new" | null>(null);
  const [deletingPromo, setDeletingPromo] = useState<Promotion | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | PromotionStatusKey>(
    "all"
  );
  const [search, setSearch] = useState("");

  const promotions = list.data ?? [];

  // Summary Metrics
  const metrics = useMemo(() => {
    let live = 0;
    let scheduled = 0;
    let ended = 0;
    let paused = 0;
    let totalUses = 0;

    for (const p of promotions) {
      totalUses += p.uses || 0;
      const st = statusOf(p).key;
      if (st === "live") live++;
      else if (st === "scheduled") scheduled++;
      else if (st === "ended" || st === "used_up") ended++;
      else if (st === "paused") paused++;
    }

    return { live, scheduled, ended, paused, totalUses, total: promotions.length };
  }, [promotions]);

  // Filtered List
  const filteredPromotions = useMemo(() => {
    return promotions.filter((p) => {
      // 1. Status Filter
      if (statusFilter !== "all") {
        const st = statusOf(p).key;
        if (statusFilter === "ended") {
          if (st !== "ended" && st !== "used_up") return false;
        } else if (st !== statusFilter) {
          return false;
        }
      }

      // 2. Search query filter (name or promo code)
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesCode = p.code.toLowerCase().includes(query);
        if (!matchesName && !matchesCode) return false;
      }

      return true;
    });
  }, [promotions, statusFilter, search]);

  const handleToggleActive = async (p: Promotion, nextActive: boolean) => {
    await withToast(
      save({
        tenantId: tenant.slug || tenant.id,
        id: p.id,
        name: p.name,
        code: p.code,
        kind: p.kind,
        value: p.value,
        minSpend: p.minSpend,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        maxUses: p.maxUses,
        active: nextActive,
      }),
      nextActive ? `"${p.code}" is now Active` : `"${p.code}" is now Paused`
    );
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPromo) return;
    const ok = await withToast(
      deletePromo({
        tenantId: tenant.slug || tenant.id,
        id: deletingPromo.id,
      }),
      `Promotion "${deletingPromo.code}" deleted`
    );
    if (ok) {
      setDeletingPromo(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions & Discounts"
        description="Create and manage coupon codes for POS checkout with date ranges, usage limits, and active status controls."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => list.refetch()}
              disabled={list.isFetching}
            >
              <RefreshCw
                className={cn("size-4 mr-1.5", list.isFetching && "animate-spin")}
              />
              Refresh
            </Button>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4 mr-1" /> New promotion
            </Button>
          </div>
        }
      />

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Live Now</p>
              <h3 className="text-2xl font-bold text-success mt-0.5">
                {metrics.live}
              </h3>
            </div>
            <div className="p-2.5 rounded-full bg-success/10 text-success">
              <Sparkles className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Scheduled (Upcoming)
              </p>
              <h3 className="text-2xl font-bold text-info mt-0.5">
                {metrics.scheduled}
              </h3>
            </div>
            <div className="p-2.5 rounded-full bg-info/10 text-info">
              <CalendarClock className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Total Redemptions
              </p>
              <h3 className="text-2xl font-bold text-primary mt-0.5">
                {metrics.totalUses}
              </h3>
            </div>
            <div className="p-2.5 rounded-full bg-primary/10 text-primary">
              <Ticket className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Ended / Used up
              </p>
              <h3 className="text-2xl font-bold text-muted-foreground mt-0.5">
                {metrics.ended}
              </h3>
            </div>
            <div className="p-2.5 rounded-full bg-muted text-muted-foreground">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-lg border w-fit">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "ghost"}
            className="h-8 text-xs font-medium"
            onClick={() => setStatusFilter("all")}
          >
            All ({metrics.total})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "live" ? "default" : "ghost"}
            className="h-8 text-xs font-medium"
            onClick={() => setStatusFilter("live")}
          >
            Live ({metrics.live})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "scheduled" ? "default" : "ghost"}
            className="h-8 text-xs font-medium"
            onClick={() => setStatusFilter("scheduled")}
          >
            Scheduled ({metrics.scheduled})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "ended" ? "default" : "ghost"}
            className="h-8 text-xs font-medium"
            onClick={() => setStatusFilter("ended")}
          >
            Ended ({metrics.ended})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "paused" ? "default" : "ghost"}
            className="h-8 text-xs font-medium"
            onClick={() => setStatusFilter("paused")}
          >
            Paused ({metrics.paused})
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {list.isLoading && <Skeleton className="h-48" />}
      {list.isError && (
        <ErrorState
          message="Couldn't load promotions."
          onRetry={list.refetch}
        />
      )}

      {list.data && filteredPromotions.length === 0 && (
        <EmptyState
          title={
            search || statusFilter !== "all"
              ? "No matching promotions"
              : "No promotions yet"
          }
          description={
            search || statusFilter !== "all"
              ? "Try clearing filters or searching with another keyword."
              : "Click 'New promotion' to create your first discount campaign."
          }
        />
      )}

      {list.data && filteredPromotions.length > 0 && (
        <DataTable
          head={[
            "Promotion",
            "Code",
            "Discount",
            "Min spend",
            "Validity (Runs)",
            "Uses / Max",
            "Status",
            "Active Toggle",
            "",
          ]}
        >
          {filteredPromotions.map((p) => {
            const st = statusOf(p);
            return (
              <tr key={p.id}>
                <td className={`${td} font-medium`}>{p.name}</td>
                <td className={`${td} font-mono font-semibold`}>
                  <span className="px-2 py-0.5 rounded bg-muted text-foreground border border-border/50 text-xs tracking-wide">
                    {p.code}
                  </span>
                </td>
                <td className={td}>
                  {p.kind === "percent" ? `${p.value}%` : money(p.value)}
                </td>
                <td className={td}>
                  {p.minSpend > 0 ? money(p.minSpend) : "—"}
                </td>
                <td className={`${td} whitespace-nowrap text-xs text-muted-foreground`}>
                  {format(new Date(p.startsAt), "d MMM yyyy")} –{" "}
                  {format(new Date(p.endsAt), "d MMM yyyy")}
                </td>
                <td className={td}>
                  <span className="font-semibold">{p.uses}</span>
                  {p.maxUses !== null ? (
                    <span className="text-muted-foreground"> / {p.maxUses}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground"> (Unlimited)</span>
                  )}
                </td>
                <td className={td}>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </td>
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={p.active}
                      onCheckedChange={(checked) => handleToggleActive(p, checked)}
                      aria-label={`Toggle active for ${p.name}`}
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {p.active ? "ON" : "OFF"}
                    </span>
                  </div>
                </td>
                <td className={`${td} text-right`}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setEditing(p)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => setDeletingPromo(p)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      {/* Create / Edit Dialog */}
      {editing && (
        <PromoDialog
          promo={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingPromo}
        onOpenChange={(o) => !o && setDeletingPromo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete promotion {deletingPromo?.code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingPromo?.name}</strong>? This promo code will be
              deactivated and removed from your promotions list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingPromo(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteState.isLoading}
              onClick={handleDeleteConfirm}
            >
              {deleteState.isLoading && (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PromoDialog({
  promo,
  onClose,
}: {
  promo: Promotion | null;
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const [save, { isLoading }] = useSavePromotionMutation();
  const today = todayIso();

  const [v, setV] = useState({
    name: promo?.name ?? "",
    code: promo?.code ?? "",
    kind: promo?.kind ?? ("percent" as "percent" | "amount"),
    value: String(promo?.value ?? ""),
    minSpend: String(promo?.minSpend ?? 0),
    startsAt: promo?.startsAt ?? today,
    endsAt: promo?.endsAt ?? today,
    maxUses: promo?.maxUses == null ? "" : String(promo.maxUses),
    active: promo?.active ?? true,
  });

  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {promo ? `Edit Promotion: ${promo.name}` : "Create New Promotion"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const maxUses = v.maxUses.trim() ? num(v.maxUses) : null;
            const input = {
              tenantId: tenant.slug || tenant.id,
              id: promo?.id,
              name: v.name,
              code: v.code,
              kind: v.kind,
              value: num(v.value),
              minSpend: num(v.minSpend) || 0,
              startsAt: v.startsAt,
              endsAt: v.endsAt,
              maxUses,
              active: v.active,
            };
            if (await withToast(save(input), "Promotion saved successfully")) {
              onClose();
            }
          }}
        >
          <Field label="Name" className="col-span-2">
            {(id) => (
              <Input
                id={id}
                value={v.name}
                maxLength={60}
                placeholder="e.g. Weekend Special 20%"
                onChange={set("name")}
                required
              />
            )}
          </Field>

          <Field label="Code">
            {(id) => (
              <Input
                id={id}
                value={v.code}
                maxLength={16}
                placeholder="e.g. WEEKEND20"
                className="uppercase font-mono"
                onChange={set("code")}
                required
              />
            )}
          </Field>

          <Field label="Type">
            {(id) => (
              <select
                id={id}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={v.kind}
                onChange={(e) =>
                  setV({ ...v, kind: e.target.value as "percent" | "amount" })
                }
              >
                <option value="percent">Percent off (%)</option>
                <option value="amount">Amount off (BDT)</option>
              </select>
            )}
          </Field>

          <Field label={v.kind === "percent" ? "Percent (%)" : "Amount (BDT)"}>
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={v.value}
                placeholder={v.kind === "percent" ? "20" : "150"}
                onChange={set("value")}
                required
              />
            )}
          </Field>

          <Field label="Minimum spend (BDT)">
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={v.minSpend}
                placeholder="0 for no minimum"
                onChange={set("minSpend")}
              />
            )}
          </Field>

          <Field label="Starts (From)">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={v.startsAt}
                onChange={set("startsAt")}
                required
              />
            )}
          </Field>

          <Field label="Ends (Until)">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={v.endsAt}
                onChange={set("endsAt")}
                required
              />
            )}
          </Field>

          <Field
            label="Max uses"
            hint="Leave blank for unlimited"
            className="col-span-2"
          >
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                value={v.maxUses}
                placeholder="e.g. 100"
                onChange={set("maxUses")}
              />
            )}
          </Field>

          <div className="col-span-2 p-3 rounded-lg border bg-muted/40 space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">Active Status</span>
                <p className="text-xs text-muted-foreground">
                  {v.active
                    ? "Promotion is ON and can be applied at POS."
                    : "Promotion is OFF (Draft / Paused)."}
                </p>
              </div>
              <Switch
                checked={v.active}
                onCheckedChange={(a) => setV({ ...v, active: a })}
              />
            </div>
          </div>

          <DialogFooter className="col-span-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Save Promotion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
