import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChefHat, CreditCard, Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useValidatePromotionMutation } from "@/features/people/api";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useAddOrderLinesMutation, useCreateOrderMutation, useMenuQuery, useOrdersQuery, useTablesQuery } from "@/app/api";
import { errorMessage } from "@/app/base-api";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { cartActions, cartLineSelectors } from "@/features/pos/cart.slice";
import { ItemConfigDialog } from "@/features/pos/item-config-dialog";
import { ORDER_TYPE_LABELS } from "@/features/orders/order-labels";
import { computeTotals, lineTotal } from "@/lib/pricing";
import { uid } from "@/mocks/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState, ErrorState } from "@/components/common/states";
import { cn } from "@/lib/utils";
import type { Combo, MenuItem, OrderType } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/pos")({
  head: () => ({ meta: [{ title: "POS terminal — Tablewise POS" }, { name: "description", content: "Take orders and send them to the kitchen." }] }),
  component: () => (
    <RequirePermission perm="pos.use">
      <PosPage />
    </RequirePermission>
  ),
});

const ORDER_TYPES: OrderType[] = ["dine_in", "takeaway", "pickup", "counter", "delivery"];

function PosPage() {
  const { tenant, branch, user, can } = useTenant();
  const money = useMoney();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.cart);
  const lines = cartLineSelectors.selectAll(cart.lines);
  const menu = useMenuQuery(tenant.id);
  const tables = useTablesQuery({ tenantId: tenant.id, branchId: branch.id });
  const activeOrders = useOrdersQuery({ tenantId: tenant.id, branchId: branch.id, status: "active" }, { pollingInterval: 6000 });
  const [createOrder, { isLoading: creating }] = useCreateOrderMutation();
  const [addOrderLines, { isLoading: addingLines }] = useAddOrderLinesMutation();
  const [submittingAction, setSubmittingAction] = useState<"send" | "pay" | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const [configuring, setConfiguring] = useState<MenuItem | null>(null);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (menu.data?.items ?? []).filter((i) => category !== "combos" && (category === "all" || i.categoryId === category) && (!s || i.name.toLowerCase().includes(s)));
  }, [menu.data, category, q]);

  const combos = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (menu.data?.combos ?? []).filter((c) => c.available && (category === "all" || category === "combos") && (!s || c.name.toLowerCase().includes(s)));
  }, [menu.data, category, q]);
  const itemName = (id: string) => menu.data?.items.find((i) => i.id === id)?.name ?? "Item";
  const addCombo = (c: Combo) =>
    dispatch(
      cartActions.addLine({
        id: uid("line"),
        itemId: c.id,
        name: c.name,
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 1,
        unitPrice: c.price,
        notes: "Includes: " + c.components.map((x) => `${x.qty}× ${itemName(x.itemId)}`).join(", "),
      }),
    );

  const totals = computeTotals({ lines, discount: cart.discount, orderType: cart.orderType, taxRate: tenant.taxRate, serviceChargeRate: tenant.serviceChargeRate });
  const selectedTable = tables.data?.find((t) => t.id === cart.tableId);

  // Running order detection for the selected table
  const activeOrderForTable = useMemo(() => {
    if (!cart.tableId || cart.orderType !== "dine_in") return null;
    return (activeOrders.data ?? []).find(
      (o) => o.tableId === cart.tableId && o.status !== "completed" && o.status !== "cancelled",
    );
  }, [cart.tableId, cart.orderType, activeOrders.data]);

  const pick = (item: MenuItem) => {
    if (!item.available) return;
    if (item.variants.length || item.modifierGroupIds.length) setConfiguring(item);
    else {
      dispatch(cartActions.addLine({ id: uid("line"), itemId: item.id, name: item.name, variantId: null, variantName: null, modifiers: [], qty: 1, unitPrice: item.price, notes: "" }));
    }
  };

  const submit = async (pay: boolean) => {
    if (!lines.length) {
      toast.error("Add at least one item.");
      return;
    }
    if (cart.orderType === "dine_in" && !cart.tableId) {
      toast.error("Choose a table for dine-in.");
      return;
    }
    if (cart.orderType === "delivery" && (!(cart.deliveryAddress ?? "").trim() || !cart.customerPhone.trim())) {
      toast.error("Delivery needs a phone number and address.");
      return;
    }
    setSubmittingAction(pay ? "pay" : "send");
    try {
      const order = await createOrder({
        tenantId: tenant.id,
        branchId: branch.id,
        type: cart.orderType,
        tableId: cart.tableId,
        customerName: cart.customerName.trim(),
        customerPhone: cart.customerPhone.trim(),
        lines,
        discount: cart.discount,
        notes: cart.notes.trim(),
        createdBy: user.name,
        deliveryAddress: cart.orderType === "delivery" ? (cart.deliveryAddress ?? "").trim() : undefined,
      }).unwrap();
      dispatch(cartActions.clearCart());
      toast.success(`Order ${order.number} sent to kitchen`);
      if (pay) navigate({ to: "/app/$tenantSlug/orders/$orderId", params: { tenantSlug: tenant.slug, orderId: order.id }, search: { pay: true } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmittingAction(null);
    }
  };

  const submitAddItems = async () => {
    if (!lines.length) {
      toast.error("Add at least one item from the menu.");
      return;
    }
    if (!activeOrderForTable) return;
    try {
      await addOrderLines({
        tenantId: tenant.id,
        orderId: activeOrderForTable.id,
        lines,
      }).unwrap();
      dispatch(cartActions.clearCart());
      toast.success(`Added ${lines.length} items to Order ${activeOrderForTable.number}! Sent to kitchen.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        submit(true);
      } else if (e.key === "Escape") {
        if (configuring) setConfiguring(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lines, cart, configuring]);

  return (
    <div className="-m-4 grid h-[calc(100vh-3.5rem)] md:-m-6 lg:grid-cols-[1fr_380px]">
      {/* Menu */}
      <section className="flex min-h-0 flex-col p-4 md:p-6" aria-label="Menu">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search menu" className="pl-8" aria-label="Search menu" />
          </div>
        </div>
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
          {[{ id: "all", name: "All" }, ...(menu.data?.categories ?? []), ...(menu.data?.combos.some((c) => c.available) ? [{ id: "combos", name: "Combos" }] : [])].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors", category === c.id ? "border-foreground bg-foreground text-background" : "hover:bg-accent")}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {menu.isLoading && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>}
          {menu.isError && <ErrorState message="Couldn't load the menu." onRetry={menu.refetch} />}
          {menu.data && items.length === 0 && combos.length === 0 && <EmptyState title="No items match" body="Try another category or search." />}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {combos.map((c) => (
              <button key={c.id} onClick={() => addCombo(c)} className="flex flex-col rounded-lg border border-dashed border-primary/60 bg-primary-soft p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-tight">{c.name}</span>
                  <Badge variant="soft" className="shrink-0 px-1.5 text-[10px]">Combo</Badge>
                </span>
                <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</span>
                <span className="tabular mt-auto pt-3 text-sm font-semibold">{money(c.price)}</span>
              </button>
            ))}
            {items.map((i) => (
              <button
                key={i.id}
                onClick={() => pick(i)}
                disabled={!i.available}
                className="group flex flex-col rounded-lg border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm disabled:opacity-50"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-tight">{i.name}</span>
                  {i.tags.includes("bestseller") && <Badge variant="soft" className="shrink-0 px-1.5 text-[10px]">Top</Badge>}
                </span>
                <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.description}</span>
                <span className="mt-auto flex items-center justify-between pt-3">
                  <span className="tabular text-sm font-semibold">{money(i.price)}</span>
                  {(i.variants.length > 0 || i.modifierGroupIds.length > 0) && <span className="text-[11px] text-muted-foreground">Options</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Cart */}
      <aside className="flex min-h-0 flex-col border-t bg-card lg:border-l lg:border-t-0" aria-label="Current order">
        <div className="space-y-3 border-b p-4">
          <div className="grid grid-cols-5 gap-1 rounded-md bg-muted p-1" role="radiogroup" aria-label="Order type">
            {ORDER_TYPES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={cart.orderType === t}
                onClick={() => dispatch(cartActions.setOrderType(t))}
                className={cn("rounded px-1 py-1.5 text-xs font-medium", cart.orderType === t ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {ORDER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          {cart.orderType === "dine_in" && (
            <Select value={cart.tableId ?? ""} onValueChange={(v) => dispatch(cartActions.setTable(v))}>
              <SelectTrigger aria-label="Table">
                <SelectValue placeholder={tables.isLoading ? "Loading tables…" : "Choose a table"}>
                  {selectedTable ? (
                    <span className="flex items-center gap-2">
                      <span>{selectedTable.name} · {selectedTable.seats} seats</span>
                      {activeOrderForTable && (
                        <Badge variant="outline" className="border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
                          Active {activeOrderForTable.number}
                        </Badge>
                      )}
                    </span>
                  ) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(tables.data ?? []).length === 0 && <div className="px-2 py-3 text-sm text-muted-foreground">No tables found</div>}
                {(tables.data ?? []).map((t) => {
                  const occOrder = (activeOrders.data ?? []).find(
                    (o) => o.tableId === t.id && o.status !== "completed" && o.status !== "cancelled",
                  );
                  const isOcc = t.status === "occupied" || !!occOrder;
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full shrink-0", isOcc ? "bg-amber-500" : "bg-emerald-500")} />
                        <span>{t.name} · {t.seats} seats · {t.area}</span>
                        {isOcc && (
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            (Running {occOrder ? occOrder.number : ""})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {activeOrderForTable && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-amber-900 dark:text-amber-200">
                <span className="flex items-center gap-1.5">
                  <ChefHat className="size-3.5" /> Table {selectedTable?.name} · Order {activeOrderForTable.number}
                </span>
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200 text-[10px]">
                  Running Tab
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between text-muted-foreground">
                <span>Already ordered: {activeOrderForTable.lines.reduce((s, l) => s + l.qty, 0)} items</span>
                <span className="font-semibold text-foreground">{money(activeOrderForTable.totals.total)}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Guest name" placeholder="Guest name" value={cart.customerName} maxLength={60} onChange={(e) => dispatch(cartActions.setCustomer({ name: e.target.value, phone: cart.customerPhone }))} />
            <Input aria-label="Phone" placeholder="Phone" value={cart.customerPhone} maxLength={20} onChange={(e) => dispatch(cartActions.setCustomer({ name: cart.customerName, phone: e.target.value }))} />
          </div>
          {cart.orderType === "delivery" && (
            <Input aria-label="Delivery address" placeholder="Delivery address" value={cart.deliveryAddress ?? ""} maxLength={140} onChange={(e) => dispatch(cartActions.setDeliveryAddress(e.target.value))} />
          )}
        </div>

        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {lines.length === 0 && (
            <li className="px-6 py-16 text-center text-sm text-muted-foreground">Tap menu items to start an order.</li>
          )}
          {lines.map((l) => (
            <li key={l.id} className="flex gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{l.name}{l.variantName && <span className="text-muted-foreground"> · {l.variantName}</span>}</p>
                {l.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{l.modifiers.map((m) => m.name).join(", ")}</p>}
                {l.notes && <p className="text-xs italic text-muted-foreground">“{l.notes}”</p>}
                <div className="mt-2 flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-7" aria-label={`Decrease ${l.name}`} onClick={() => dispatch(cartActions.setQty({ id: l.id, qty: l.qty - 1 }))}><Minus className="size-3" /></Button>
                  <span className="w-7 text-center text-sm tabular">{l.qty}</span>
                  <Button variant="outline" size="icon" className="size-7" aria-label={`Increase ${l.name}`} onClick={() => dispatch(cartActions.setQty({ id: l.id, qty: l.qty + 1 }))}><Plus className="size-3" /></Button>
                  <Button variant="ghost" size="icon" className="ml-1 size-7 text-muted-foreground" aria-label={`Remove ${l.name}`} onClick={() => dispatch(cartActions.removeLine(l.id))}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
              <span className="tabular text-sm font-medium">{money(lineTotal(l))}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between">
            <DiscountControl disabled={!can("discounts.apply") || lines.length === 0} subtotal={totals.subtotal} />
            {lines.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => dispatch(cartActions.clearCart())}>
                <X className="size-4" /> Clear
              </Button>
            )}
          </div>
          <dl className="space-y-1 text-sm">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {totals.discount > 0 && <Row label={`Discount${cart.discount?.kind === "percent" ? ` (${cart.discount.value}%)` : ""}`} value={`−${money(totals.discount)}`} />}
            {totals.serviceCharge > 0 && <Row label={`Service (${(tenant.serviceChargeRate * 100).toFixed(0)}%)`} value={money(totals.serviceCharge)} />}
            <Row label={`Tax (${(tenant.taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}%)`} value={money(totals.tax)} />
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular">{money(totals.total)}</dd>
            </div>
          </dl>
          {activeOrderForTable ? (
            <div className="space-y-2">
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
                size="lg"
                disabled={addingLines || !lines.length}
                onClick={submitAddItems}
              >
                {addingLines ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Plus className="size-4 mr-1.5" />}
                Send to Kitchen (Add to {activeOrderForTable.number})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() =>
                  navigate({
                    to: "/app/$tenantSlug/orders/$orderId",
                    params: { tenantSlug: tenant.slug, orderId: activeOrderForTable.id },
                  })
                }
              >
                View Full Bill ({money(activeOrderForTable.totals.total)})
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={creating || !lines.length} onClick={() => submit(false)}>
                {creating && submittingAction === "send" ? <Loader2 className="size-4 animate-spin" /> : <ChefHat className="size-4" />} Send
              </Button>
              <Button size="lg" disabled={creating || !lines.length || !can("payments.process")} onClick={() => submit(true)}>
                {creating && submittingAction === "pay" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Send & pay
              </Button>
            </div>
          )}
        </div>
      </aside>

      <ItemConfigDialog item={configuring} groups={menu.data?.modifierGroups ?? []} onClose={() => setConfiguring(null)} onAdd={(l) => dispatch(cartActions.addLine(l))} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function DiscountControl({ disabled, subtotal }: { disabled: boolean; subtotal: number }) {
  const dispatch = useAppDispatch();
  const { tenant } = useTenant();
  const [checkPromo, promoState] = useValidatePromotionMutation();
  const [code, setCode] = useState("");
  const discount = useAppSelector((s) => s.cart.discount);
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {discount ? (discount.promoCode ? `Promo ${discount.promoCode}` : `Discount: ${discount.kind === "percent" ? `${discount.value}%` : discount.value}`) : "Add discount"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {(["percent", "amount"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cn("rounded py-1 text-xs", kind === k && "bg-background shadow-sm")}>{k === "percent" ? "Percent" : "Amount"}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {[5, 10, 15, 20].map((p) => (
            <Button key={p} size="sm" variant="secondary" onClick={() => dispatch(cartActions.setDiscount({ kind: "percent", value: p, reason: "Quick" }))}>{p}%</Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(value);
            if (!Number.isFinite(n) || n <= 0 || (kind === "percent" && n > 100)) {
              toast.error("Enter a valid discount.");
              return;
            }
            dispatch(cartActions.setDiscount({ kind, value: n, reason: "Manual" }));
            setValue("");
          }}
        >
          <Input inputMode="decimal" aria-label="Discount value" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "percent" ? "%" : "Amount"} />
          <Button type="submit" size="sm">Apply</Button>
        </form>
        <form
          className="flex gap-2 border-t pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!code.trim()) return;
            try {
              const p = await checkPromo({ tenantId: tenant.id, code, subtotal }).unwrap();
              dispatch(cartActions.setDiscount({ kind: p.kind, value: p.value, reason: `Promo ${p.code}`, promoCode: p.code }));
              toast.success(`${p.name} applied`);
              setCode("");
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        >
          <Input aria-label="Promo code" placeholder="Promo code" className="uppercase" value={code} maxLength={16} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" size="sm" variant="secondary" disabled={promoState.isLoading}>Apply</Button>
        </form>
        {discount && <Button variant="ghost" size="sm" className="w-full" onClick={() => dispatch(cartActions.setDiscount(null))}>Remove discount</Button>}
      </PopoverContent>
    </Popover>
  );
}
