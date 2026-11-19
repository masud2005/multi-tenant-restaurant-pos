import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, CreditCard, Loader2, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MockNotice } from "@/components/common/states";
import { useAddPaymentMutation } from "@/app/api";
import { errorMessage } from "@/app/base-api";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { round2 } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Order, PaymentMethod } from "@/types/domain";

const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

export function PaymentDialog({ order, open, onOpenChange, onPaid }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void; onPaid: (o: Order) => void }) {
  const { tenant } = useTenant();
  const money = useMoney();
  const due = round2(order.totals.total - order.paid);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(String(due));
  const [tendered, setTendered] = useState(String(due));
  const [reference, setReference] = useState("");
  const [pay, { isLoading }] = useAddPaymentMutation();

  useEffect(() => {
    if (open) {
      setAmount(String(due));
      setTendered(String(due));
      setReference("");
    }
  }, [open, due]);

  const amt = Number(amount) || 0;
  const tend = Number(tendered) || 0;
  const change = method === "cash" ? round2(Math.max(0, tend - Math.min(amt, due))) : 0;
  const quick = [...new Set([due, Math.ceil(due / 100) * 100, Math.ceil(due / 500) * 500].map((n) => round2(n)))].filter((n) => n >= due).slice(0, 3);

  const submit = async () => {
    try {
      const updated = await pay({ tenantId: tenant.id, orderId: order.id, method, amount: amt, tendered: method === "cash" ? tend : amt, reference }).unwrap();
      const remaining = round2(updated.totals.total - updated.paid);
      toast.success(remaining > 0 ? `${money(Math.min(amt, due))} received · ${money(remaining)} left` : `Paid in full${change ? ` · change ${money(change)}` : ""}`);
      onPaid(updated);
      if (remaining <= 0) onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment · {order.number}</DialogTitle>
          <DialogDescription>
            Amount due <span className="tabular font-semibold text-foreground">{money(due)}</span>. Enter a smaller amount to split the bill.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={method === m.id}
                onClick={() => setMethod(m.id)}
                className={cn("flex flex-col items-center gap-1 rounded-md border py-3 text-sm", method === m.id ? "border-primary bg-primary-soft font-semibold" : "hover:bg-accent")}
              >
                <m.icon className="size-5" aria-hidden /> {m.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount to charge</Label>
            <Input id="pay-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="secondary" onClick={() => setAmount(String(due))}>Full</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setAmount(String(round2(due / 2)))}>Half</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setAmount(String(round2(due / 3)))}>⅓</Button>
            </div>
          </div>
          {method === "cash" ? (
            <div className="space-y-1.5">
              <Label htmlFor="pay-tendered">Cash received</Label>
              <Input id="pay-tendered" inputMode="decimal" placeholder="0.00" value={tendered} onChange={(e) => setTendered(e.target.value)} className="tabular" />
              <div className="flex gap-1">
                {quick.map((n) => <Button key={n} type="button" size="sm" variant="secondary" onClick={() => setTendered(String(n))}>{money(n)}</Button>)}
              </div>
              <p className="text-sm">Change due: <span className="tabular font-semibold">{money(change)}</span></p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input id="pay-ref" value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} placeholder={method === "card" ? "Last 4 digits / approval code (e.g. 4242)" : "Transaction ID (e.g. TrxID / bKash)"} />
              <MockNotice>No card terminal or wallet is connected — the payment is recorded as approved.</MockNotice>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading || amt <= 0 || (method === "cash" && tend < Math.min(amt, due))}>
            {isLoading && <Loader2 className="size-4 animate-spin" />} Charge {money(Math.min(amt, due) || 0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
