import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { PAYMENT_LABELS } from "@/features/orders/order-labels";
import { DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getFinanceLedgerApi,
  BackendLedgerRow,
  BackendLedgerSummary,
} from "@/services/finance.service";
import type { PaymentMethod } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/finance/")({
  head: () => ({
    meta: [
      { title: "Payments ledger — Tablewise POS" },
      { name: "description", content: "Every payment and refund for the branch." },
    ],
  }),
  component: Ledger,
});

function Ledger() {
  const { tenant, branch } = useTenant();
  const money = useMoney();
  const [kind, setKind] = useState<"all" | "payment" | "refund">("all");
  const [rows, setRows] = useState<BackendLedgerRow[]>([]);
  const [summary, setSummary] = useState<BackendLedgerSummary>({
    takenToday: 0,
    cashToday: 0,
    cardMobileToday: 0,
    refundedToday: 0,
    totalPaymentsCount: 0,
    totalRefundsCount: 0,
    totalCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLedger = useCallback(async () => {
    if (!tenant?.slug) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await getFinanceLedgerApi(tenant.slug, {
        branchId: branch?.id || undefined,
        kind: kind,
      });
      setRows(res.items || []);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      console.error("Failed to load finance ledger:", err);
      setError(err.message || "Couldn't load payments ledger.");
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.slug, branch?.id, kind]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ["Taken today", summary.takenToday],
          ["Cash", summary.cashToday],
          ["Card & mobile", summary.cardMobileToday],
          ["Refunded today", -summary.refundedToday],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-lg font-bold">{money(v as number)}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex gap-1" role="radiogroup" aria-label="Filter">
        {(["all", "payment", "refund"] as const).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "rounded-md border px-3 py-1 text-sm transition-colors",
              kind === k && "border-primary bg-primary/10 font-semibold text-primary",
            )}
          >
            {k === "all" ? "All" : k === "payment" ? "Payments" : "Refunds"}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        To refund, open the order and choose “Refund”.
      </p>

      {isLoading && <Skeleton className="h-48" />}
      {error && <ErrorState message={error} onRetry={loadLedger} />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyState title="Nothing here yet" />
      )}
      {!isLoading && !error && rows.length > 0 && (
        <DataTable head={["Time", "Order", "Type", "Method", "Note", "Amount"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap`}>
                {format(new Date(r.at), "d MMM, HH:mm")}
              </td>
              <td className={td}>
                <Link
                  to="/app/$tenantSlug/orders/$orderId"
                  params={{ tenantSlug: tenant.slug, orderId: r.orderId }}
                  className="font-medium hover:underline text-primary"
                >
                  {r.orderNumber}
                </Link>
              </td>
              <td className={td}>
                <Badge variant={r.kind === "refund" ? "danger" : "success"}>
                  {r.kind === "refund" ? "Refund" : "Payment"}
                </Badge>
              </td>
              <td className={td}>
                {PAYMENT_LABELS[r.method as PaymentMethod] || r.method}
              </td>
              <td className={`${td} text-muted-foreground`}>
                {r.reference || "—"}
              </td>
              <td
                className={cn(
                  td,
                  "text-right font-semibold tabular-nums",
                  r.amount < 0 && "text-destructive",
                )}
              >
                {money(r.amount)}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
