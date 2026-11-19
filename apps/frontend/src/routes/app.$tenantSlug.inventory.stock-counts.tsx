import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useIngredientsQuery } from "@/app/api";
import { useStockCountsQuery, useSubmitStockCountMutation } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$tenantSlug/inventory/stock-counts")({
  head: () => ({ meta: [{ title: "Stock counts — Tablewise POS" }, { name: "description", content: "Count stock and reconcile variances." }] }),
  component: StockCounts,
});

function StockCounts() {
  const { tenant, branch, user, can } = useTenant();
  const ing = useIngredientsQuery({ tenantId: tenant.id, branchId: branch.id });
  const counts = useStockCountsQuery({ tenantId: tenant.id, branchId: branch.id });
  const [submit, { isLoading }] = useSubmitStockCountMutation();
  const [active, setActive] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const start = () => {
    setValues({});
    setNotes("");
    setActive(true);
  };
  const entered = Object.entries(values).filter(([, v]) => v.trim() !== "");

  return (
    <div className="space-y-6">
      {!active ? (
        can("inventory.manage") && <Button onClick={start}><ClipboardCheck className="size-4" /> Start stock count</Button>
      ) : (
        <section className="rounded-lg border bg-card p-4" aria-label="New stock count">
          <h2 className="mb-1 font-semibold">New count · {branch.name}</h2>
          <p className="mb-4 text-sm text-muted-foreground">Enter what's physically on the shelf. Leave blank to skip an item. Differences are posted as count adjustments.</p>
          {ing.isLoading && <Skeleton className="h-40" />}
          <DataTable head={["Ingredient", "Expected", "Counted", "Variance"]}>
            {(ing.data ?? []).map((i) => {
              const raw = values[i.id] ?? "";
              const n = Number(raw);
              const variance = raw.trim() === "" || !Number.isFinite(n) ? null : Math.round((n - i.stock) * 1000) / 1000;
              return (
                <tr key={i.id}>
                  <td className={`${td} font-medium`}>{i.name}</td>
                  <td className={`${td} tabular text-muted-foreground`}>{i.stock} {i.unit}</td>
                  <td className={td}><Input aria-label={`Counted ${i.name}`} inputMode="decimal" placeholder="0.00" className="h-8 w-28" value={raw} onChange={(e) => setValues((v) => ({ ...v, [i.id]: e.target.value }))} /></td>
                  <td className={cn(td, "tabular", variance === null ? "text-muted-foreground" : variance < 0 ? "text-destructive" : variance > 0 ? "text-success" : "")}>
                    {variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance} ${i.unit}`}
                  </td>
                </tr>
              );
            })}
          </DataTable>
          <Textarea className="mt-3" aria-label="Count notes" placeholder="Audit count notes (e.g. Month-end inventory physical verification)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActive(false)}>Discard</Button>
            <Button
              disabled={isLoading || entered.length === 0}
              onClick={async () => {
                const r = await withToast(
                  submit({ tenantId: tenant.id, branchId: branch.id, notes, createdBy: user.name, counts: entered.map(([ingredientId, v]) => ({ ingredientId, counted: Number(v) })) }),
                  `Stock count posted (${entered.length} items)`,
                );
                if (r) setActive(false);
              }}
            >
              {isLoading && <Loader2 className="size-4 animate-spin" />} Post count ({entered.length})
            </Button>
          </div>
        </section>
      )}

      <section aria-label="Count history">
        <h2 className="mb-3 text-sm font-semibold">History</h2>
        {counts.isLoading && <Skeleton className="h-32" />}
        {counts.isError && <ErrorState message="Couldn't load counts." onRetry={counts.refetch} />}
        {counts.data?.length === 0 && <EmptyState title="No stock counts yet" />}
        <Accordion type="single" collapsible className="rounded-lg border bg-card">
          {counts.data?.map((c) => {
            const off = c.lines.filter((l) => l.variance !== 0).length;
            return (
              <AccordionItem key={c.id} value={c.id} className="px-4">
                <AccordionTrigger>
                  <span className="flex flex-1 items-center gap-3 text-sm">
                    <span className="tabular font-semibold">{c.number}</span>
                    <span className="text-muted-foreground">{format(new Date(c.createdAt), "MMM d, HH:mm")} · {c.createdBy}</span>
                    <span className="ml-auto mr-3 text-xs">{c.lines.length} counted · {off} with variance</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1 text-sm">
                    {c.lines.map((l) => (
                      <li key={l.ingredientId} className="flex justify-between">
                        <span>{l.name}</span>
                        <span className="tabular">{l.expected} → {l.counted} {l.unit} <span className={l.variance < 0 ? "text-destructive" : l.variance > 0 ? "text-success" : "text-muted-foreground"}>({l.variance > 0 ? "+" : ""}{l.variance})</span></span>
                      </li>
                    ))}
                  </ul>
                  {c.notes && <p className="mt-2 text-xs text-muted-foreground">{c.notes}</p>}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
    </div>
  );
}
