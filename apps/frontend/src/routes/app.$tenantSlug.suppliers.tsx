import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useDeleteSupplierMutation, useSaveSupplierMutation, useSuppliersQuery } from "@/features/backoffice/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { Confirm, DataTable, FieldError, td } from "@/components/common/confirm";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Supplier } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Tablewise POS" }, { name: "description", content: "Supplier contacts and terms." }] }),
  component: () => (
    <RequirePermission perm="purchasing.manage">
      <Suppliers />
    </RequirePermission>
  ),
});

function Suppliers() {
  const { tenant } = useTenant();
  const list = useSuppliersQuery(tenant.id);
  const [del] = useDeleteSupplierMutation();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const rows = (list.data ?? []).filter((s) => `${s.name} ${s.contact} ${s.supplies}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <PageHeader title="Suppliers" description="Shared across all branches." actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New supplier</Button>} />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers" className="mb-4 max-w-xs" aria-label="Search suppliers" />
      {list.isLoading && <Skeleton className="h-48" />}
      {list.isError && <ErrorState message="Couldn't load suppliers." onRetry={list.refetch} />}
      {list.data && rows.length === 0 && <EmptyState title="No suppliers" />}
      {rows.length > 0 && (
        <DataTable head={["Supplier", "Contact", "Supplies", "Terms", "Status", ""]}>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className={`${td} font-medium`}>{s.name}</td>
              <td className={td}>{s.contact}<p className="text-xs text-muted-foreground">{s.phone} · {s.email}</p></td>
              <td className={`${td} text-muted-foreground`}>{s.supplies.split(",").join(", ")}</td>
              <td className={td}>{s.paymentTerms}</td>
              <td className={td}>{s.active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}</td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <Button size="icon" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil className="size-4" /></Button>
                <Confirm
                  title={`Delete ${s.name}?`}
                  body="This supplier will be removed from active lists."
                  onConfirm={() => withToast(del({ tenantId: tenant.id, id: s.id }), "Supplier deleted")}
                >
                  <Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`}><Trash2 className="size-4" /></Button>
                </Confirm>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {editing && <SupplierDialog supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  contact: z.string().trim().max(60),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), z.string().trim().email("Invalid email")]),
  supplies: z.string().max(200),
  paymentTerms: z.string().max(40),
  active: z.boolean(),
});

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { tenant } = useTenant();
  const [save, { isLoading }] = useSaveSupplierMutation();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: supplier ?? { name: "", contact: "", phone: "", email: "", supplies: "", paymentTerms: "Net 14", active: true },
  });
  const e = form.formState.errors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{supplier ? `Edit ${supplier.name}` : "New supplier"}</DialogTitle></DialogHeader>
        <form
          noValidate
          className="grid grid-cols-2 gap-3"
          onSubmit={form.handleSubmit(async (v) => {
            if (await withToast(save({ tenantId: tenant.id, id: supplier?.id, ...v }), "Supplier saved")) onClose();
          })}
        >
          <div className="col-span-2 space-y-1.5"><Label htmlFor="s-name">Name</Label><Input id="s-name" {...form.register("name")} /><FieldError msg={e.name?.message} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-contact">Contact person</Label><Input id="s-contact" {...form.register("contact")} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-phone">Phone</Label><Input id="s-phone" {...form.register("phone")} /></div>
          <div className="col-span-2 space-y-1.5"><Label htmlFor="s-email">Email</Label><Input id="s-email" type="email" {...form.register("email")} /><FieldError msg={e.email?.message} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-supplies">Supplies</Label><Input id="s-supplies" placeholder="rice, flour" {...form.register("supplies")} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-terms">Payment terms</Label><Input id="s-terms" {...form.register("paymentTerms")} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={form.watch("active")} onCheckedChange={(v) => form.setValue("active", v)} /> Active (can receive new orders)</label>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="size-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
