import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Ban, CheckCheck, CreditCard, MapPin, Package, Receipt, Undo2 } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useCancelOrderMutation, useMarkServedMutation, useOrderQuery } from "@/app/api";
import { errorMessage } from "@/app/base-api";
import { KITCHEN_LABELS, ORDER_STATUS, ORDER_TYPE_LABELS, PAYMENT_LABELS } from "@/features/orders/order-labels";
import { PaymentDialog } from "@/features/payments/payment-dialog";
import { ReceiptDialog } from "@/features/payments/receipt-dialog";
import { RefundDialog } from "@/features/payments/refund-dialog";
import { lineTotal } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/common/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/$tenantSlug/orders/$orderId")({
  validateSearch: z.object({ pay: z.boolean().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Order detail — Tablewise POS" }, { name: "description", content: "Order items, kitchen status and payments." }] }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId, tenantSlug } = Route.useParams();
  const { pay } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { tenant, can } = useTenant();
  const money = useMoney();
  const q = useOrderQuery({ tenantId: tenant.id, orderId }, { pollingInterval: 8000 });
  const [served, { isLoading: serving }] = useMarkServedMutation();
  const [cancel, { isLoading: cancelling }] = useCancelOrderMutation();
  const [payOpen, setPayOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    if (pay && q.data && q.data.paid < q.data.totals.total) {
      setPayOpen(true);
      navigate({ search: {}, replace: true });
    }
  }, [pay, q.data, navigate]);

  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-60" /><Skeleton className="h-64" /></div>;
  if (q.isError || !q.data)
    return (
      <div className="space-y-4">
        <ErrorState message={q.error && "status" in q.error && q.error.status === 404 ? "This order doesn't exist in this restaurant." : "Couldn't load the order."} onRetry={q.refetch} />
        <Button variant="outline" asChild><Link to="/app/$tenantSlug/orders" params={{ tenantSlug }}>Back to orders</Link></Button>
      </div>
    );

  const o = q.data;
  const due = Math.max(0, o.totals.total - o.paid);
  const isPaid = due <= 0.004;
  const st = ORDER_STATUS[o.status];

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/app/$tenantSlug/orders" params={{ tenantSlug }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="tabular text-2xl font-bold">{o.number}</h1>
            <Badge variant={st.variant}>{st.label}</Badge>
            {o.refunded > 0 && o.refunded >= o.paid - 0.004 ? <Badge variant="danger">Refunded</Badge> : o.refunded > 0 ? <Badge variant="warning">Partly refunded</Badge> : isPaid ? <Badge variant="success">Paid</Badge> : o.paid > 0 ? <Badge variant="warning">Partially paid</Badge> : <Badge variant="muted">Unpaid</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {ORDER_TYPE_LABELS[o.type]}{o.tableName && ` · ${o.tableName}`}{o.customerName && ` · ${o.customerName}`} · {format(new Date(o.createdAt), "MMM d, HH:mm")} · by {o.createdBy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {o.status === "ready" && can("orders.manage") && (
            <Button variant="outline" disabled={serving} onClick={() => served({ tenantId: tenant.id, orderId: o.id }).unwrap().then(() => toast.success("Marked as served")).catch((e) => toast.error(errorMessage(e)))}>
              <CheckCheck className="size-4" /> Mark served
            </Button>
          )}
          {!isPaid && o.status !== "cancelled" && can("payments.process") && (
            <Button onClick={() => setPayOpen(true)}><CreditCard className="size-4" /> Take payment</Button>
          )}
          <Button variant="outline" onClick={() => setReceiptOpen(true)}><Receipt className="size-4" /> Receipt</Button>
          {can("refunds.process") && o.paid - o.refunded > 0.004 && (
            <Button variant="outline" onClick={() => setRefundOpen(true)}><Undo2 className="size-4" /> Refund</Button>
          )}
          {can("orders.void") && o.status !== "completed" && o.status !== "cancelled" && o.paid - o.refunded <= 0.004 && (
            <Button variant="ghost" className="text-destructive" onClick={() => setVoidOpen(true)}><Ban className="size-4" /> Void</Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border bg-card" aria-label="Items">
          <ul className="divide-y">
            {o.lines.map((l) => (
              <li key={l.id} className="flex gap-4 px-4 py-3">
                <span className="tabular w-8 text-muted-foreground">{l.qty}×</span>
                <div className="flex-1">
                  <p className="font-medium">{l.name}{l.variantName && <span className="text-muted-foreground"> · {l.variantName}</span>}</p>
                  {l.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{l.modifiers.map((m) => m.name).join(", ")}</p>}
                  {l.notes && <p className="text-xs italic text-muted-foreground">“{l.notes}”</p>}
                </div>
                <span className="tabular">{money(lineTotal(l))}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t px-4 py-3 text-sm">
            <Row k="Subtotal" v={money(o.totals.subtotal)} />
            {o.totals.discount > 0 && <Row k="Discount" v={`−${money(o.totals.discount)}`} />}
            {o.totals.serviceCharge > 0 && <Row k="Service charge" v={money(o.totals.serviceCharge)} />}
            <Row k="Tax" v={money(o.totals.tax)} />
            <div className="flex justify-between pt-1 text-base font-bold"><dt>Total</dt><dd className="tabular">{money(o.totals.total)}</dd></div>
            <Row k="Paid" v={money(o.paid)} />
            {o.refunded > 0 && <div className="flex justify-between text-destructive"><dt>Refunded</dt><dd className="tabular">−{money(o.refunded)}</dd></div>}
            {!isPaid && <div className="flex justify-between font-semibold text-primary"><dt>Balance due</dt><dd className="tabular">{money(due)}</dd></div>}
          </dl>
          {o.notes && <p className="whitespace-pre-line border-t px-4 py-3 text-sm text-muted-foreground">{o.notes}</p>}
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
            <ol className="space-y-2 text-sm">
              <Step done label="Sent to kitchen" at={o.sentToKitchenAt} />
              <Step done={!!o.readyAt} label={`Kitchen: ${KITCHEN_LABELS[o.kitchenStatus]}`} at={o.readyAt} />
              <Step done={["served", "completed"].includes(o.status)} label="Served" />
              <Step done={isPaid} label="Paid" at={o.payments.at(-1)?.at ?? null} />
              <Step done={o.status === "completed"} label="Completed" at={o.completedAt} />
            </ol>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Payments</h2>
            {o.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
              <ul className="space-y-2 text-sm">
                {o.payments.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{PAYMENT_LABELS[p.method]} <span className="text-muted-foreground">· {format(new Date(p.at), "HH:mm")}</span></span>
                    <span className="tabular">{money(p.amount)}</span>
                  </li>
                ))}
                {o.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between text-destructive">
                    <span>Refund · {PAYMENT_LABELS[r.method]} <span className="text-muted-foreground">· {r.reason}</span></span>
                    <span className="tabular">−{money(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {o.delivery && (
            <div className="rounded-lg border bg-card p-4 text-sm">
              <h2 className="mb-2 font-semibold">Delivery</h2>
              <p className="flex gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />{o.delivery.address}</p>
              <p className="mt-1 text-muted-foreground">Status: {o.delivery.status}{o.delivery.riderName && ` · ${o.delivery.riderName}`}</p>
            </div>
          )}
          {o.inventoryDeducted && (
            <p className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-xs text-success">
              <Package className="size-4" aria-hidden /> Ingredients deducted from stock
            </p>
          )}
        </aside>
      </div>

      <PaymentDialog order={o} open={payOpen} onOpenChange={setPayOpen} onPaid={(u) => u.paid >= u.totals.total && setReceiptOpen(true)} />
      <ReceiptDialog order={o} open={receiptOpen} onOpenChange={setReceiptOpen} />
      {refundOpen && <RefundDialog order={o} open={refundOpen} onOpenChange={setRefundOpen} />}
      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void order {o.number}?</AlertDialogTitle>
            <AlertDialogDescription>The kitchen ticket is cancelled and the table is released. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea aria-label="Reason" placeholder="Reason for voiding order (e.g. Guest left / Order duplicate)" value={voidReason} maxLength={140} onChange={(e) => setVoidReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={!voidReason.trim() || cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancel({ tenantId: tenant.id, orderId: o.id, reason: voidReason.trim() }).unwrap().then(() => toast.success("Order voided")).catch((e) => toast.error(errorMessage(e)))}
            >
              Void order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-muted-foreground"><dt>{k}</dt><dd className="tabular">{v}</dd></div>;
}

function Step({ done, label, at }: { done: boolean; label: string; at?: string | null }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`size-2.5 rounded-full ${done ? "bg-primary" : "border border-muted-foreground/40"}`} aria-hidden />
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
      {at && done && <span className="ml-auto text-xs text-muted-foreground">{format(new Date(at), "HH:mm")}</span>}
    </li>
  );
}
