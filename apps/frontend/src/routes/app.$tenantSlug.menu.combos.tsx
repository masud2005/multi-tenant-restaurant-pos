import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useMenuQuery } from "@/app/api";
import { useDeleteComboMutation, useSaveComboMutation } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { Confirm, FieldError } from "@/components/common/confirm";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Combo, MenuItem } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/menu/combos")({
  head: () => ({ meta: [{ title: "Combos — Tablewise POS" }, { name: "description", content: "Bundle items into combo meals." }] }),
  component: Combos,
});

const listPrice = (c: Pick<Combo, "components">, items: MenuItem[]) =>
  c.components.reduce((s, x) => s + (items.find((i) => i.id === x.itemId)?.price ?? 0) * x.qty, 0);

function Combos() {
  const { tenant } = useTenant();
  const money = useMoney();
  const menu = useMenuQuery(tenant.id);
  const [del] = useDeleteComboMutation();
  const [editing, setEditing] = useState<Combo | "new" | null>(null);
  if (menu.isLoading) return <Skeleton className="h-64" />;
  if (menu.isError || !menu.data) return <ErrorState message="Couldn't load combos." onRetry={menu.refetch} />;
  const { combos, items } = menu.data;
  return (
    <div>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing("new")}><Plus className="size-4" /> New combo</Button></div>
      {combos.length === 0 && <EmptyState title="No combos yet" body="Bundle two or more items at a set price." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {combos.map((c) => {
          const full = listPrice(c, items);
          return (
            <article key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{c.name} {!c.available && <Badge variant="muted">Hidden</Badge>}</h2>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil className="size-4" /></Button>
                  <Confirm title={`Delete ${c.name}?`} body="It will be removed from the POS." onConfirm={() => withToast(del({ tenantId: tenant.id, id: c.id }), "Combo deleted")}>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`}><Trash2 className="size-4" /></Button>
                  </Confirm>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {c.components.map((x) => <li key={x.itemId}>{x.qty}× {items.find((i) => i.id === x.itemId)?.name ?? "Removed item"}</li>)}
              </ul>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="tabular font-semibold">{money(c.price)}</span>
                {full > c.price && <span className="tabular text-xs text-muted-foreground line-through">{money(full)}</span>}
                {full > c.price && <Badge variant="success">Save {money(full - c.price)}</Badge>}
              </p>
            </article>
          );
        })}
      </div>
      {editing && <ComboDialog combo={editing === "new" ? null : editing} items={items} onClose={() => setEditing(null)} />}
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(60),
  description: z.string().max(160),
  price: z.coerce.number().min(0),
  available: z.boolean(),
  components: z.array(z.object({ itemId: z.string().min(1, "Choose an item"), qty: z.coerce.number().int().min(1) })).min(2, "Add at least two items"),
});
type Values = z.infer<typeof schema>;

function ComboDialog({ combo, items, onClose }: { combo: Combo | null; items: MenuItem[]; onClose: () => void }) {
  const { tenant } = useTenant();
  const money = useMoney();
  const [save, { isLoading }] = useSaveComboMutation();
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: combo ?? { name: "", description: "", price: 0, available: true, components: [{ itemId: "", qty: 1 }, { itemId: "", qty: 1 }] },
  });
  const comps = useFieldArray({ control: form.control, name: "components" });
  const e = form.formState.errors;
  const watched = form.watch("components");
  const full = listPrice({ components: watched.map((c) => ({ itemId: c.itemId, qty: Number(c.qty) || 0 })) }, items);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{combo ? `Edit ${combo.name}` : "New combo"}</DialogTitle></DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            if (await withToast(save({ tenantId: tenant.id, id: combo?.id, ...v }), "Combo saved")) onClose();
          })}
        >
          <div className="space-y-1.5"><Label htmlFor="cb-name">Name</Label><Input id="cb-name" placeholder="e.g. Family Feast Combo" {...form.register("name")} /><FieldError msg={e.name?.message} /></div>
          <div className="space-y-1.5"><Label htmlFor="cb-desc">Description</Label><Input id="cb-desc" placeholder="e.g. 2 Burgers, 1 Large Fries, and 2 Soft Drinks" {...form.register("description")} /></div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Included items</legend>
            {comps.fields.map((f, idx) => (
              <div key={f.id} className="flex gap-2">
                <Select value={watched[idx]?.itemId ?? ""} onValueChange={(v) => form.setValue(`components.${idx}.itemId`, v, { shouldValidate: true })}>
                  <SelectTrigger aria-label="Item"><SelectValue placeholder="Choose item" /></SelectTrigger>
                  <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input aria-label="Quantity" placeholder="Qty" inputMode="numeric" className="w-20" {...form.register(`components.${idx}.qty`)} />
                <Button type="button" size="icon" variant="ghost" aria-label="Remove item" onClick={() => comps.remove(idx)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <FieldError msg={e.components?.message ?? e.components?.root?.message ?? e.components?.[0]?.itemId?.message} />
            <Button type="button" size="sm" variant="outline" onClick={() => comps.append({ itemId: "", qty: 1 })}><Plus className="size-4" /> Add item</Button>
          </fieldset>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cb-price">Combo price ({tenant.currency})</Label>
              <Input id="cb-price" inputMode="decimal" placeholder="0.00" {...form.register("price")} />
              <p className="text-xs text-muted-foreground">Items separately: {money(full)}</p>
            </div>
            <label className="flex items-center gap-2 pb-6 text-sm"><Switch checked={form.watch("available")} onCheckedChange={(v) => form.setValue("available", v)} /> Show on POS</label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="size-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
