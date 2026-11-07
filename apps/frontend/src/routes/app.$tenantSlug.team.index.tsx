import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Building2,
  Filter,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import {
  useAllBranchesQuery,
  useDeleteStaffMutation,
  useSaveStaffMutation,
  useStaffQuery,
} from "@/features/people/api";
import { withToast } from "@/features/tenant/use-mutation-toast";
import { ROLE_LABELS } from "@/config/permissions.config";
import { Confirm, DataTable } from "@/components/common/confirm";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { num } from "@/components/common/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  getCustomRoles,
  getCustomRolesSync,
} from "@/services/people.service";
import type { CustomRole, RoleId, StaffMember } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/team/")({
  head: () => ({
    meta: [
      { title: "Staff Directory — Tablewise POS" },
      { name: "description", content: "Manage restaurant staff members, branch assignments, and invitations." },
    ],
  }),
  component: () => (
    <RequirePermission perm="staff.manage">
      <StaffDirectoryPage />
    </RequirePermission>
  ),
});

const ROLE_BADGE_COLORS: Record<RoleId, string> = {
  owner: "bg-primary/10 text-primary border-primary/20",
  manager: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  cashier: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  waiter: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  kitchen: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

function StaffDirectoryPage() {
  const { tenant, branches: contextBranches, can } = useTenant();
  const money = useMoney();
  const list = useStaffQuery(tenant.id);
  const branchesQuery = useAllBranchesQuery(tenant.id);
  const branches =
    branchesQuery.data && branchesQuery.data.length > 0
      ? branchesQuery.data
      : contextBranches && contextBranches.length > 0
        ? contextBranches
        : [];

  const [deleteStaff] = useDeleteStaffMutation();
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [editingStaff, setEditingStaff] = useState<StaffMember | "new" | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setCustomRoles(getCustomRolesSync(tenant.slug));
    getCustomRoles(tenant.slug).then(setCustomRoles).catch(console.error);
  }, [tenant.slug]);

  const bName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const canEdit = can("staff.manage");

  // Metrics
  const staffList = list.data || [];
  const totalStaff = staffList.length;
  const activeStaffCount = staffList.filter((s) => s.active && s.status !== "invited" && s.status !== "draft").length;
  const pendingInvitesCount = staffList.filter((s) => s.status === "invited").length;
  const draftCount = staffList.filter((s) => s.status === "draft").length;

  // Filtered rows
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staffList.filter((s) => {
      // Search matches
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q));

      // Role filter
      let matchesRole = true;
      if (roleFilter !== "all") {
        if (roleFilter.startsWith("custom:")) {
          const cName = roleFilter.replace("custom:", "");
          matchesRole = s.customRoleName === cName;
        } else {
          matchesRole = !s.customRoleName && s.role === roleFilter;
        }
      }

      // Branch filter
      let matchesBranch = true;
      if (branchFilter !== "all") {
        matchesBranch = s.branchIds === "all" || (Array.isArray(s.branchIds) && s.branchIds.includes(branchFilter));
      }

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== "all") {
        if (statusFilter === "active") {
          matchesStatus = s.active && s.status !== "invited" && s.status !== "draft";
        } else if (statusFilter === "invited") {
          matchesStatus = s.status === "invited";
        } else if (statusFilter === "draft") {
          matchesStatus = s.status === "draft";
        } else if (statusFilter === "inactive") {
          matchesStatus = !s.active;
        }
      }

      return matchesSearch && matchesRole && matchesBranch && matchesStatus;
    });
  }, [staffList, search, roleFilter, branchFilter, statusFilter]);

  const hasActiveFilters = search || roleFilter !== "all" || branchFilter !== "all" || statusFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setBranchFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Staff Directory"
        description="Manage your restaurant staff members, branch assignments, and invitations."
        actions={
          canEdit && (
            <Button
              onClick={() => setEditingStaff("new")}
              size="sm"
              className="gap-1.5 font-medium shadow-xs"
            >
              <Plus className="size-4" /> Add staff member
            </Button>
          )
        }
      />

      {/* 4 Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Staff</span>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{totalStaff}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Registered team profiles</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Staff</span>
            <UserCheck className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {activeStaffCount}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Currently on-duty / working</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pending Invites</span>
            <Mail className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {pendingInvitesCount}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Awaiting password setup</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Drafts</span>
            <UserPlus className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {draftCount}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Unfinished onboardings</p>
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search staff by name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Multi-Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground mr-1">
            <Filter className="size-3.5" />
            <span>Filters:</span>
          </div>

          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase font-semibold text-muted-foreground">Standard</SelectLabel>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
              {customRoles.length > 0 && (
                <SelectGroup>
                  <SelectSeparator />
                  <SelectLabel className="text-[10px] uppercase font-semibold text-purple-600 dark:text-purple-400">Custom Roles</SelectLabel>
                  {customRoles.map((cr) => (
                    <SelectItem key={cr.id} value={`custom:${cr.name}`}>
                      {cr.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {/* Branch Filter */}
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="size-3" /> Reset
            </Button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            Showing <strong className="text-foreground">{filteredStaff.length}</strong> of {totalStaff} members
          </div>
        </div>
      </div>

      {/* Staff Table */}
      {list.isLoading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}

      {list.isError && (
        <ErrorState
          title="Couldn't load staff members"
          message="There was an issue connecting to the staff directory."
          onRetry={() => list.refetch()}
        />
      )}

      {list.data && filteredStaff.length === 0 && (
        <EmptyState
          title={hasActiveFilters ? "No matching staff members" : "No staff members yet"}
          description={
            hasActiveFilters
              ? "Try resetting your search query or filter selection."
              : "Invite your restaurant team members, assign their branch duties, and configure roles."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : canEdit ? (
              <Button size="sm" onClick={() => setEditingStaff("new")}>
                <Plus className="size-4 mr-1.5" /> Add staff member
              </Button>
            ) : undefined
          }
        />
      )}

      {list.data && filteredStaff.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-2xs">
          <DataTable
            headers={[
              "Staff member",
              "Role",
              "Branch access",
              "Hourly rate",
              "Status",
              canEdit ? "Actions" : "",
            ].filter(Boolean)}
            rows={filteredStaff.map((s) => {
              const customMatch = s.customRoleName
                ? customRoles.find((cr) => cr.name.toLowerCase() === s.customRoleName?.toLowerCase())
                : null;

              return [
                // Staff member info with avatar initials
                <div key="member" className="flex items-center gap-3 py-1">
                  <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs border border-primary/20 shrink-0">
                    {s.initials || s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.email || (s.phone ? s.phone : "No email")}
                    </div>
                  </div>
                </div>,

                // Role badge
                <div key="role" className="py-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium",
                      ROLE_BADGE_COLORS[s.role] || ROLE_BADGE_COLORS.waiter
                    )}
                  >
                    {s.customRoleName || ROLE_LABELS[s.role] || s.role}
                  </Badge>
                </div>,

                // Branch access
                <div key="branches" className="py-1 text-xs">
                  {s.branchIds === "all" ? (
                    <Badge variant="secondary" className="font-normal text-[11px]">
                      All branches ({branches.length})
                    </Badge>
                  ) : Array.isArray(s.branchIds) && s.branchIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {s.branchIds.slice(0, 2).map((bid) => (
                        <Badge key={bid} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                          {bName(bid)}
                        </Badge>
                      ))}
                      {s.branchIds.length > 2 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{s.branchIds.length - 2} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>,

                // Hourly rate
                <div key="rate" className="py-1 text-xs tabular font-medium">
                  {s.hourlyRate && s.hourlyRate > 0 ? (
                    `${money(s.hourlyRate)}/hr`
                  ) : (
                    <span className="text-muted-foreground font-normal">—</span>
                  )}
                </div>,

                // Status
                <div key="status" className="py-1">
                  {s.status === "invited" ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px]">
                      Invited
                    </Badge>
                  ) : s.status === "draft" ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[11px]">
                      Draft
                    </Badge>
                  ) : s.active ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px]">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[11px]">
                      Inactive
                    </Badge>
                  )}
                </div>,

                // Actions
                canEdit && (
                  <div key="actions" className="flex items-center justify-end gap-1.5 py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingStaff(s)}
                      title={`Edit ${s.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Confirm
                      title={`Remove ${s.name}?`}
                      body="This staff member will lose access to all restaurant branches and terminals. This action cannot be undone."
                      confirmLabel="Remove staff"
                      onConfirm={async () => {
                        await withToast(deleteStaff({ tenantId: tenant.id, id: s.id }), "Staff member removed");
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title={`Remove ${s.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </Confirm>
                  </div>
                ),
              ].filter(Boolean) as React.ReactNode[];
            })}
          />
        </div>
      )}

      {/* Staff Creation & Edit Dialog */}
      {editingStaff && (
        <StaffDialog
          s={editingStaff === "new" ? null : editingStaff}
          onClose={() => setEditingStaff(null)}
          customRoles={customRoles}
        />
      )}
    </div>
  );
}

