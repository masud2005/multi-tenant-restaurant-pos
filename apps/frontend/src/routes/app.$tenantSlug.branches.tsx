import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useAllBranchesQuery, useSaveBranchMutation } from "@/features/people/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { ErrorState, PageHeader } from "@/components/common/states";
import { Field } from "@/components/common/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Branch } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/branches")({
  head: () => ({ meta: [{ title: "Branches — Tablewise POS" }, { name: "description", content: "Locations for this restaurant." }] }),
  component: () => (
    <RequirePermission perm="branches.manage">
      <Branches />
    </RequirePermission>
  ),
});

function Branches() {
  const { tenant, branch } = useTenant();
  const list = useAllBranchesQuery(tenant.id);
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  return (
    <div>
      <PageHeader title="Branches" description="New branches start with your ingredient list at zero stock." actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New branch</Button>} />
      {list.isLoading && <Skeleton className="h-40" />}
      {list.isError && <ErrorState message="Couldn't load branches." onRetry={list.refetch} />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(list.data ?? []).map((b) => (
          <article key={b.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between">
              <h2 className="font-semibold">{b.name} {b.id === branch.id && <Badge variant="info" className="ml-1">Current</Badge>}</h2>
              <Button size="icon" variant="ghost" aria-label={`Edit ${b.name}`} onClick={() => setEditing(b)}><Pencil className="size-4" /></Button>
            </div>
            <p className="mt-1 flex gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-3.5" aria-hidden />{b.address || "—"}</p>
            <p className="mt-1 flex gap-1.5 text-sm text-muted-foreground"><Phone className="mt-0.5 size-3.5" aria-hidden />{b.phone || "—"}</p>
          </article>
        ))}
      </div>
      {editing && <BranchDialog b={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BranchDialog({ b, onClose }: { b: Branch | null; onClose: () => void }) {
  const { tenant } = useTenant();
  const [save, { isLoading }] = useSaveBranchMutation();
  const [v, setV] = useState({ name: b?.name ?? "", address: b?.address ?? "", phone: b?.phone ?? "" });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{b ? `Edit ${b.name}` : "New branch"}</DialogTitle></DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await withToast(save({ tenantId: tenant.id, id: b?.id, ...v }), "Branch saved")) onClose();
          }}
        >
          <Field label="Name">{(id) => <Input id={id} placeholder="e.g. Dhanmondi Outlet" value={v.name} maxLength={40} onChange={(e) => setV({ ...v, name: e.target.value })} required />}</Field>
          <Field label="Address">{(id) => <Input id={id} placeholder="e.g. House 45, Road 27, Dhanmondi, Dhaka" value={v.address} maxLength={120} onChange={(e) => setV({ ...v, address: e.target.value })} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} type="tel" placeholder="e.g. +880 1711-000222" value={v.phone} maxLength={30} onChange={(e) => setV({ ...v, phone: e.target.value })} />}</Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="size-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
