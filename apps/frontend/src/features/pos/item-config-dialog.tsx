import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn, uid } from "@/lib/utils";
import { useMoney } from "@/features/tenant/use-money";
import type { MenuItem, ModifierGroup, OrderLine, SelectedModifier } from "@/types/domain";

interface Props {
  item: MenuItem | null;
  groups: ModifierGroup[];
  onClose: () => void;
  onAdd: (line: OrderLine) => void;
}

export function ItemConfigDialog({ item, groups, onClose, onAdd }: Props) {
  const money = useMoney();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const itemGroups = useMemo(() => groups.filter((g) => item?.modifierGroupIds.includes(g.id)), [groups, item]);

  useEffect(() => {
    if (!item) return;
    setVariantId(item.variants[0]?.id ?? null);
    setPicked(Object.fromEntries(itemGroups.filter((g) => g.min === 1 && g.max === 1).map((g) => [g.id, g.options[0] ? [g.options[0].id] : []])));
    setQty(1);
    setNotes("");
  }, [item, itemGroups]);

  if (!item) return null;
  const variant = item.variants.find((v) => v.id === variantId) ?? null;
  const mods: SelectedModifier[] = itemGroups.flatMap((g) =>
    (picked[g.id] ?? []).map((oid) => {
      const o = g.options.find((x) => x.id === oid)!;
      return { groupId: g.id, optionId: o.id, name: o.name, price: o.price };
    }),
  );
  const unit = item.price + (variant?.priceDelta ?? 0);
  const total = (unit + mods.reduce((s, m) => s + m.price, 0)) * qty;
  const missing = itemGroups.filter((g) => (picked[g.id]?.length ?? 0) < g.min);

  const toggle = (g: ModifierGroup, optionId: string) =>
    setPicked((p) => {
      const cur = p[g.id] ?? [];
      if (g.max === 1) return { ...p, [g.id]: cur[0] === optionId && g.min === 0 ? [] : [optionId] };
      if (cur.includes(optionId)) return { ...p, [g.id]: cur.filter((x) => x !== optionId) };
      if (cur.length >= g.max) return p;
      return { ...p, [g.id]: [...cur, optionId] };
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{item.description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {item.variants.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Size</legend>
              <div className="flex flex-wrap gap-2">
                {item.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={variantId === v.id}
                    onClick={() => setVariantId(v.id)}
                    className={cn("rounded-md border px-3 py-2 text-sm", variantId === v.id ? "border-primary bg-primary-soft font-semibold" : "hover:bg-accent")}
                  >
                    {v.name}
                    {v.priceDelta > 0 && <span className="ml-1 text-muted-foreground">+{money(v.priceDelta)}</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {itemGroups.map((g) => (
            <fieldset key={g.id}>
              <legend className="mb-2 text-sm font-semibold">
                {g.name}{" "}
                <span className="font-normal text-muted-foreground">
                  {g.min > 0 ? "Required" : "Optional"}
                  {g.max > 1 && ` · up to ${g.max}`}
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = picked[g.id]?.includes(o.id) ?? false;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(g, o.id)}
                      className={cn("rounded-md border px-3 py-2 text-sm", on ? "border-primary bg-primary-soft font-semibold" : "hover:bg-accent")}
                    >
                      {o.name}
                      {o.price > 0 && <span className="ml-1 text-muted-foreground">+{money(o.price)}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="item-notes">Kitchen note</Label>
            <Textarea id="item-notes" value={notes} maxLength={140} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. no onions" rows={2} />
          </div>
        </div>
        <DialogFooter className="items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="size-4" /></Button>
            <span className="w-8 text-center tabular" aria-live="polite">{qty}</span>
            <Button variant="outline" size="icon" aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}><Plus className="size-4" /></Button>
          </div>
          <Button
            disabled={missing.length > 0}
            onClick={() => {
              onAdd({ id: uid("line"), itemId: item.id, name: item.name, variantId: variant?.id ?? null, variantName: variant?.name ?? null, modifiers: mods, qty, unitPrice: unit, notes: notes.trim() });
              onClose();
            }}
          >
            Add · <span className="tabular">{money(total)}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
