import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useRefundOrderMutation } from "@/features/people/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { PAYMENT_LABELS } from "@/features/orders/order-labels";
import { round2 } from "@/lib/pricing";
import { Field, num } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Order, PaymentMethod } from "@/types/domain";

/** Full or partial refund back to a method the guest paid with. */
export function RefundDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { tenant, user } = useTenant();
  const money = useMoney();
  const [refund, { isLoading }] = useRefundOrderMutation();
  const refundable = round2(order.paid - order.refunded);
  const methods = [...new Set(order.payments.map((p) => p.method))];
  const [amount, setAmount] = useState(String(refundable));
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? "cash");
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Refund {order.number}</DialogTitle>
          <DialogDescription>Up to {money(refundable)} can be refunded.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await withToast(refund({ tenantId: tenant.id, orderId: order.id, amount: num(amount), method, reason, by: user.name }), "Refund issued")) onOpenChange(false);
          }}
        >
          <Field label="Amount">{(id) => <Input id={id} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Refund to</legend>
            <div className="flex gap-2">
              {methods.map((m) => (
                <Button key={m} type="button" size="sm" variant={method === m ? "default" : "outline"} aria-pressed={method === m} onClick={() => setMethod(m)}>{PAYMENT_LABELS[m]}</Button>
              ))}
            </div>
          </fieldset>
          <Field label="Reason">{(id) => <Textarea id={id} value={reason} maxLength={140} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Dish returned / Wrong item prepared" />}</Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={isLoading || !reason.trim()}>{isLoading && <Loader2 className="size-4 animate-spin" />} Refund</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
