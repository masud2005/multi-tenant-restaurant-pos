import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2, PackageCheck } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { usePurchaseOrdersQuery, useReceiptsQuery, useReceiveGoodsMutation } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { PO_STATUS } from "@/features/backoffice/labels";
import { DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PurchaseOrder } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/purchasing/receiving")({
  head: () => ({ meta: [{ title: "Receiving — Tablewise POS" }, { name: "description", content: "Receive supplier deliveries into stock." }] }),
  component: () => (
    <RequirePermission perm="purchasing.manage">
      <Receiving />
    </RequirePermission>
  ),
});

function Receiving() {
  const { tenant, branch } = useTenant();
  const money = useMoney();
  const pos = usePurchaseOrdersQuery({ tenantId: tenant.id, branchId: branch.id });
  const grns = useReceiptsQuery({ tenantId: tenant.id, branchId: branch.id });
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const open = (pos.data ?? []).filter((p) => p.status === "sent" || p.status === "partial");

  return (
    <div className="space-y-8">
      <PageHeader title="Receiving" description={`Deliveries for ${branch.name}. Received goods are added to stock and update ingredient costs.`} />
      <section aria-label="Awaiting delivery">
        <h2 className="mb-3 text-sm font-semibold">Awaiting delivery</h2>
        {pos.isLoading && <Skeleton className="h-32" />}
        {pos.isError && <ErrorState message="Couldn't load purchase orders." onRetry={pos.refetch} />}
        {pos.data && open.length === 0 && <EmptyState title="Nothing to receive" body="Send a purchase order first." />}
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((p) => (
            <article key={p.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
              <div className="flex-1">
                <p className="font-semibold"><span className="tabular">{p.number}</span> · {p.supplierName}</p>
                <p className="text-sm text-muted-foreground">{p.lines.length} lines · {money(p.total)} · expected {p.expectedDate ? format(new Date(p.expectedDate), "MMM d") : "—"}</p>
                <Badge variant={PO_STATUS[p.status].variant} className="mt-2">{PO_STATUS[p.status].label}</Badge>
              </div>
              <Button onClick={() => setReceiving(p)}><PackageCheck className="size-4" /> Receive</Button>
            </article>
          ))}
        </div>
      </section>
      <section aria-label="Goods received">
        <h2 className="mb-3 text-sm font-semibold">Goods received notes</h2>
        {grns.data?.length === 0 && <EmptyState title="No deliveries received yet" />}
        {grns.data && grns.data.length > 0 && (
          <DataTable head={["GRN", "PO", "Supplier", "Received", "Items", "Value"]}>
            {grns.data.map((g) => (
              <tr key={g.id}>
                <td className={`${td} tabular font-semibold`}>{g.number}</td>
                <td className={`${td} tabular`}>{g.poNumber}</td>
                <td className={td}>{g.supplierName}</td>
                <td className={`${td} text-muted-foreground`}>{format(new Date(g.receivedAt), "MMM d, HH:mm")} · {g.receivedBy}</td>
                <td className={`${td} text-xs`}>{g.lines.map((l) => `${l.name} ${l.qty}${l.unit}`).join(", ")}</td>
                <td className={`${td} tabular`}>{money(g.lines.reduce((s, l) => s + l.qty * l.unitCost, 0))}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
      {receiving && <ReceiveDialog po={receiving} onClose={() => setReceiving(null)} />}
    </div>
  );
}

function ReceiveDialog({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const { tenant, user } = useTenant();
  const [receive, { isLoading }] = useReceiveGoodsMutation();
  const [vals, setVals] = useState(() =>
    Object.fromEntries(po.lines.map((l) => [l.ingredientId, { qty: String(Math.max(0, l.qty - l.receivedQty)), cost: String(l.unitCost) }])),
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive {po.number}</DialogTitle>
          <DialogDescription>{po.supplierName}. Adjust quantities for short deliveries; the rest stays open.</DialogDescription>
        </DialogHeader>
        <DataTable head={["Ingredient", "Ordered", "Already received", "Receiving now", "Unit cost"]}>
          {po.lines.map((l) => {
            const remaining = l.qty - l.receivedQty;
            const v = vals[l.ingredientId]!;
            return (
              <tr key={l.ingredientId}>
                <td className={`${td} font-medium`}>{l.name}</td>
                <td className={`${td} tabular`}>{l.qty} {l.unit}</td>
                <td className={`${td} tabular text-muted-foreground`}>{l.receivedQty}</td>
                <td className={td}>
                  <Input aria-label={`Receive ${l.name}`} inputMode="decimal" placeholder="0.00" className="h-8 w-24" disabled={remaining <= 0} value={v.qty} onChange={(e) => setVals((s) => ({ ...s, [l.ingredientId]: { ...v, qty: e.target.value } }))} />
                </td>
                <td className={td}>
                  <Input aria-label={`Cost ${l.name}`} inputMode="decimal" placeholder="0.00" className="h-8 w-24" value={v.cost} onChange={(e) => setVals((s) => ({ ...s, [l.ingredientId]: { ...v, cost: e.target.value } }))} />
                </td>
              </tr>
            );
          })}
        </DataTable>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={isLoading}
            onClick={async () => {
              const r = await withToast(
                receive({ tenantId: tenant.id, poId: po.id, receivedBy: user.name, lines: Object.entries(vals).map(([ingredientId, v]) => ({ ingredientId, qty: Number(v.qty) || 0, unitCost: Number(v.cost) || 0 })) }),
                "Delivery received into stock",
              );
              if (r) onClose();
            }}
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />} Confirm receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
