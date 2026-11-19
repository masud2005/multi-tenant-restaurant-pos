import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useMenuQuery } from "@/app/api";
import { useDeleteMenuItemMutation, useSaveMenuItemMutation, useSetItemAvailabilityMutation } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { Confirm, DataTable, FieldError, td } from "@/components/common/confirm";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MenuItem } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/menu/")({
  component: MenuItems,
});

function MenuItems() {
  const { tenant } = useTenant();
  const money = useMoney();
  const menu = useMenuQuery(tenant.id);
  const [setAvail] = useSetItemAvailabilityMutation();
  const [del] = useDeleteMenuItemMutation();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const cats = menu.data?.categories ?? [];
  const rows = useMemo(
    () => (menu.data?.items ?? []).filter((i) => (cat === "all" || i.categoryId === cat) && i.name.toLowerCase().includes(q.trim().toLowerCase())),
    [menu.data, cat, q],
  );

  if (menu.isLoading) return <Skeleton className="h-80" />;
  if (menu.isError) return <ErrorState message="Couldn't load the menu." onRetry={menu.refetch} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes, tags..." className="pl-8" aria-label="Search items" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-44" aria-label="Category filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setEditing("new")}><Plus className="size-4" /> New item</Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No items" body="Add your first item or change the filters." />
      ) : (
        <DataTable head={["Item", "Category", "Price", "Options", "On POS", ""]}>
          {rows.map((i) => (
            <tr key={i.id}>
              <td className={td}>
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.description}</p>
              </td>
              <td className={td}>{cats.find((c) => c.id === i.categoryId)?.name}</td>
              <td className={`${td} tabular`}>{money(i.price)}</td>
              <td className={`${td} text-xs text-muted-foreground`}>
                {i.variants.length > 0 && <span className="mr-2">{i.variants.length} sizes</span>}
                {i.modifierGroupIds.length > 0 && <span>{i.modifierGroupIds.length} modifier groups</span>}
                {!i.variants.length && !i.modifierGroupIds.length && "—"}
              </td>
              <td className={td}>
                <Switch checked={i.available} aria-label={`${i.name} available`} onCheckedChange={(v) => withToast(setAvail({ tenantId: tenant.id, id: i.id, available: v }), v ? `${i.name} is back on the POS` : `${i.name} marked sold out`)} />
              </td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <Button size="icon" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}><Pencil className="size-4" /></Button>
                <Confirm title={`Delete ${i.name}?`} body="It will be removed from the POS. Past orders keep their record." onConfirm={() => withToast(del({ tenantId: tenant.id, id: i.id }), "Item deleted")}>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${i.name}`}><Trash2 className="size-4" /></Button>
                </Confirm>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {editing && <ItemDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(60),
  description: z.string().max(160),
  categoryId: z.string().min(1, "Choose a category"),
  price: z.coerce.number().min(0, "Must be 0 or more"),
  available: z.boolean(),
  tags: z.string(),
  modifierGroupIds: z.array(z.string()),
  variants: z.array(z.object({ id: z.string(), name: z.string().trim().min(1, "Required"), priceDelta: z.coerce.number() })),
});
type Values = z.infer<typeof schema>;

function ItemDialog({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  const { tenant } = useTenant();
  const menu = useMenuQuery(tenant.id);
  const [save, { isLoading }] = useSaveMenuItemMutation();
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: item?.name ?? "",
      description: item?.description ?? "",
      categoryId: item?.categoryId ?? menu.data?.categories[0]?.id ?? "",
      price: item?.price ?? 0,
      available: item?.available ?? true,
      tags: item?.tags.join(", ") ?? "",
      modifierGroupIds: item?.modifierGroupIds ?? [],
      variants: item?.variants ?? [],
    },
  });
  const variants = useFieldArray({ control: form.control, name: "variants" });
  const e = form.formState.errors;
  const groupIds = form.watch("modifierGroupIds");
  useEffect(() => form.setFocus("name"), [form]);

  const submit = form.handleSubmit(async (v) => {
    const r = await withToast(save({ tenantId: tenant.id, id: item?.id, ...v, tags: v.tags.split(",") }), item ? "Item updated" : "Item created");
    if (r) onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? `Edit ${item.name}` : "New menu item"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mi-name">Name</Label>
              <Input id="mi-name" placeholder="e.g. Grilled Chicken Steak" {...form.register("name")} />
              <FieldError msg={e.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.watch("categoryId")} onValueChange={(v) => form.setValue("categoryId", v, { shouldValidate: true })}>
                <SelectTrigger aria-label="Category"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{menu.data?.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError msg={e.categoryId?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mi-price">Base price ({tenant.currency})</Label>
              <Input id="mi-price" inputMode="decimal" placeholder="0.00" {...form.register("price")} />
              <FieldError msg={e.price?.message} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mi-desc">Description</Label>
              <Textarea id="mi-desc" rows={2} placeholder="Brief description of dish, preparation or taste profile..." {...form.register("description")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mi-tags">Tags (comma separated)</Label>
              <Input id="mi-tags" placeholder="e.g. bestseller, spicy, chef-special" {...form.register("tags")} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Switch checked={form.watch("available")} onCheckedChange={(v) => form.setValue("available", v)} /> Available on POS
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Sizes / variants</legend>
            {variants.fields.map((f, idx) => (
              <div key={f.id} className="flex gap-2">
                <Input aria-label="Variant name" placeholder="e.g. Large / Regular" {...form.register(`variants.${idx}.name`)} />
                <Input aria-label="Price change" inputMode="decimal" className="w-32" placeholder="+0.00" {...form.register(`variants.${idx}.priceDelta`)} />
                <Button type="button" size="icon" variant="ghost" aria-label="Remove variant" onClick={() => variants.remove(idx)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => variants.append({ id: "", name: "", priceDelta: 0 })}><Plus className="size-4" /> Add variant</Button>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Modifier groups</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {menu.data?.modifierGroups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox
                    checked={groupIds.includes(g.id)}
                    onCheckedChange={(c) => form.setValue("modifierGroupIds", c ? [...groupIds, g.id] : groupIds.filter((x) => x !== g.id))}
                  />
                  {g.name} <span className="text-xs text-muted-foreground">({g.options.length})</span>
                </label>
              ))}
              {menu.data?.modifierGroups.length === 0 && <p className="text-sm text-muted-foreground">No modifier groups yet.</p>}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="size-4 animate-spin" />} Save item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

