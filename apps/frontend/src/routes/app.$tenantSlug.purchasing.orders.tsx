import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Ban, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useIngredientsQuery } from "@/app/api";
import { useDeletePurchaseOrderMutation, usePurchaseOrdersQuery, useSavePurchaseOrderMutation, useSetPurchaseOrderStatusMutation, useSuppliersQuery } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { PO_STATUS } from "@/features/backoffice/labels";
import { Confirm, DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/purchasing/orders")({
  head: () => ({ meta: [{ title: "Purchase orders — Tablewise POS" }, { name: "description", content: "Create and send purchase orders to suppliers." }] }),
  component: () => (
    <RequirePermission perm="purchasing.manage">
      <PurchaseOrders />
    </RequirePermission>
  ),
});

function PurchaseOrders() {
  const { tenant, branch } = useTenant();
  const money = useMoney();
  const pos = usePurchaseOrdersQuery({ tenantId: tenant.id, branchId: branch.id });
  const [setStatus] = useSetPurchaseOrderStatusMutation();
  const [del] = useDeletePurchaseOrderMutation();
  const [filter, setFilter] = useState<PurchaseOrderStatus | "all">("all");
  const [editing, setEditing] = useState<PurchaseOrder | "new" | null>(null);
  const rows = (pos.data ?? []).filter((p) => filter === "all" || p.status === filter);

  return (
    <div>
      <PageHeader title="Purchase orders" description={`${branch.name} branch`} actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New purchase order</Button>} />
      <div className="mb-4 flex flex-wrap gap-1">
        {(["all", "draft", "sent", "partial", "received", "cancelled"] as const).map((s) => (
          <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)} className={cn("rounded-full border px-3 py-1 text-sm", filter === s ? "border-foreground bg-foreground text-background" : "hover:bg-accent")}>
            {s === "all" ? "All" : PO_STATUS[s].label}
          </button>
        ))}
      </div>
      {pos.isLoading && <Skeleton className="h-48" />}
      {pos.isError && <ErrorState message="Couldn't load purchase orders." onRetry={pos.refetch} />}
      {pos.data && rows.length === 0 && <EmptyState title="No purchase orders" body="Create one to restock from a supplier." />}
      {rows.length > 0 && (
        <DataTable head={["PO", "Supplier", "Expected", "Lines", "Total", "Status", ""]}>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className={`${td} tabular font-semibold`}>{p.number}</td>
              <td className={td}>{p.supplierName}</td>
              <td className={`${td} text-muted-foreground`}>{p.expectedDate ? format(new Date(p.expectedDate), "MMM d") : "—"}</td>
              <td className={td}>{p.lines.length}</td>
              <td className={`${td} tabular`}>{money(p.total)}</td>
              <td className={td}><Badge variant={PO_STATUS[p.status].variant}>{PO_STATUS[p.status].label}</Badge></td>
              <td className={`${td} whitespace-nowrap text-right`}>
                {p.status === "draft" && (
                  <>
                    <Button size="icon" variant="ghost" aria-label={`Edit ${p.number}`} onClick={() => setEditing(p)}><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => withToast(setStatus({ tenantId: tenant.id, id: p.id, status: "sent" }), `${p.number} sent to ${p.supplierName} (simulated)`)}><Send className="size-4" /> Send</Button>
                  </>
                )}
                {(p.status === "sent" || p.status === "partial") && (
                  <Button size="sm" variant="outline" asChild><Link to="/app/$tenantSlug/purchasing/receiving" params={{ tenantSlug: tenant.slug }}>Receive</Link></Button>
                )}
                {(p.status === "draft" || p.status === "sent") && (
                  <Confirm
                    title={`Cancel ${p.number}?`}
                    body="The supplier order will be marked cancelled."
                    confirmLabel="Cancel order"
                    onConfirm={() => withToast(del({ tenantId: tenant.id, id: p.id }), `${p.number} cancelled`)}
                  >
                    <Button size="icon" variant="ghost" aria-label={`Cancel ${p.number}`}><Ban className="size-4" /></Button>
                  </Confirm>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {editing && <PoDialog po={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

interface Line {
  ingredientId: string;
  qty: string;
  unitCost: string;
}

function PoDialog({ po, onClose }: { po: PurchaseOrder | null; onClose: () => void }) {
  const { tenant, branch, user } = useTenant();
  const money = useMoney();
  const suppliers = useSuppliersQuery(tenant.id);
  const ings = useIngredientsQuery({ tenantId: tenant.id, branchId: branch.id });
  const [save, { isLoading }] = useSavePurchaseOrderMutation();
  const [supplierId, setSupplierId] = useState(po?.supplierId ?? "");
  const [expectedDate, setExpected] = useState(po?.expectedDate ?? new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState(po?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(po?.lines.map((l) => ({ ingredientId: l.ingredientId, qty: String(l.qty), unitCost: String(l.unitCost) })) ?? []);
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);
  const used = new Set(lines.map((l) => l.ingredientId));

  const suggest = () => {
    const low = (ings.data ?? []).filter((i) => i.stock <= i.reorderLevel && !used.has(i.id));
    setLines((ls) => [...ls, ...low.map((i) => ({ ingredientId: i.id, qty: String(Math.max(1, i.reorderLevel * 2 - i.stock)), unitCost: String(i.unitCost) }))]);
  };
  const update = (idx: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{po ? `Edit ${po.number}` : "New purchase order"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger aria-label="Supplier"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
                <SelectContent>{suppliers.data?.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="po-date">Expected delivery</Label><Input id="po-date" type="date" value={expectedDate} onChange={(e) => setExpected(e.target.value)} /></div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Lines</legend>
            {lines.map((l, idx) => {
              const ing = ings.data?.find((i) => i.id === l.ingredientId);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={l.ingredientId} onValueChange={(v) => update(idx, { ingredientId: v, unitCost: String(ings.data?.find((i) => i.id === v)?.unitCost ?? 0) })}>
                    <SelectTrigger aria-label="Ingredient" className="flex-1"><SelectValue placeholder="Ingredient" /></SelectTrigger>
                    <SelectContent>{(ings.data ?? []).filter((i) => i.id === l.ingredientId || !used.has(i.id)).map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.stock} {i.unit} on hand)</SelectItem>)}</SelectContent>
                  </Select>
                  <Input aria-label="Quantity" inputMode="decimal" className="w-24" placeholder={`Qty ${ing?.unit ?? ""}`} value={l.qty} onChange={(e) => update(idx, { qty: e.target.value })} />
                  <Input aria-label="Unit cost" inputMode="decimal" className="w-28" placeholder="Unit cost" value={l.unitCost} onChange={(e) => update(idx, { unitCost: e.target.value })} />
                  <Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button>
                </div>
              );
            })}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { ingredientId: "", qty: "", unitCost: "" }])}><Plus className="size-4" /> Add line</Button>
              <Button size="sm" variant="secondary" onClick={suggest}>Add low-stock items</Button>
            </div>
          </fieldset>
          <Textarea aria-label="Notes" placeholder="Notes for supplier" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          <p className="text-right text-sm">Total <span className="tabular ml-2 text-base font-bold">{money(total)}</span></p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={isLoading || !supplierId || lines.length === 0 || lines.some((l) => !l.ingredientId)}
            onClick={async () => {
              const r = await withToast(
                save({
                  tenantId: tenant.id,
                  id: po?.id,
                  branchId: branch.id,
                  supplierId,
                  expectedDate,
                  notes,
                  createdBy: user.name,
                  lines: lines.map((l) => ({ ingredientId: l.ingredientId, qty: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0 })),
                }),
                po ? "Purchase order updated" : "Draft purchase order created",
              );
              if (r) onClose();
            }}
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />} Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
