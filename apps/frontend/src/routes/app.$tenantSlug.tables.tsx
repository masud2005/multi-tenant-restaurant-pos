import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Circle, Loader2, Pencil, Plus, RectangleHorizontal, Square, Trash2, Users } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import {
  useCreateTableMutation,
  useDeleteTableMutation,
  useOrdersQuery,
  useSetTableStatusMutation,
  useTablesQuery,
  useUpdateTableMutation,
} from "@/app/api";
import { errorMessage } from "@/app/base-api";
import { useAppDispatch } from "@/app/hooks";
import { cartActions } from "@/features/pos/cart.slice";
import { ORDER_STATUS } from "@/features/orders/order-labels";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { PageHeader, ErrorState } from "@/components/common/states";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { DiningTable, TableStatus } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/tables")({
  head: () => ({ meta: [{ title: "Tables — Tablewise POS" }, { name: "description", content: "Live floor plan and table status." }] }),
  component: () => (
    <RequirePermission perm="tables.view">
      <TablesPage />
    </RequirePermission>
  ),
});

const STATUS_STYLE: Record<TableStatus, string> = {
  available: "border-success/50 bg-success/10",
  occupied: "border-primary bg-primary-soft",
  reserved: "border-info/50 bg-info/10",
  cleaning: "border-warning/60 bg-warning/15",
};
const STATUS_LABEL: Record<TableStatus, string> = { available: "Available", occupied: "Occupied", reserved: "Reserved", cleaning: "Needs cleaning" };

