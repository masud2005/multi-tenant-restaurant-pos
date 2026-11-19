import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useIngredientsQuery, useMenuQuery } from "@/app/api";
import { useRecipeCostsQuery, useSaveRecipeMutation } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { costRecipe, type RecipeCostRow } from "@/services/catalog.service";
import { DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$tenantSlug/recipes")({
  head: () => ({ meta: [{ title: "Recipes & food cost — Tablewise POS" }, { name: "description", content: "Recipe ingredients, plate cost and margins." }] }),
  component: () => (
    <RequirePermission perm="recipes.view">
      <Recipes />
    </RequirePermission>
  ),
});

/** Target food-cost percentage; above this an item is flagged. */
const TARGET_PCT = 35;

function Recipes() {
  const { tenant, branch } = useTenant();
  const money = useMoney();
  const rows = useRecipeCostsQuery({ tenantId: tenant.id, branchId: branch.id });
  const menu = useMenuQuery(tenant.id);
  const [sort, setSort] = useState<"name" | "costPct" | "margin">("costPct");
  const [editing, setEditing] = useState<RecipeCostRow | null>(null);
  const data = [...(rows.data ?? [])].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "costPct" ? b.costPct - a.costPct : a.margin - b.margin));
  const priced = data.filter((r) => r.recipe.length);
  const avgPct = priced.length ? priced.reduce((s, r) => s + r.costPct, 0) / priced.length : 0;

  return (
    <div>
      <PageHeader title="Recipes & food cost" description={`Costs use ${branch.name}'s latest ingredient prices · target ≤ ${TARGET_PCT}%`} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Average food cost" value={`${avgPct.toFixed(1)}%`} />
        <Kpi label="Over target" value={String(priced.filter((r) => r.costPct > TARGET_PCT).length)} />
        <Kpi label="Missing recipe" value={String(data.filter((r) => !r.recipe.length).length)} />
      </div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        Sort by
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-8 w-40" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="costPct">Highest cost %</SelectItem>
            <SelectItem value="margin">Lowest margin</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {rows.isLoading && <Skeleton className="h-64" />}
      {rows.isError && <ErrorState message="Couldn't load recipes." onRetry={rows.refetch} />}
      {rows.data && rows.data.length === 0 && <EmptyState title="No menu items" />}
      {data.length > 0 && (
        <DataTable head={["Item", "Category", "Price", "Plate cost", "Margin", "Food cost", ""]}>
          {data.map((r) => (
            <tr key={r.itemId}>
              <td className={`${td} font-medium`}>{r.name}</td>
              <td className={`${td} text-muted-foreground`}>{menu.data?.categories.find((c) => c.id === r.categoryId)?.name}</td>
              <td className={`${td} tabular`}>{money(r.price)}</td>
              <td className={`${td} tabular`}>{r.recipe.length ? money(r.cost) : "—"}</td>
              <td className={`${td} tabular`}>{r.recipe.length ? money(r.margin) : "—"}</td>
              <td className={td}>
                {!r.recipe.length ? <Badge variant="muted">No recipe</Badge> : <Badge variant={r.costPct > TARGET_PCT ? "danger" : "success"}>{r.costPct.toFixed(1)}%</Badge>}
              </td>
              <td className={`${td} text-right`}><Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit recipe</Button></td>
            </tr>
          ))}
        </DataTable>
      )}
      {editing && <RecipeEditor row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function RecipeEditor({ row, onClose }: { row: RecipeCostRow; onClose: () => void }) {
  const { tenant, branch, can } = useTenant();
  const money = useMoney();
  const ings = useIngredientsQuery({ tenantId: tenant.id, branchId: branch.id });
  const [save, { isLoading }] = useSaveRecipeMutation();
  const [lines, setLines] = useState(row.recipe.map((r) => ({ ingredientKey: r.ingredientKey, qty: String(r.qty) })));
  const parsed = lines.map((l) => ({ ingredientKey: l.ingredientKey, qty: Number(l.qty) || 0 }));
  const { lines: costed, cost } = costRecipe(parsed.filter((l) => l.ingredientKey), ings.data ?? []);
  const pct = row.price > 0 ? (cost / row.price) * 100 : 0;
  const used = new Set(lines.map((l) => l.ingredientKey));
  const editable = can("menu.manage");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{row.name}</SheetTitle>
          <SheetDescription>Quantities per single portion. Sale price {money(row.price)}.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
          {lines.map((l, idx) => {
            const c = costed.find((x) => x.ingredientKey === l.ingredientKey);
            return (
              <div key={idx} className="flex items-center gap-2">
                <Select value={l.ingredientKey} disabled={!editable} onValueChange={(v) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, ingredientKey: v } : x)))}>
                  <SelectTrigger aria-label="Ingredient" className="flex-1"><SelectValue placeholder="Ingredient" /></SelectTrigger>
                  <SelectContent>
                    {(ings.data ?? []).filter((i) => i.key === l.ingredientKey || !used.has(i.key)).map((i) => <SelectItem key={i.key} value={i.key}>{i.name} ({i.unit})</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input aria-label="Quantity" placeholder="0.00" inputMode="decimal" className="w-24" disabled={!editable} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))} />
                <span className="tabular w-24 text-right text-sm">{c ? money(c.lineCost) : "—"}</span>
                {editable && <Button size="icon" variant="ghost" aria-label="Remove ingredient" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button>}
              </div>
            );
          })}
          {lines.length === 0 && <p className="text-sm text-muted-foreground">No ingredients yet — sales of this item won't reduce stock.</p>}
          {editable && <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { ingredientKey: "", qty: "" }])}><Plus className="size-4" /> Add ingredient</Button>}
          <dl className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt>Plate cost</dt><dd className="tabular font-semibold">{money(cost)}</dd></div>
            <div className="flex justify-between"><dt>Margin</dt><dd className="tabular">{money(row.price - cost)}</dd></div>
            <div className="flex justify-between"><dt>Food cost</dt><dd className={cn("tabular font-semibold", pct > TARGET_PCT ? "text-destructive" : "text-success")}>{pct.toFixed(1)}%</dd></div>
          </dl>
          {editable && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                disabled={isLoading || lines.some((l) => !l.ingredientKey)}
                onClick={async () => {
                  if (await withToast(save({ tenantId: tenant.id, itemId: row.itemId, recipe: parsed }), "Recipe saved")) onClose();
                }}
              >
                {isLoading && <Loader2 className="size-4 animate-spin" />} Save recipe
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
