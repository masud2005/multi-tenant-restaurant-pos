import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { useCreateExpenseMutation, useDeleteExpenseMutation, useExpensesQuery } from "@/features/people/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { Confirm, DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Field, num } from "@/components/common/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExpenseCategory } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/finance/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Tablewise POS" }, { name: "description", content: "Record branch running costs." }] }),
  component: () => (
    <RequirePermission perm="expenses.manage">
      <Expenses />
    </RequirePermission>
  ),
});

const CATS: Record<ExpenseCategory, string> = { supplies: "Supplies", utilities: "Utilities", rent: "Rent", maintenance: "Maintenance", marketing: "Marketing", wages: "Wages", other: "Other" };
const sel = "h-10 w-full rounded-md border bg-background px-3 text-sm";

function Expenses() {
  const { tenant, branch, user } = useTenant();
  const money = useMoney();
  const list = useExpensesQuery({ tenantId: tenant.id, branchId: branch.id });
  const [create, { isLoading }] = useCreateExpenseMutation();
  const [del] = useDeleteExpenseMutation();
  const blank = { category: "supplies" as ExpenseCategory, description: "", amount: "", paidFrom: "bank" as "bank" | "cash_drawer", date: format(new Date(), "yyyy-MM-dd") };
  const [v, setV] = useState(blank);
  const month = format(new Date(), "yyyy-MM");
  const monthTotal = (list.data ?? []).filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-6"
        aria-label="New expense"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await withToast(create({ tenantId: tenant.id, branchId: branch.id, ...v, amount: num(v.amount), createdBy: user.name }), "Expense recorded")) setV(blank);
        }}
      >
        <Field label="Category">{(id) => <select id={id} className={sel} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as ExpenseCategory })}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Field>
        <Field label="Description" className="md:col-span-2">{(id) => <Input id={id} placeholder="e.g. Daily vegetable market purchase / Utilities" value={v.description} maxLength={80} onChange={(e) => setV({ ...v, description: e.target.value })} required />}</Field>
        <Field label="Amount">{(id) => <Input id={id} inputMode="decimal" placeholder="0.00" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} required />}</Field>
        <Field label="Paid from">{(id) => <select id={id} className={sel} value={v.paidFrom} onChange={(e) => setV({ ...v, paidFrom: e.target.value as "bank" | "cash_drawer" })}><option value="bank">Bank / card</option><option value="cash_drawer">Cash drawer</option></select>}</Field>
        <Field label="Date">{(id) => <Input id={id} type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />}</Field>
        <div className="md:col-span-6"><Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="size-4 animate-spin" />} Record expense</Button></div>
      </form>
      <p className="text-sm">This month: <span className="font-bold">{money(monthTotal)}</span></p>
      {list.isLoading && <Skeleton className="h-48" />}
      {list.isError && <ErrorState message="Couldn't load expenses." onRetry={list.refetch} />}
      {list.data && list.data.length === 0 && <EmptyState title="No expenses recorded" />}
      {list.data && list.data.length > 0 && (
        <DataTable head={["Date", "Category", "Description", "Paid from", "By", "Amount", ""]}>
          {list.data.map((e) => (
            <tr key={e.id}>
              <td className={`${td} whitespace-nowrap`}>{format(new Date(e.date), "d MMM yyyy")}</td>
              <td className={td}><Badge variant="muted">{CATS[e.category]}</Badge></td>
              <td className={td}>{e.description}</td>
              <td className={td}>{e.paidFrom === "cash_drawer" ? "Cash drawer" : "Bank / card"}</td>
              <td className={`${td} text-muted-foreground`}>{e.createdBy}</td>
              <td className={`${td} text-right font-semibold tabular-nums`}>{money(e.amount)}</td>
              <td className={`${td} text-right`}>
                <Confirm title="Delete expense?" body={`${e.description} — ${money(e.amount)}`} onConfirm={() => void withToast(del({ tenantId: tenant.id, id: e.id }), "Expense deleted")}>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${e.description}`}><Trash2 className="size-4" /></Button>
                </Confirm>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