function TablesPage() {
  const { tenant, branch, can } = useTenant();
  const money = useMoney();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const tables = useTablesQuery({ tenantId: tenant.id, branchId: branch.id }, { pollingInterval: 10000 });
  const orders = useOrdersQuery({ tenantId: tenant.id, branchId: branch.id, status: "active" });
  const [setStatus, { isLoading }] = useSetTableStatusMutation();
  const [deleteTableMutation, { isLoading: isDeleting }] = useDeleteTableMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TableStatus | "all">("all");
  const [isCreating, setIsCreating] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [deletingTable, setDeletingTable] = useState<DiningTable | null>(null);
  const selected = tables.data?.find((t) => t.id === selectedId) ?? null;
  const areas = useMemo(() => [...new Set((tables.data ?? []).map((t) => t.area))], [tables.data]);
  const orderFor = (t: DiningTable) => orders.data?.find((o) => o.id === t.currentOrderId);
  const counts = (tables.data ?? []).reduce<Record<string, number>>((a, t) => ({ ...a, [t.status]: (a[t.status] ?? 0) + 1 }), {});

  const change = (status: TableStatus) =>
    selected &&
    setStatus({ tenantId: tenant.id, tableId: selected.id, status })
      .unwrap()
      .then(() => toast.success(`${selected.name} is now ${STATUS_LABEL[status].toLowerCase()}`))
      .catch((e) => toast.error(errorMessage(e)));

  const handleDelete = async () => {
    if (!deletingTable) return;
    const res = await withToast(
      deleteTableMutation({
        tenantId: tenant.id,
        tableId: deletingTable.id,
      }),
      `Table "${deletingTable.name}" deleted successfully`,
    );
    if (res) {
      if (selectedId === deletingTable.id) setSelectedId(null);
      setDeletingTable(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Tables"
        description={`${branch.name} floor plan`}
        actions={
          can("tables.manage") && (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-1.5 size-4" /> New table
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {(["all", "available", "occupied", "reserved", "cleaning"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} className={cn("rounded-full border px-3 py-1 text-sm", filter === s ? "border-foreground bg-foreground text-background" : "hover:bg-accent")}>
            {s === "all" ? "All" : STATUS_LABEL[s]} <span className="tabular opacity-70">{s === "all" ? tables.data?.length ?? 0 : counts[s] ?? 0}</span>
          </button>
        ))}
      </div>
      {tables.isLoading && <Skeleton className="h-80" />}
      {tables.isError && <ErrorState message="Couldn't load tables." onRetry={tables.refetch} />}
      <div className="space-y-6">
        {areas.map((area) => (
          <section key={area} aria-label={area}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{area}</h2>
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-dashed bg-card/50 p-4 sm:grid-cols-3 lg:grid-cols-5">
              {(tables.data ?? [])
                .filter((t) => t.area === area && (filter === "all" || t.status === filter))
                .map((t) => {
                  const o = orderFor(t);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "flex aspect-square flex-col items-center justify-center border-2 p-2 text-center transition-transform hover:scale-[1.03]",
                        t.shape === "round" ? "rounded-full" : "rounded-xl",
                        t.shape === "long" && "aspect-[2/1] sm:col-span-2",
                        STATUS_STYLE[t.status],
                      )}
                    >
                      <span className="font-display text-lg font-bold">{t.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3" aria-hidden />{t.seats}</span>
                      <span className="mt-1 text-[11px] font-medium">{o ? `${o.number} · ${money(o.totals.total)}` : STATUS_LABEL[t.status]}</span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Table {selected.name}</SheetTitle>
                <SheetDescription>{selected.seats} seats · {selected.area} · {STATUS_LABEL[selected.status]}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3 px-4">
                {selected.status === "occupied" && orderFor(selected) ? (
                  <>
                    <div className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="tabular font-semibold">{orderFor(selected)!.number}</span>
                        <Badge variant={ORDER_STATUS[orderFor(selected)!.status].variant}>{ORDER_STATUS[orderFor(selected)!.status].label}</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{orderFor(selected)!.lines.reduce((s, l) => s + l.qty, 0)} items · {money(orderFor(selected)!.totals.total)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {can("pos.use") && (
                        <Button
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                          onClick={() => {
                            dispatch(cartActions.setTable(selected.id));
                            navigate({ to: "/app/$tenantSlug/pos", params: { tenantSlug: tenant.slug } });
                          }}
                        >
                          <Plus className="mr-1.5 size-4" /> Add items
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate({ to: "/app/$tenantSlug/orders/$orderId", params: { tenantSlug: tenant.slug, orderId: selected.currentOrderId! } })}
                      >
                        Open order
                      </Button>
                    </div>
                  </>
                ) : (
                  can("pos.use") && (
                    <Button
                      className="w-full"
                      onClick={() => {
                        dispatch(cartActions.setTable(selected.id));
                        navigate({ to: "/app/$tenantSlug/pos", params: { tenantSlug: tenant.slug } });
                      }}
                    >
                      Start order at {selected.name}
                    </Button>
                  )
                )}
                {can("tables.manage") && selected.status !== "occupied" && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {(["available", "reserved", "cleaning"] as const).map((s) => (
                      <Button key={s} size="sm" variant={selected.status === s ? "secondary" : "outline"} disabled={isLoading || selected.status === s} onClick={() => change(s)}>
                        {s === "cleaning" ? "Cleaning" : STATUS_LABEL[s]}
                      </Button>
                    ))}
                  </div>
                )}

                {can("tables.manage") && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Management
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setEditingTable(selected)}
                      >
                        <Pencil className="mr-1.5 size-3.5" /> Edit details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={selected.status === "occupied"}
                        onClick={() => setDeletingTable(selected)}
                      >
                        <Trash2 className="mr-1.5 size-3.5" /> Delete table
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {isCreating && (
        <CreateTableDialog
          existingAreas={areas}
          onClose={() => setIsCreating(false)}
        />
      )}

      {editingTable && (
        <EditTableDialog
          table={editingTable}
          existingAreas={areas}
          onClose={() => setEditingTable(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTable} onOpenChange={(o) => !o && setDeletingTable(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete table &quot;{deletingTable?.name}&quot;? It will be removed from {branch.name}&apos;s floor plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setDeletingTable(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateTableDialog({
  existingAreas,
  onClose,
}: {
  existingAreas: string[];
  onClose: () => void;
}) {
  const { tenant, branch } = useTenant();
  const [createTable, { isLoading }] = useCreateTableMutation();
  const [name, setName] = useState("");
  const [seats, setSeats] = useState<number>(4);
  const [area, setArea] = useState(existingAreas[0] || "Main hall");
  const [shape, setShape] = useState<"square" | "round" | "long">("square");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await withToast(
      createTable({
        tenantId: tenant.id,
        branchId: branch.id,
        name: name.trim(),
        seats: Number(seats) || 4,
        area: area.trim() || "Main hall",
        shape,
      }),
      `Table "${name.trim()}" created successfully`,
    );
    if (res) onClose();
  };

  const commonSeats = [2, 4, 6, 8, 10];
  const shapes: Array<{ id: "square" | "round" | "long"; label: string; icon: React.ReactNode }> = [
    { id: "square", label: "Square", icon: <Square className="size-4" /> },
    { id: "round", label: "Round", icon: <Circle className="size-4" /> },
    { id: "long", label: "Long / Banquet", icon: <RectangleHorizontal className="size-4" /> },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Table</DialogTitle>
          <DialogDescription>
            Add a table to {branch.name}&apos;s floor plan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Table Name */}
          <Field label="Table Name / Number" hint="e.g. T-1, T-2, VIP-1, Terrace-A">
            {(id) => (
              <Input
                id={id}
                required
                autoFocus
                placeholder="e.g. T-5"
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>

          {/* Area / Section */}
          <Field label="Floor Section / Area" hint="Select an existing section or type a new one">
            {(id) => (
              <div className="space-y-2">
                <Input
                  id={id}
                  required
                  placeholder="e.g. Main hall, Terrace, VIP"
                  value={area}
                  maxLength={30}
                  onChange={(e) => setArea(e.target.value)}
                />
                {existingAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {existingAreas.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setArea(a)}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                          area === a
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border/60 hover:bg-muted text-muted-foreground",
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          {/* Capacity / Seats */}
          <Field label="Seats (Capacity)">
            {(id) => (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={seats}
                    onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {commonSeats.map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={seats === n ? "secondary" : "outline"}
                        className="h-9 px-2.5 text-xs"
                        onClick={() => setSeats(n)}
                      >
                        {n} seats
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Field>

          {/* Table Shape */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Table Shape</label>
            <div className="grid grid-cols-3 gap-2">
              {shapes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShape(s.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all",
                    shape === s.id
                      ? "border-primary bg-primary/10 text-primary shadow-xs font-semibold"
                      : "border-border hover:bg-muted/60 text-muted-foreground",
                  )}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Preview on floor</p>
            <div className="flex items-center justify-center p-2">
              <div
                className={cn(
                  "flex flex-col items-center justify-center border-2 border-success/50 bg-success/10 p-2 text-center transition-all",
                  shape === "round" ? "size-24 rounded-full" : "rounded-xl",
                  shape === "square" && "size-24",
                  shape === "long" && "h-20 w-40",
                )}
              >
                <span className="font-display text-base font-bold text-foreground">
                  {name.trim() || "Table"}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3" aria-hidden />
                  {seats}
                </span>
                <span className="mt-0.5 text-[10px] font-medium text-success-foreground">Available</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Create Table
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTableDialog({
  table,
  existingAreas,
  onClose,
}: {
  table: DiningTable;
  existingAreas: string[];
  onClose: () => void;
}) {
  const { branch } = useTenant();
  const [updateTable, { isLoading }] = useUpdateTableMutation();
  const [name, setName] = useState(table.name);
  const [seats, setSeats] = useState<number>(table.seats);
  const [area, setArea] = useState(table.area || "Main hall");
  const [shape, setShape] = useState<"square" | "round" | "long">(table.shape || "square");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await withToast(
      updateTable({
        tenantId: table.tenantId,
        tableId: table.id,
        name: name.trim(),
        seats: Number(seats) || 4,
        area: area.trim() || "Main hall",
        shape,
      }),
      `Table "${name.trim()}" updated successfully`,
    );
    if (res) onClose();
  };

  const commonSeats = [2, 4, 6, 8, 10];
  const shapes: Array<{ id: "square" | "round" | "long"; label: string; icon: React.ReactNode }> = [
    { id: "square", label: "Square", icon: <Square className="size-4" /> },
    { id: "round", label: "Round", icon: <Circle className="size-4" /> },
    { id: "long", label: "Long / Banquet", icon: <RectangleHorizontal className="size-4" /> },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Table</DialogTitle>
          <DialogDescription>
            Update details for &quot;{table.name}&quot; in {branch.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Table Name */}
          <Field label="Table Name / Number" hint="e.g. T-1, T-2, VIP-1, Terrace-A">
            {(id) => (
              <Input
                id={id}
                required
                autoFocus
                placeholder="e.g. T-5"
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>

          {/* Area / Section */}
          <Field label="Floor Section / Area" hint="Select an existing section or type a new one">
            {(id) => (
              <div className="space-y-2">
                <Input
                  id={id}
                  required
                  placeholder="e.g. Main hall, Terrace, VIP"
                  value={area}
                  maxLength={30}
                  onChange={(e) => setArea(e.target.value)}
                />
                {existingAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {existingAreas.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setArea(a)}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                          area === a
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border/60 hover:bg-muted text-muted-foreground",
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          {/* Capacity / Seats */}
          <Field label="Seats (Capacity)">
            {(id) => (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={seats}
                    onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {commonSeats.map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={seats === n ? "secondary" : "outline"}
                        className="h-9 px-2.5 text-xs"
                        onClick={() => setSeats(n)}
                      >
                        {n} seats
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Field>

          {/* Table Shape */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Table Shape</label>
            <div className="grid grid-cols-3 gap-2">
              {shapes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShape(s.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all",
                    shape === s.id
                      ? "border-primary bg-primary/10 text-primary shadow-xs font-semibold"
                      : "border-border hover:bg-muted/60 text-muted-foreground",
                  )}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Preview on floor</p>
            <div className="flex items-center justify-center p-2">
              <div
                className={cn(
                  "flex flex-col items-center justify-center border-2 border-primary/50 bg-primary/10 p-2 text-center transition-all",
                  shape === "round" ? "size-24 rounded-full" : "rounded-xl",
                  shape === "square" && "size-24",
                  shape === "long" && "h-20 w-40",
                )}
              >
                <span className="font-display text-base font-bold text-foreground">
                  {name.trim() || "Table"}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3" aria-hidden />
                  {seats}
                </span>
                <span className="mt-0.5 text-[10px] font-medium text-primary">
                  {table.status ? table.status.charAt(0).toUpperCase() + table.status.slice(1) : "Available"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
