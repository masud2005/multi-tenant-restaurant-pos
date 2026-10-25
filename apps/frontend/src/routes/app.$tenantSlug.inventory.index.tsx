import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useIngredientsQuery } from "@/app/api";
import { useAdjustStockMutation, useDeleteIngredientMutation, useSaveIngredientMutation } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { Confirm, DataTable, FieldError, td } from "@/components/common/confirm";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Ingredient } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/inventory/")({
  component: StockLevels,
});

function StockLevels() {
  const { tenant, branch, can } = useTenant();
  const money = useMoney();
  const ing = useIngredientsQuery({ tenantId: tenant.id, branchId: branch.id });
  const [del] = useDeleteIngredientMutation();
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [adjusting, setAdjusting] = useState<Ingredient | null>(null);
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);
  const manage = can("inventory.manage");
  const rows = (ing.data ?? []).filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()) && (!lowOnly || i.stock <= i.reorderLevel));
  const value = (ing.data ?? []).reduce((s, i) => s + i.stock * i.unitCost, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ingredients" className="w-full sm:w-64" aria-label="Search ingredients" />
        <Button variant={lowOnly ? "secondary" : "outline"} size="sm" aria-pressed={lowOnly} onClick={() => setLowOnly((v) => !v)}>Low stock only</Button>
        <span className="text-sm text-muted-foreground">Stock value: <span className="tabular font-medium text-foreground">{money(value)}</span></span>
        {manage && <Button className="ml-auto" onClick={() => setEditing("new")}><Plus className="size-4" /> New ingredient</Button>}
      </div>
      {ing.isLoading && <Skeleton className="h-64" />}
      {ing.isError && <ErrorState message="Couldn't load stock." onRetry={ing.refetch} />}
      {ing.data && rows.length === 0 && <EmptyState title="No ingredients match" />}
      {rows.length > 0 && (
        <DataTable head={["Ingredient", "On hand", "Reorder at", "Unit cost", "Status", ""]}>
          {rows.map((i) => (
            <tr key={i.id}>
              <td className={`${td} font-medium`}>{i.name}</td>
              <td className={`${td} tabular`}>{i.stock} {i.unit}</td>
              <td className={`${td} tabular text-muted-foreground`}>{i.reorderLevel} {i.unit}</td>
              <td className={`${td} tabular`}>{money(i.unitCost)}/{i.unit}</td>
              <td className={td}>{i.stock <= i.reorderLevel ? <Badge variant="danger">Low</Badge> : <Badge variant="success">OK</Badge>}</td>
              <td className={`${td} whitespace-nowrap text-right`}>
                {manage && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setAdjusting(i)}><SlidersHorizontal className="size-4" /> Adjust</Button>
                    <Button size="icon" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}><Pencil className="size-4" /></Button>
                    <Confirm
                      title={`Delete ${i.name}?`}
                      body="This ingredient will be removed. Existing recipe lines and stock history will be preserved."
                      onConfirm={() => withToast(del({ tenantId: tenant.id, id: i.id, branchId: branch.id }), "Ingredient deleted")}
                    >
                      <Button size="icon" variant="ghost" aria-label={`Delete ${i.name}`}><Trash2 className="size-4" /></Button>
                    </Confirm>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {adjusting && <AdjustDialog ing={adjusting} onClose={() => setAdjusting(null)} />}
      {editing && <IngredientDialog ing={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const adjSchema = z.object({ qty: z.coerce.number().positive("Enter a quantity"), note: z.string().max(80) });

function AdjustDialog({ ing, onClose }: { ing: Ingredient; onClose: () => void }) {
  const { tenant, branch } = useTenant();
  const [mode, setMode] = useState<"add" | "remove" | "waste">("add");
  const [adjust, { isLoading }] = useAdjustStockMutation();
  const form = useForm<z.infer<typeof adjSchema>>({ resolver: zodResolver(adjSchema) as never, defaultValues: { qty: 0, note: "" } });
  const qty = Number(form.watch("qty")) || 0;
  const after = Math.round((ing.stock + (mode === "add" ? qty : -qty)) * 1000) / 1000;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust {ing.name}</DialogTitle>
          <DialogDescription>On hand: {ing.stock} {ing.unit}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            const r = await withToast(
              adjust({ tenantId: tenant.id, branchId: branch.id, ingredientId: ing.id, direction: mode === "add" ? "add" : "remove", reason: mode === "waste" ? "waste" : "adjustment", qty: v.qty, note: v.note }),
              `${ing.name} updated`,
            );
            if (r) onClose();
          })}
        >
          <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1" role="radiogroup" aria-label="Adjustment type">
            {(["add", "remove", "waste"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("rounded py-1.5 text-xs font-medium capitalize", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {m === "waste" ? "Waste" : m === "add" ? "Add" : "Remove"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-qty">Quantity ({ing.unit})</Label>
            <Input id="adj-qty" inputMode="decimal" {...form.register("qty")} />
            <FieldError msg={form.formState.errors.qty?.message} />
            <p className={cn("text-xs", after < 0 ? "text-destructive" : "text-muted-foreground")}>After: {after} {ing.unit}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-note">Note</Label>
            <Input id="adj-note" placeholder={mode === "waste" ? "e.g. spoiled" : "e.g. found extra stock"} {...form.register("note")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading || after < 0}>{isLoading && <Loader2 className="size-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ingSchema = z.object({
  name: z.string().trim().min(1, "Required").max(50),
  unit: z.string().trim().min(1, "Required").max(10),
  reorderLevel: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0),
  openingStock: z.coerce.number().min(0),
});

function IngredientDialog({ ing, onClose }: { ing: Ingredient | null; onClose: () => void }) {
  const { tenant, branch } = useTenant();
  const [save, { isLoading }] = useSaveIngredientMutation();
  const form = useForm<z.infer<typeof ingSchema>>({
    resolver: zodResolver(ingSchema) as never,
    defaultValues: { name: ing?.name ?? "", unit: ing?.unit ?? "kg", reorderLevel: ing?.reorderLevel ?? 0, unitCost: ing?.unitCost ?? 0, openingStock: 0 },
  });
  const e = form.formState.errors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ing ? `Edit ${ing.name}` : "New ingredient"}</DialogTitle>
          <DialogDescription>{branch.name} branch</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid grid-cols-2 gap-3"
          onSubmit={form.handleSubmit(async (v) => {
            if (await withToast(save({ tenantId: tenant.id, branchId: branch.id, id: ing?.id, ...v }), ing ? "Ingredient updated" : "Ingredient added")) onClose();
          })}
        >
          <div className="col-span-2 space-y-1.5"><Label htmlFor="ing-name">Name</Label><Input id="ing-name" {...form.register("name")} /><FieldError msg={e.name?.message} /></div>
          <div className="space-y-1.5"><Label htmlFor="ing-unit">Unit</Label><Input id="ing-unit" placeholder="kg, l, pc" {...form.register("unit")} /><FieldError msg={e.unit?.message} /></div>
          <div className="space-y-1.5"><Label htmlFor="ing-cost">Unit cost ({tenant.currency})</Label><Input id="ing-cost" inputMode="decimal" {...form.register("unitCost")} /></div>
          <div className="space-y-1.5"><Label htmlFor="ing-reorder">Reorder level</Label><Input id="ing-reorder" inputMode="decimal" {...form.register("reorderLevel")} /></div>
          {!ing && <div className="space-y-1.5"><Label htmlFor="ing-open">Opening stock</Label><Input id="ing-open" inputMode="decimal" {...form.register("openingStock")} /></div>}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="size-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