// ---------- Staff Dialog ----------
function StaffDialog({
  s,
  onClose,
  customRoles,
}: {
  s: StaffMember | null;
  onClose: () => void;
  customRoles: CustomRole[];
}) {
  const { tenant, branches: contextBranches } = useTenant();
  const branchesQuery = useAllBranchesQuery(tenant.id);
  const [save, { isLoading }] = useSaveStaffMutation();

  const availableBranches =
    branchesQuery.data && branchesQuery.data.length > 0
      ? branchesQuery.data
      : contextBranches && contextBranches.length > 0
        ? contextBranches
        : [];

  const [v, setV] = useState({
    name: s?.name ?? "",
    email: s?.email ?? "",
    phone: s?.phone ?? "",
    role: s?.role ?? ("waiter" as RoleId),
    customRoleName: s?.customRoleName ?? "",
    hourlyRate: String(s?.hourlyRate ?? 0),
    active: s?.active ?? true,
  });

  const [all, setAll] = useState(s ? s.branchIds === "all" : true);
  const [picked, setPicked] = useState<string[]>(
    s && s.branchIds !== "all"
      ? s.branchIds
      : availableBranches[0]?.id
        ? [availableBranches[0].id]
        : []
  );

  const toggleBranch = (branchId: string) => {
    if (all) {
      setAll(false);
      setPicked([branchId]);
    } else {
      if (picked.includes(branchId)) {
        setPicked(picked.filter((id) => id !== branchId));
      } else {
        const next = [...picked, branchId];
        if (availableBranches.length > 0 && next.length === availableBranches.length) {
          setAll(true);
          setPicked([]);
        } else {
          setPicked(next);
        }
      }
    }
  };

  const handleToggleAll = (checked: boolean) => {
    setAll(checked);
    if (!checked) {
      if (picked.length === 0 && availableBranches[0]?.id) {
        setPicked([availableBranches[0].id]);
      }
    }
  };

  const handleSave = async (statusOverride?: "draft" | "invited") => {
    if (!v.name.trim()) return;
    const input = {
      tenantId: tenant.id,
      id: s?.id,
      ...v,
      name: v.name.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      role: v.role,
      customRoleName: v.customRoleName?.trim() || undefined,
      hourlyRate: num(v.hourlyRate) || 0,
      branchIds: all ? ("all" as const) : picked,
      status: statusOverride ?? (s?.status || (v.email.trim() && !s ? "invited" : "active")),
      sendInvite: statusOverride === "draft" ? false : true,
    };
    const toastMsg =
      statusOverride === "draft"
        ? "Saved as draft"
        : v.email.trim() && !s
          ? "Invitation email sent"
          : "Staff saved";
    if (await withToast(save(input), toastMsg)) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-1 pb-2">
          <DialogTitle className="text-xl font-semibold">
            {s ? `Edit ${s.name}` : "Add Staff Member"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {s
              ? "Update role, contact details, and branch assignments."
              : "Create a staff member as a draft or send an email invitation with login setup."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-1"
          onSubmit={async (e) => {
            e.preventDefault();
            await handleSave();
          }}
        >
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="staff-name" className="text-sm font-medium">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="staff-name"
              value={v.name}
              maxLength={60}
              placeholder="e.g. Tanvir Hossain"
              onChange={(e) => setV({ ...v, name: e.target.value })}
              required
              className="h-10 w-full"
            />
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="staff-email" className="text-sm font-medium">
                Email Address
              </Label>
              <span className="text-xs text-muted-foreground">For invitation link</span>
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                id="staff-email"
                type="email"
                value={v.email}
                maxLength={120}
                placeholder="staff.member@restaurant.com"
                onChange={(e) => setV({ ...v, email: e.target.value })}
                className="pl-9 h-10 w-full"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              An invitation link will be sent to this email so the staff member can set their password.
            </p>
          </div>

          {/* Phone & Hourly rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-phone" className="text-sm font-medium">
                Phone Number (optional)
              </Label>
              <Input
                id="staff-phone"
                type="tel"
                value={v.phone}
                maxLength={30}
                placeholder="e.g. +880 1711-000111"
                onChange={(e) => setV({ ...v, phone: e.target.value })}
                className="h-10 w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-rate" className="text-sm font-medium">
                Hourly Rate ({tenant.currency || "BDT"})
              </Label>
              <Input
                id="staff-rate"
                inputMode="decimal"
                value={v.hourlyRate}
                placeholder="0.00"
                onChange={(e) => setV({ ...v, hourlyRate: e.target.value })}
                className="h-10 w-full"
              />
            </div>
          </div>

          {/* Staff Role Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="staff-role" className="text-sm font-medium">
              Staff Role <span className="text-destructive">*</span>
            </Label>
            <Select
              value={v.customRoleName ? `custom:${v.customRoleName}` : `standard:${v.role}`}
              onValueChange={(val) => {
                if (val.startsWith("custom:")) {
                  const cName = val.replace("custom:", "");
                  const found = customRoles.find((cr) => cr.name === cName);
                  setV({
                    ...v,
                    customRoleName: cName,
                    role: found ? found.baseRole : "waiter",
                  });
                } else {
                  const stdRole = val.replace("standard:", "") as RoleId;
                  setV({
                    ...v,
                    customRoleName: "",
                    role: stdRole,
                  });
                }
              }}
            >
              <SelectTrigger id="staff-role" className="h-10 w-full">
                <SelectValue placeholder="Select staff role" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-xs uppercase font-semibold text-muted-foreground">Standard Roles</SelectLabel>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={`standard:${key}`}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {customRoles.length > 0 && (
                  <SelectGroup>
                    <SelectSeparator />
                    <SelectLabel className="text-xs uppercase font-semibold text-purple-600 dark:text-purple-400">Custom Roles</SelectLabel>
                    {customRoles.map((cr) => (
                      <SelectItem key={cr.id} value={`custom:${cr.name}`}>
                        {cr.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Branch Access Section */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <Label className="text-sm font-semibold">Branch Access</Label>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="all-branches-toggle" className="text-xs text-muted-foreground cursor-pointer">
                  All branches
                </label>
                <Switch id="all-branches-toggle" checked={all} onCheckedChange={handleToggleAll} />
              </div>
            </div>

            {!all && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">Select which branches this staff member can access:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-40 overflow-y-auto">
                  {availableBranches.map((b) => {
                    const isChecked = picked.includes(b.id);
                    return (
                      <div
                        key={b.id}
                        onClick={() => toggleBranch(b.id)}
                        className={cn(
                          "flex items-center space-x-2.5 rounded-md border p-2.5 cursor-pointer transition-colors",
                          isChecked
                            ? "border-primary/50 bg-primary/5 font-medium"
                            : "border-border hover:bg-accent/40"
                        )}
                      >
                        <Checkbox
                          id={`branch-${b.id}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleBranch(b.id)}
                        />
                        <label htmlFor={`branch-${b.id}`} className="text-xs font-medium cursor-pointer leading-none flex-1 truncate">
                          {b.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {!s && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLoading || !v.name.trim()}
                  onClick={() => handleSave("draft")}
                >
                  Save as draft
                </Button>
              )}
              <Button type="submit" disabled={isLoading || !v.name.trim()}>
                {isLoading && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {s ? "Save changes" : v.email.trim() ? "Send invitation" : "Add staff"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
