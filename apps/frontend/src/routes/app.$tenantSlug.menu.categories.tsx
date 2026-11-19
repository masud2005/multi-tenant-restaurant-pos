import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMenuQuery } from "@/app/api";
import { useDeleteCategoryMutation, useMoveCategoryMutation, useSaveCategoryMutation } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { Confirm } from "@/components/common/confirm";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/$tenantSlug/menu/categories")({
  head: () => ({ meta: [{ title: "Menu categories — Tablewise POS" }, { name: "description", content: "Organise menu categories." }] }),
  component: Categories,
});

function Categories() {
  const { tenant } = useTenant();
  const menu = useMenuQuery(tenant.id);
  const [save, { isLoading: saving }] = useSaveCategoryMutation();
  const [move] = useMoveCategoryMutation();
  const [del] = useDeleteCategoryMutation();
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (menu.isLoading) return <Skeleton className="h-64" />;
  if (menu.isError || !menu.data) return <ErrorState message="Couldn't load categories." onRetry={menu.refetch} />;
  const cats = menu.data.categories;

  return (
    <div className="max-w-2xl">
      <form
        className="mb-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await withToast(save({ tenantId: tenant.id, name }), `Category “${name.trim()}” added`)) setName("");
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name (e.g. Appetizers, Drinks)" aria-label="New category name" maxLength={40} />
        <Button type="submit" disabled={!name.trim() || saving}><Plus className="size-4" /> Add</Button>
      </form>
      <ul className="divide-y rounded-lg border bg-card">
        {cats.map((c, idx) => {
          const count = menu.data!.items.filter((i) => i.categoryId === c.id).length;
          return (
            <li key={c.id} className="flex items-center gap-2 px-4 py-2.5">
              {editId === c.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await withToast(save({ tenantId: tenant.id, id: c.id, name: editName }), "Category renamed")) setEditId(null);
                  }}
                >
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Category name" aria-label="Category name" autoFocus />
                  <Button size="icon" type="submit" aria-label="Save"><Check className="size-4" /></Button>
                  <Button size="icon" type="button" variant="ghost" aria-label="Cancel" onClick={() => setEditId(null)}><X className="size-4" /></Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name} <span className="text-xs font-normal text-muted-foreground">· {count} items</span></span>
                  <Button size="icon" variant="ghost" aria-label={`Move ${c.name} up`} disabled={idx === 0} onClick={() => move({ tenantId: tenant.id, id: c.id, dir: -1 })}><ArrowUp className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Move ${c.name} down`} disabled={idx === cats.length - 1} onClick={() => move({ tenantId: tenant.id, id: c.id, dir: 1 })}><ArrowDown className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => { setEditId(c.id); setEditName(c.name); }}><Pencil className="size-4" /></Button>
                  <Confirm title={`Delete ${c.name}?`} body={count ? "This category still has items; you'll need to move them first." : "This can't be undone."} onConfirm={() => withToast(del({ tenantId: tenant.id, id: c.id }), "Category deleted")}>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`}><Trash2 className="size-4" /></Button>
                  </Confirm>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">The order here is the order of category tabs on the POS.</p>
    </div>
  );
}
