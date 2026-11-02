import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, LogOut } from "lucide-react";
import { RequireSession, useSignOut } from "@/features/auth/require-session";
import { useActivationQuery, useMyTenantsQuery, api } from "@/app/api";
import { useAppDispatch } from "@/app/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/states";
import { ROLE_LABELS } from "@/config/permissions.config";
import { simulateActivation } from "@/services/platform.service";
import { landingPathFor } from "@/features/tenant/landing";
import type { ActivationStatus, Tenant, User, RoleId } from "@/types/domain";

export const Route = createFileRoute("/workspace/select")({
  head: () => ({
    meta: [
      { title: "Choose a restaurant — Tablewise POS" },
      { name: "description", content: "Pick the restaurant workspace you want to open." },
      { property: "og:title", content: "Choose a restaurant — Tablewise POS" },
      { property: "og:description", content: "Pick the restaurant workspace you want to open." },
    ],
  }),
  component: () => <RequireSession>{(user) => <SelectWorkspace user={user} />}</RequireSession>,
});

function SelectWorkspace({ user }: { user: User }) {
  const tenants = useMyTenantsQuery(user.id);
  const signOut = useSignOut();
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
          <h1 className="mt-1 text-2xl font-bold">Choose a restaurant</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
      {tenants.isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
      {tenants.isError && <ErrorState message="Couldn't load your restaurants." onRetry={tenants.refetch} />}
      <ul className="space-y-3">
        {tenants.data?.map((t) => <TenantRow key={t.id} tenant={t} user={user} />)}
      </ul>
      <div className="mt-8 rounded-lg border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground">
        Workspace access is synchronized directly with your account credentials and role assignments on the server.
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<ActivationStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  active: { label: "Active", variant: "success" },
  grace: { label: "Grace period", variant: "warning" },
  inactive: { label: "Inactive", variant: "danger" },
};

function TenantRow({ tenant, user }: { tenant: Tenant; user: User }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const activation = useActivationQuery(tenant.id);
  const role: RoleId = (user.memberships.find((m) => m.tenantId === tenant.id)?.role ?? (tenant as any).role ?? "waiter") as RoleId;
  const status = activation.data?.status;

  const open = () => {
    if (status === "inactive") navigate({ to: "/workspace/inactive", search: { tenant: tenant.slug } });
    else navigate({ to: `/app/$tenantSlug/${landingPathFor(role)}`, params: { tenantSlug: tenant.slug } });
  };

  const simulate = (s: ActivationStatus) => {
    simulateActivation(tenant.id, s);
    dispatch(api.util.invalidateTags([{ type: "Activation", id: tenant.id }]));
  };

  return (
    <li className="rounded-lg border bg-card">
      <button onClick={open} disabled={activation.isLoading} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-accent/60 disabled:opacity-60">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md font-display font-bold text-primary-foreground" style={{ background: tenant.accent }}>
          {tenant.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{tenant.name}</span>
          <span className="block text-sm text-muted-foreground">{tenant.tagline} · {ROLE_LABELS[role] || role}</span>
        </span>
        {status ? <Badge variant={STATUS_BADGE[status].variant}>{STATUS_BADGE[status].label}</Badge> : <Skeleton className="h-5 w-16" />}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </button>
      <div className="flex items-center gap-1 border-t px-4 py-2 text-xs text-muted-foreground">
        Simulate:
        {(["active", "grace", "inactive"] as const).map((s) => (
          <button key={s} onClick={() => simulate(s)} className={`rounded px-2 py-0.5 hover:bg-accent ${status === s ? "font-semibold text-foreground" : ""}`}>
            {STATUS_BADGE[s].label}
          </button>
        ))}
      </div>
    </li>
  );
}
