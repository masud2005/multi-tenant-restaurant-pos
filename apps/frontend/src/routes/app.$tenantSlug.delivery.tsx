import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bike, CheckCircle2, Edit2, MapPin, Phone, Plus, Trash2, Users } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import {
  useDeliveriesQuery,
  useDeleteRiderMutation,
  useRidersQuery,
  useSaveRiderMutation,
  useUpdateDeliveryMutation,
} from "@/features/people/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DeliveryStatus, Order, Rider } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery — Tablewise POS" },
      { name: "description", content: "Assign riders and track delivery orders." },
    ],
  }),
  component: () => (
    <RequirePermission perm="delivery.manage">
      <Delivery />
    </RequirePermission>
  ),
});

const COLUMNS: { status: DeliveryStatus; label: string }[] = [
  { status: "pending", label: "Awaiting rider" },
  { status: "assigned", label: "Rider assigned" },
  { status: "out", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

function Delivery() {
  const { tenant, branch } = useTenant();
  const list = useDeliveriesQuery(
    { tenantId: tenant.id, branchId: branch.id },
    { pollingInterval: 15000 }
  );
  const riders = useRidersQuery({ tenantId: tenant.id, branchId: branch.id });

  return (
    <div>
      <PageHeader
        title="Delivery"
        description="Delivery orders are created from the POS terminal."
        actions={
          <div className="flex items-center gap-2">
            <ManageRidersDialog />
            <AddRider />
          </div>
        }
      />
      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && (
        <ErrorState message="Couldn't load deliveries." onRetry={list.refetch} />
      )}
      {list.data && list.data.length === 0 && (
        <EmptyState
          icon={<Bike className="size-8" />}
          title="No delivery orders yet"
          body="Choose “Delivery” on the POS and enter an address."
        />
      )}
      {list.data && list.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = (list.data ?? []).filter(
              (o) => o.delivery?.status === col.status
            );
            return (
              <section
                key={col.status}
                aria-label={col.label}
                className="rounded-lg border bg-muted/30 p-3 flex flex-col"
              >
                <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
                  {col.label} <Badge variant="muted">{items.length}</Badge>
                </h2>
                <div className="space-y-2 flex-1">
                  {items.map((o) => (
                    <DeliveryCard key={o.id} o={o} riders={riders.data ?? []} />
                  ))}
                  {items.length === 0 && (
                    <div className="h-20 flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                      None
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeliveryCard({
  o,
  riders,
}: {
  o: Order;
  riders: { id: string; name: string }[];
}) {
  const { tenant } = useTenant();
  const money = useMoney();
  const [update, { isLoading }] = useUpdateDeliveryMutation();
  const [rider, setRider] = useState("");
  const d = o.delivery;
  if (!d) return null;

  const ready = o.kitchenStatus === "ready" || o.kitchenStatus === "bumped";
  const go = (status: DeliveryStatus, msg: string, riderId?: string) =>
    withToast(
      update({ tenantId: tenant.id, orderId: o.id, status, riderId }),
      msg
    );

  return (
    <article className="rounded-md border bg-card p-3 text-sm shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <Link
            to="/app/$tenantSlug/orders/$orderId"
            params={{ tenantSlug: tenant.slug, orderId: o.id }}
            className="font-semibold hover:underline"
          >
            {o.number}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="mt-1">
          {o.customerName || "Guest"} · {o.customerPhone || "No phone"}
        </p>
        <p className="mt-1 flex gap-1 text-muted-foreground text-xs">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{d.address || "No address provided"}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant={ready ? "success" : "warning"}>
            {ready ? "Food ready" : "In kitchen"}
          </Badge>
          <Badge variant={o.paid >= o.totals.total ? "success" : "danger"}>
            {o.paid >= o.totals.total
              ? "Paid"
              : `Due ${money(o.totals.total - o.paid)}`}
          </Badge>
          {d.riderName && <Badge variant="info">Rider: {d.riderName}</Badge>}
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-border/50">
        {d.status === "pending" && (
          <div className="flex gap-2">
            <Select value={rider} onValueChange={setRider}>
              <SelectTrigger
                aria-label={`Rider for ${o.number}`}
                className="h-8"
              >
                <SelectValue placeholder="Choose rider" />
              </SelectTrigger>
              <SelectContent>
                {riders.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground text-center">
                    No riders yet. Add rider first.
                  </div>
                ) : (
                  riders.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!rider || isLoading}
              onClick={() => go("assigned", "Rider assigned", rider)}
            >
              Assign
            </Button>
          </div>
        )}
        {d.status === "assigned" && (
          <div className="space-y-1.5">
            <Button
              size="sm"
              className="w-full"
              disabled={isLoading || !ready}
              onClick={() => go("out", "Out for delivery")}
              title={
                !ready ? "Wait until the kitchen marks the order ready" : undefined
              }
            >
              Dispatch Order
            </Button>
            {!ready && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
                Awaiting kitchen completion
              </p>
            )}
          </div>
        )}
        {d.status === "out" && (
          <Button
            size="sm"
            className="w-full"
            disabled={isLoading}
            onClick={() => go("delivered", "Marked delivered")}
          >
            Mark delivered
          </Button>
        )}
        {d.status === "delivered" && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium py-1">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Delivered</span>
          </div>
        )}
      </div>
    </article>
  );
}

function AddRider() {
  const { tenant, branch } = useTenant();
  const [save, { isLoading }] = useSaveRiderMutation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-4" /> Add rider
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await withToast(
                save({
                  tenantId: tenant.id,
                  branchId: branch.id,
                  name,
                  phone,
                }),
                "Rider added"
              )
            ) {
              setName("");
              setPhone("");
            }
          }}
        >
          <p className="text-xs font-semibold text-muted-foreground">
            Quick Add Rider
          </p>
          <Input
            aria-label="Rider name"
            placeholder="Name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            aria-label="Rider phone"
            placeholder="Phone"
            value={phone}
            maxLength={20}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={isLoading || !name.trim()}
          >
            Save rider
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function ManageRidersDialog() {
  const { tenant, branch } = useTenant();
  const ridersQuery = useRidersQuery({
    tenantId: tenant.id,
    branchId: branch.id,
  });
  const [saveRider, { isLoading: isSaving }] = useSaveRiderMutation();
  const [deleteRider, { isLoading: isDeleting }] = useDeleteRiderMutation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPhone("");
  };

  const handleEdit = (r: Rider) => {
    setEditingId(r.id);
    setName(r.name);
    setPhone(r.phone);
  };

  const handleDelete = async (id: string, riderName: string) => {
    if (!confirm(`Are you sure you want to remove rider "${riderName}"?`)) return;
    await withToast(
      deleteRider({ tenantId: tenant.id, id }),
      `Rider ${riderName} removed`
    );
    if (editingId === id) resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await withToast(
      saveRider({
        tenantId: tenant.id,
        id: editingId || undefined,
        branchId: branch.id,
        name: name.trim(),
        phone: phone.trim(),
      }),
      editingId ? "Rider updated" : "Rider added"
    );
    if (ok) {
      resetForm();
    }
  };

  const list = ridersQuery.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users className="size-4" />
          <span>Manage riders ({list.length})</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Delivery Riders</DialogTitle>
          <DialogDescription>
            Register and manage active riders stationed at {branch.name}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-lg border bg-muted/40 p-3"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {editingId ? "Edit Rider" : "Add New Rider"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Rider Name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              placeholder="Phone (e.g. +8801...)"
              value={phone}
              maxLength={20}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isSaving || !name.trim()}>
              {editingId ? "Update rider" : "Add rider"}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Rider Roster ({list.length})
          </p>
          {ridersQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No riders registered for this branch yet.
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-border/50">
              {list.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between pt-1.5 first:pt-0"
                >
                  <div className="text-sm">
                    <p className="font-medium leading-none">{r.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="size-3" />
                      {r.phone || "No phone"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleEdit(r)}
                      title="Edit rider"
                    >
                      <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(r.id, r.name)}
                      disabled={isDeleting}
                      title="Delete rider"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
