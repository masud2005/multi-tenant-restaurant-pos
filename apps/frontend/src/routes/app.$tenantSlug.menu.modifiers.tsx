import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useMenuQuery } from "@/app/api";
import { useDeleteModifierGroupMutation, useSaveModifierGroupMutation } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { Confirm, FieldError } from "@/components/common/confirm";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ModifierGroup } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/menu/modifiers")({
  head: () => ({ meta: [{ title: "Modifiers — Tablewise POS" }, { name: "description", content: "Manage modifier groups and options." }] }),
  component: Modifiers,
});

function Modifiers() {
  const { tenant } = useTenant();
  const money = useMoney();
  const menu = useMenuQuery(tenant.id);
  const [del] = useDeleteModifierGroupMutation();
  const [editing, setEditing] = useState<ModifierGroup | "new" | null>(null);
  if (menu.isLoading) return <Skeleton className="h-64" />;
  if (menu.isError || !menu.data) return <ErrorState message="Couldn't load modifiers." onRetry={menu.refetch} />;
  const groups = menu.data.modifierGroups;
  return (
    <div>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing("new")}><Plus className="size-4" /> New group</Button></div>
      {groups.length === 0 && <EmptyState title="No modifier groups" body="Groups like “Spice level” or “Extras” let guests customise items." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const used = menu.data!.items.filter((i) => i.modifierGroupIds.includes(g.id)).length;
          return (
            <article key={g.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{g.name}</h2>
                  <p className="text-xs text-muted-foreground">{g.min > 0 ? `Required, ` : "Optional, "}choose {g.min === g.max ? g.max : `up to ${g.max}`} · used by {used} items</p>
                </div>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${g.name}`} onClick={() => setEditing(g)}><Pencil className="size-4" /></Button>
                  <Confirm title={`Delete ${g.name}?`} body={`It will be removed from ${used} items.`} onConfirm={() => withToast(del({ tenantId: tenant.id, id: g.id }), "Modifier group deleted")}>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${g.name}`}><Trash2 className="size-4" /></Button>
                  </Confirm>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {g.options.map((o) => (
                  <li key={o.id} className="rounded-md bg-muted px-2 py-1 text-xs">{o.name}{o.price > 0 && <span className="text-muted-foreground"> +{money(o.price)}</span>}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      {editing && <GroupDialog group={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const schema = z
  .object({
    name: z.string().trim().min(1, "Required").max(40),
    min: z.coerce.number().int().min(0),
    max: z.coerce.number().int().min(1),
    options: z.array(z.object({ id: z.string(), name: z.string().trim().min(1, "Required"), price: z.coerce.number().min(0) })).min(1, "Add an option"),
  })
  .refine((v) => v.min <= v.max, { path: ["min"], message: "Min can't exceed max" })
  .refine((v) => v.max <= v.options.length, { path: ["max"], message: "Max can't exceed number of options" });
type Values = z.infer<typeof schema>;

function GroupDialog({ group, onClose }: { group: ModifierGroup | null; onClose: () => void }) {
  const { tenant } = useTenant();
  const [save, { isLoading }] = useSaveModifierGroupMutation();
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: group ? { name: group.name, min: group.min, max: group.max, options: group.options } : { name: "", min: 0, max: 1, options: [{ id: "", name: "", price: 0 }] },
  });
  const opts = useFieldArray({ control: form.control, name: "options" });
  const e = form.formState.errors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{group ? `Edit ${group.name}` : "New modifier group"}</DialogTitle></DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            if (await withToast(save({ tenantId: tenant.id, id: group?.id, ...v }), "Modifier group saved")) onClose();
          })}
        >
          <div className="grid grid-cols-[1fr_80px_80px] gap-2">
            <div className="space-y-1.5"><Label htmlFor="mg-name">Name</Label><Input id="mg-name" placeholder="e.g. Spice Level / Choice of Sauce" {...form.register("name")} /><FieldError msg={e.name?.message} /></div>
            <div className="space-y-1.5"><Label htmlFor="mg-min">Min</Label><Input id="mg-min" inputMode="numeric" placeholder="0" {...form.register("min")} /></div>
            <div className="space-y-1.5"><Label htmlFor="mg-max">Max</Label><Input id="mg-max" inputMode="numeric" placeholder="1" {...form.register("max")} /></div>
          </div>
          <FieldError msg={e.min?.message ?? e.max?.message} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Options</legend>
            {opts.fields.map((f, idx) => (
              <div key={f.id} className="flex gap-2">
                <Input aria-label="Option name" placeholder="Option name (e.g. Extra Cheese)" {...form.register(`options.${idx}.name`)} />
                <Input aria-label="Option price" inputMode="decimal" className="w-28" placeholder="+0.00" {...form.register(`options.${idx}.price`)} />
                <Button type="button" size="icon" variant="ghost" aria-label="Remove option" disabled={opts.fields.length === 1} onClick={() => opts.remove(idx)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => opts.append({ id: "", name: "", price: 0 })}><Plus className="size-4" /> Add option</Button>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="size-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
