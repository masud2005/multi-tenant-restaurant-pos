import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format, isToday } from "date-fns";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useTablesQuery } from "@/app/api";
import {
  useDeleteReservationMutation,
  useReservationsQuery,
  useSaveReservationMutation,
  useSetReservationStatusMutation,
} from "@/features/people/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { Confirm, DataTable, td } from "@/components/common/confirm";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Field, num } from "@/components/common/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Reservation, ReservationStatus } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/reservations")({
  head: () => ({ meta: [{ title: "Reservations — Tablewise POS" }, { name: "description", content: "Book, seat and track table reservations." }] }),
  component: () => (
    <RequirePermission perm="reservations.manage">
      <Reservations />
    </RequirePermission>
  ),
});

export const RES_STATUS: Record<ReservationStatus, { label: string; variant: "muted" | "info" | "warning" | "success" | "danger" }> = {
  booked: { label: "Booked", variant: "info" },
  seated: { label: "Seated", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
  no_show: { label: "No-show", variant: "danger" },
};

function Reservations() {
  const { tenant, branch } = useTenant();
  const list = useReservationsQuery({ tenantId: tenant.id, branchId: branch.id });
  const [setStatus] = useSetReservationStatusMutation();
  const [deleteReservation] = useDeleteReservationMutation();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Reservation | "new" | null>(null);
  const rows = (list.data ?? []).filter((r) => showAll || r.status === "booked" || r.status === "seated");
  const act = (r: Reservation, status: ReservationStatus, msg: string) => withToast(setStatus({ tenantId: tenant.id, id: r.id, status }), msg);
  return (
    <div>
      <PageHeader title="Reservations" description={`Bookings for ${branch.name}.`} actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New reservation</Button>} />
      <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show completed, cancelled and no-shows</label>
      {list.isLoading && <Skeleton className="h-48" />}
      {list.isError && <ErrorState message="Couldn't load reservations." onRetry={list.refetch} />}
      {list.data && rows.length === 0 && <EmptyState title="No upcoming reservations" />}
      {rows.length > 0 && (
        <DataTable head={["When", "Guest", "Party", "Table", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap font-medium`}>{isToday(new Date(r.at)) ? "Today" : format(new Date(r.at), "EEE d MMM")}, {format(new Date(r.at), "HH:mm")}</td>
              <td className={td}>{r.customerName}<p className="text-xs text-muted-foreground">{r.phone}{r.notes && ` · ${r.notes}`}</p></td>
              <td className={td}>{r.partySize}</td>
              <td className={td}>{r.tableName ?? <span className="text-muted-foreground">Unassigned</span>}</td>
              <td className={td}><Badge variant={RES_STATUS[r.status].variant}>{RES_STATUS[r.status].label}</Badge></td>
              <td className={`${td} space-x-1 whitespace-nowrap text-right`}>
                {r.status === "booked" && (
                  <>
                    <Button size="sm" onClick={() => act(r, "seated", "Guest seated")}>Seat</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(r, "no_show", "Marked no-show")}>No-show</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(r, "cancelled", "Reservation cancelled")}>Cancel</Button>
                    <Button size="icon" variant="ghost" aria-label={`Edit reservation for ${r.customerName}`} onClick={() => setEditing(r)}><Pencil className="size-4" /></Button>
                  </>
                )}
                {r.status === "seated" && <Button size="sm" variant="outline" onClick={() => act(r, "completed", "Reservation completed")}>Complete</Button>}
                {r.status !== "seated" && (
                  <Confirm
                    title={`Delete reservation for ${r.customerName}?`}
                    body="This will soft delete the reservation. If a table was held, it will be released."
                    onConfirm={() => withToast(deleteReservation({ tenantId: tenant.id, id: r.id }), "Reservation deleted")}
                  >
                    <Button size="icon" variant="ghost" aria-label={`Delete reservation for ${r.customerName}`} className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="size-4" />
                    </Button>
                  </Confirm>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {editing && <ReservationDialog res={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const toLocalInput = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");

function ReservationDialog({ res, onClose }: { res: Reservation | null; onClose: () => void }) {
  const { tenant, branch } = useTenant();
  const tables = useTablesQuery({ tenantId: tenant.id, branchId: branch.id });
  const [save, { isLoading }] = useSaveReservationMutation();
  const [deleteReservation, { isLoading: isDeleting }] = useDeleteReservationMutation();
  const [v, setV] = useState({
    customerName: res?.customerName ?? "",
    phone: res?.phone ?? "",
    partySize: String(res?.partySize ?? 2),
    at: toLocalInput(res?.at ?? new Date(Math.ceil(Date.now() / 1800000) * 1800000 + 3600000).toISOString()),
    durationMin: String(res?.durationMin ?? 90),
    tableId: res?.tableId ?? "none",
    notes: res?.notes ?? "",
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{res ? `Edit reservation — ${res.customerName}` : "New reservation"}</DialogTitle></DialogHeader>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const input = {
              tenantId: tenant.id,
              id: res?.id,
              branchId: res?.branchId || branch.id,
              customerName: v.customerName,
              phone: v.phone,
              partySize: num(v.partySize),
              at: new Date(v.at).toISOString(),
              durationMin: num(v.durationMin) || 90,
              tableId: v.tableId === "none" ? null : v.tableId,
              notes: v.notes,
            };
            if (await withToast(save(input), res ? "Reservation updated" : "Reservation saved")) onClose();
          }}
        >
          <Field label="Guest name" className="col-span-2">{(id) => <Input id={id} value={v.customerName} maxLength={60} onChange={set("customerName")} required />}</Field>
          <Field label="Phone">{(id) => <Input id={id} type="tel" value={v.phone} maxLength={20} onChange={set("phone")} />}</Field>
          <Field label="Party size">{(id) => <Input id={id} inputMode="numeric" value={v.partySize} onChange={set("partySize")} />}</Field>
          <Field label="Date & time">{(id) => <Input id={id} type="datetime-local" value={v.at} onChange={set("at")} required />}</Field>
          <Field label="Duration (min)">{(id) => <Input id={id} inputMode="numeric" value={v.durationMin} onChange={set("durationMin")} />}</Field>
          <Field label="Table" className="col-span-2">
            {(id) => (
              <Select value={v.tableId} onValueChange={(t) => setV({ ...v, tableId: t })}>
                <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Assign later</SelectItem>
                  {(tables.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.seats} seats · {t.area}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Notes" className="col-span-2">{(id) => <Textarea id={id} value={v.notes} maxLength={140} onChange={set("notes")} />}</Field>
          <DialogFooter className="col-span-2 flex items-center justify-between sm:justify-between">
            {res && res.status !== "seated" ? (
              <Confirm
                title={`Delete reservation for ${res.customerName}?`}
                body="This will soft delete the reservation. If a table was held, it will be released."
                onConfirm={async () => {
                  const ok = await withToast(deleteReservation({ tenantId: tenant.id, id: res.id }), "Reservation deleted");
                  if (ok) onClose();
                }}
              >
                <Button type="button" variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Trash2 className="mr-1.5 size-4" />} Delete
                </Button>
              </Confirm>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="size-4 animate-spin" />} {res ? "Update" : "Save"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
