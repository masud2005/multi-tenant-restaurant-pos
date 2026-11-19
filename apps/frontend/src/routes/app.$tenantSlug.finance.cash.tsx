import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useAddCashEntryMutation, useCashSessionsQuery, useCloseCashSessionMutation, useOpenCashSessionMutation } from "@/features/people/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import type { CashSessionView } from "@/services/money.service";
import { DataTable, td } from "@/components/common/confirm";
import { ErrorState } from "@/components/common/states";
import { Field, num } from "@/components/common/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$tenantSlug/finance/cash")({
  head: () => ({ meta: [{ title: "Cash drawer — Tablewise POS" }, { name: "description", content: "Open the drawer, record pay-ins and close the shift." }] }),
  component: () => (
    <RequirePermission perm="cash.manage">
      <Cash />
    </RequirePermission>
  ),
});

function Cash() {
  const { tenant, branch } = useTenant();
  const list = useCashSessionsQuery({ tenantId: tenant.id, branchId: branch.id });
  if (list.isLoading) return <Skeleton className="h-64" />;
  if (list.isError || !list.data) return <ErrorState message="Couldn't load the cash drawer." onRetry={list.refetch} />;
  const open = list.data.find((s) => s.closedAt === null);
  const closed = list.data.filter((s) => s.closedAt !== null);
  return (
    <div className="space-y-6">
      {open ? <OpenDrawer s={open} /> : <OpenForm />}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Closed shifts</h2>
        {closed.length === 0 ? <p className="text-sm text-muted-foreground">No closed shifts yet.</p> : <ClosedTable rows={closed} />}
      </section>
    </div>
  );
}

function OpenForm() {
  const { tenant, branch, user } = useTenant();
  const [openS, { isLoading }] = useOpenCashSessionMutation();
  const [float, setFloat] = useState("");
  return (
    <form
      className="flex max-w-md items-end gap-2 rounded-lg border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void withToast(openS({ tenantId: tenant.id, branchId: branch.id, openingFloat: num(float), by: user.name }), "Cash drawer opened");
      }}
    >
      <Field label="Opening float" className="flex-1" hint="Cash in the drawer at the start of the shift">{(id) => <Input id={id} inputMode="decimal" placeholder="0.00" value={float} onChange={(e) => setFloat(e.target.value)} required />}</Field>
      <Button type="submit" disabled={isLoading} className="mb-5">{isLoading && <Loader2 className="size-4 animate-spin" />} Open drawer</Button>
    </form>
  );
}

function OpenDrawer({ s }: { s: CashSessionView }) {
  const { tenant, branch, user } = useTenant();
  const money = useMoney();
  const [entry, entryState] = useAddCashEntryMutation();
  const [close, closeState] = useCloseCashSessionMutation();
  const [amt, setAmt] = useState("");
  const [reason, setReason] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const m = s.summary;
  const diff = counted.trim() ? num(counted) - m.expected : null;
  const add = async (kind: "in" | "out") => {
    if (await withToast(entry({ tenantId: tenant.id, branchId: branch.id, kind, amount: num(amt), reason, by: user.name }), kind === "in" ? "Pay-in recorded" : "Pay-out recorded")) { setAmt(""); setReason(""); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border bg-card p-4" aria-label="Open drawer">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{s.number} <Badge variant="success" className="ml-1">Open</Badge></h2>
          <span className="text-xs text-muted-foreground">by {s.openedBy}, {format(new Date(s.openedAt), "d MMM HH:mm")}</span>
        </div>
        <dl className="space-y-1 text-sm">
          {[["Opening float", m.openingFloat], ["Cash sales", m.cashSales], ["Cash refunds", -m.cashRefunds], ["Cash expenses", -m.cashExpenses], ["Pay-ins", m.cashIn], ["Pay-outs", -m.cashOut]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between"><dt className="text-muted-foreground">{l}</dt><dd className="tabular-nums">{money(v as number)}</dd></div>
          ))}
          <div className="flex justify-between border-t pt-2 text-base font-bold"><dt>Expected in drawer</dt><dd>{money(m.expected)}</dd></div>
        </dl>
        <div className="mt-4 space-y-2 border-t pt-3">
          <p className="text-sm font-semibold">Pay-in / pay-out</p>
          <div className="grid grid-cols-2 gap-2">
            <Input inputMode="decimal" aria-label="Amount" placeholder="0.00" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <Input aria-label="Reason" placeholder="Reason (e.g. Petty cash / Supplier payment)" maxLength={60} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={entryState.isLoading} onClick={() => add("in")}>Pay in</Button>
            <Button size="sm" variant="outline" disabled={entryState.isLoading} onClick={() => add("out")}>Pay out</Button>
          </div>
          {s.entries.length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {s.entries.map((e) => <li key={e.id}>{format(new Date(e.at), "HH:mm")} · {e.kind === "in" ? "+" : "−"}{money(e.amount)} · {e.reason}</li>)}
            </ul>
          )}
        </div>
      </section>
      <form
        className="space-y-3 rounded-lg border bg-card p-4"
        aria-label="Close shift"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await withToast(close({ tenantId: tenant.id, branchId: branch.id, countedCash: num(counted), notes, by: user.name }), "Shift closed")) { setCounted(""); setNotes(""); }
        }}
      >
        <h2 className="font-semibold">Close shift</h2>
        <Field label="Counted cash">{(id) => <Input id={id} inputMode="decimal" placeholder="0.00" value={counted} onChange={(e) => setCounted(e.target.value)} required />}</Field>
        {diff !== null && Number.isFinite(diff) && (
          <p className={cn("text-sm font-semibold", Math.abs(diff) < 0.005 ? "text-success" : "text-destructive")}>
            {Math.abs(diff) < 0.005 ? "Drawer balances" : `${diff > 0 ? "Over" : "Short"} by ${money(Math.abs(diff))}`}
          </p>
        )}
        <Field label="Notes">{(id) => <Input id={id} placeholder="Shift close notes / discrepancy remarks..." value={notes} maxLength={140} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <Button type="submit" disabled={closeState.isLoading}>{closeState.isLoading && <Loader2 className="size-4 animate-spin" />} Close shift</Button>
      </form>
    </div>
  );
}

function ClosedTable({ rows }: { rows: CashSessionView[] }) {
  const money = useMoney();
  return (
    <DataTable head={["Shift", "Opened", "Closed", "Expected", "Counted", "Variance"]}>
      {rows.map((s) => (
        <tr key={s.id}>
          <td className={`${td} font-medium`}>{s.number}</td>
          <td className={td}>{format(new Date(s.openedAt), "d MMM HH:mm")}<p className="text-xs text-muted-foreground">{s.openedBy}</p></td>
          <td className={td}>{format(new Date(s.closedAt!), "d MMM HH:mm")}<p className="text-xs text-muted-foreground">{s.closedBy}</p></td>
          <td className={td}>{money(s.expectedCash ?? 0)}</td>
          <td className={td}>{money(s.countedCash ?? 0)}</td>
          <td className={cn(td, "font-semibold", (s.variance ?? 0) !== 0 && "text-destructive")}>{money(s.variance ?? 0)}</td>
        </tr>
      ))}
    </DataTable>
  );
}
