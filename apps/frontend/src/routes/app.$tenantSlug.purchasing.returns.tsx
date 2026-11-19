import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useIngredientsQuery } from "@/app/api";
import { useCreateSupplierReturnMutation, useSupplierReturnsQuery, useSuppliersQuery } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/app/$tenantSlug/purchasing/returns")({
  head: () => ({ meta: [{ title: "Supplier returns — Tablewise POS" }, { name: "description", content: "Return damaged or incorrect goods to suppliers." }] }),
  component: () => (
    <RequirePermission perm="purchasing.manage">
      <Returns />
    </RequirePermission>
  ),
});

function Returns() {
  const { tenant, branch } = useTenant();
  const money = useMoney();
  const list = useSupplierReturnsQuery({ tenantId: tenant.id, branchId: branch.id });
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader title="Supplier returns" description={`${branch.name} · returned goods leave stock immediately`} actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> New return</Button>} />
      {list.isLoading && <Skeleton className="h-40" />}
      {list.isError && <ErrorState message="Couldn't load returns." onRetry={list.refetch} />}
      {list.data?.length === 0 && <EmptyState title="No returns" body="Record damaged, expired or wrong deliveries here." />}
      {list.data && list.data.length > 0 && (
        <DataTable head={["Return", "Supplier", "Date", "Items", "Reason", "Credit due"]}>
          {list.data.map((r) => (
            <tr key={r.id}>
              <td className={`${td} tabular font-semibold`}>{r.number}</td>
              <td className={td}>{r.supplierName}</td>
              <td className={`${td} text-muted-foreground`}>{format(new Date(r.createdAt), "MMM d, HH:mm")}</td>
              <td className={`${td} text-xs`}>{r.lines.map((l) => `${l.name} ${l.qty}${l.unit}`).join(", ")}</td>
              <td className={td}>{r.reason}</td>
              <td className={`${td} tabular`}>{money(r.credit)}</td>
            </tr>
          ))}
        </DataTable>
      )}
      {open && <ReturnDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function ReturnDialog({ onClose }: { onClose: () => void }) {
  const { tenant, branch, user } = useTenant();
  const suppliers = useSuppliersQuery(tenant.id);
  const ings = useIngredientsQuery({ tenantId: tenant.id, branchId: branch.id });
  const [create, { isLoading }] = useCreateSupplierReturnMutation();
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<{ ingredientId: string; qty: string }[]>([{ ingredientId: "", qty: "" }]);
  const used = new Set(lines.map((l) => l.ingredientId));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New supplier return</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger aria-label="Supplier"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
              <SelectContent>{suppliers.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Items</legend>
            {lines.map((l, idx) => (
              <div key={idx} className="flex gap-2">
                <Select value={l.ingredientId} onValueChange={(v) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, ingredientId: v } : x)))}>
                  <SelectTrigger aria-label="Ingredient" className="flex-1"><SelectValue placeholder="Ingredient" /></SelectTrigger>
                  <SelectContent>{(ings.data ?? []).filter((i) => i.id === l.ingredientId || !used.has(i.id)).map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.stock} {i.unit})</SelectItem>)}</SelectContent>
                </Select>
                <Input aria-label="Quantity" inputMode="decimal" className="w-24" placeholder="0.00" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))} />
                <Button size="icon" variant="ghost" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { ingredientId: "", qty: "" }])}><Plus className="size-4" /> Add item</Button>
          </fieldset>
          <div className="space-y-1.5"><Label htmlFor="rt-reason">Reason</Label><Input id="rt-reason" placeholder="e.g. Damaged packaging, wrong specification, expired" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={isLoading || !supplierId || !reason.trim() || lines.some((l) => !l.ingredientId)}
            onClick={async () => {
              const r = await withToast(
                create({ tenantId: tenant.id, branchId: branch.id, supplierId, reason, createdBy: user.name, lines: lines.map((l) => ({ ingredientId: l.ingredientId, qty: Number(l.qty) || 0 })) }),
                "Return recorded and stock reduced",
              );
              if (r) onClose();
            }}
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />} Record return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
