import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Building2,
  Check,
  Info,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
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
import { Confirm, DataTable, td } from "@/components/common/confirm";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  deleteCustomRole,
  getCustomRoles,
  saveCustomRole,
} from "@/services/people.service";
import type { CustomRole, RoleId, StaffMember } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/team/")({
  head: () => ({
    meta: [
      { title: "Team & Roles — Tablewise POS" },
      { name: "description", content: "Manage restaurant roles, designations, and staff directory." },
    ],
  }),
  component: () => (
    <RequirePermission perm="shifts.manage">
      <TeamPage />
    </RequirePermission>
  ),
});

const STANDARD_ROLE_INFO: { id: RoleId; name: string; description: string; badge: string }[] = [
  {
    id: "owner",
    name: "Owner",
    description: "Unrestricted superadmin access across all branches, financials, staff, and system settings.",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  {
    id: "manager",
    name: "Manager",
    description: "Branch operations leader managing POS, kitchen, menu, inventory, discounts, and reporting.",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    id: "cashier",
    name: "Cashier",
    description: "Front-desk counter staff handling POS terminal, orders, payments, discounts, and cash drawer.",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: "waiter",
    name: "Waiter",
    description: "Floor service staff managing table occupancy, taking dine-in orders, and booking reservations.",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    description: "Back-of-house kitchen display station for line cooks tracking live order tickets and food preparation.",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
];

const COLOR_PRESETS = [
  { id: "purple", label: "Purple", badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", dot: "bg-purple-500" },
  { id: "indigo", label: "Indigo", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20", dot: "bg-indigo-500" },
  { id: "sky", label: "Sky Blue", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20", dot: "bg-sky-500" },
  { id: "teal", label: "Teal", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20", dot: "bg-teal-500" },
  { id: "amber", label: "Amber", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  { id: "rose", label: "Rose", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20", dot: "bg-rose-500" },
];

function TeamPage() {
  const location = useLocation();
  const tabParam = (location.search as Record<string, unknown> | undefined)?.["tab"];
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
  const [activeTab, setActiveTab] = useState<"roles" | "staff">(
    tabParam === "staff" ? "staff" : "roles"
  );

  // Staff dialog
  const [editingStaff, setEditingStaff] = useState<StaffMember | "new" | null>(null);

  // Custom roles state & dialog
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [editingRole, setEditingRole] = useState<CustomRole | "new" | null>(null);

  useEffect(() => {
    setCustomRoles(getCustomRoles(tenant.slug));
  }, [tenant.slug]);

  const bName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const canEdit = can("staff.manage");

  const totalRoles = STANDARD_ROLE_INFO.length + customRoles.length;
  const totalStaff = list.data?.length ?? 0;

  const handleDeleteRole = (role: CustomRole) => {
    deleteCustomRole(tenant.slug, role.id);
    const updated = customRoles.filter((r) => r.id !== role.id);
    setCustomRoles(updated);
    toast.success(`Role "${role.name}" deleted.`);
  };

  return (
    <div className="space-y-6">
      {/* Tab bar header */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "roles" | "staff")}>
        <div className="flex items-center justify-between border-b pb-3">
          <TabsList className="h-10 p-1 bg-muted/60">
            <TabsTrigger
              value="roles"
              className="gap-2 px-4 py-1.5 font-medium text-sm data-[state=active]:shadow-xs"
            >
              <Shield className="size-4 text-primary" />
              Roles
              <Badge variant="secondary" className="ml-1 text-[11px] h-5 px-1.5 font-normal">
                {totalRoles}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="staff"
              className="gap-2 px-4 py-1.5 font-medium text-sm data-[state=active]:shadow-xs"
            >
              <Users className="size-4 text-primary" />
              Staff
              {list.data && (
                <Badge variant="secondary" className="ml-1 text-[11px] h-5 px-1.5 font-normal">
                  {totalStaff}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ===================== TAB 1: ROLES ===================== */}
        <TabsContent value="roles" className="mt-4 space-y-5">
          <PageHeader
            title="Roles"
            description="Manage restaurant staff roles. Assign these roles to staff members in your team."
            actions={
              canEdit && (
                <Button
                  onClick={() => setEditingRole("new")}
                  className="gap-1.5 font-medium shadow-xs"
                >
                  <Plus className="size-4" /> Create role
                </Button>
              )
            }
          />

          <DataTable head={["Role", "Description", "Assigned Staff", ""]}>
            {/* Standard Roles */}
            {STANDARD_ROLE_INFO.map((r) => {
              const staffCount = (list.data || []).filter(
                (s) => !s.customRoleName && s.role === r.id
              ).length;
              return (
                <tr key={r.id}>
                  <td className={`${td} font-medium`}>
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-primary shrink-0" />
                      <span className="font-semibold">{r.name}</span>
                    </div>
                  </td>
                  <td className={`${td} text-xs text-muted-foreground max-w-md leading-relaxed`}>
                    {r.description}
                  </td>
                  <td className={td}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("staff")}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      title="View assigned staff members"
                    >
                      <Users className="size-3.5" />
                      {staffCount} {staffCount === 1 ? "member" : "members"}
                    </button>
                  </td>
                  <td className={`${td} text-right text-xs text-muted-foreground whitespace-nowrap`}>
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      Standard
                    </Badge>
                  </td>
                </tr>
              );
            })}

            {/* Custom Roles */}
            {customRoles.map((cr) => {
              const staffCount = (list.data || []).filter((s) => s.customRoleName === cr.name).length;

              return (
                <tr key={cr.id} className="bg-purple-500/[0.02]">
                  <td className={`${td} font-medium`}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span className="font-semibold text-purple-950 dark:text-purple-200">{cr.name}</span>
                    </div>
                  </td>
                  <td className={`${td} text-xs text-muted-foreground max-w-md leading-relaxed`}>
                    {cr.description || "—"}
                  </td>
                  <td className={td}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("staff")}
                      className="flex items-center gap-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:underline"
                      title="View assigned staff members"
                    >
                      <Users className="size-3.5" />
                      {staffCount} {staffCount === 1 ? "member" : "members"}
                    </button>
                  </td>
                  <td className={`${td} text-right space-x-1 whitespace-nowrap`}>
                    {canEdit && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={`Edit ${cr.name}`}
                          onClick={() => setEditingRole(cr)}
                        >
                          <Pencil className="size-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Confirm
                          title={`Delete "${cr.name}" role?`}
                          body={`Are you sure you want to delete the custom role "${cr.name}"?`}
                          confirmLabel="Delete role"
                          onConfirm={() => handleDeleteRole(cr)}
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            title={`Delete ${cr.name}`}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </Confirm>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </TabsContent>

        {/* ===================== TAB 2: STAFF ===================== */}
        <TabsContent value="staff" className="mt-4 space-y-4">
          <PageHeader
            title="Staff"
            description={
              canEdit
                ? "Add staff as drafts or send email invitations. Staff receive a link to set their own password."
                : "Only the owner can change staff and roles."
            }
            actions={
              canEdit && (
                <Button onClick={() => setEditingStaff("new")} className="gap-1.5 shadow-xs">
                  <Plus className="size-4" /> Add staff
                </Button>
              )
            }
          />

          {list.isLoading && <Skeleton className="h-48" />}
          {list.isError && <ErrorState message="Couldn't load staff." onRetry={list.refetch} />}
          {list.data && list.data.length === 0 && <EmptyState title="No staff yet" />}
          {list.data && list.data.length > 0 && (
            <DataTable head={["Name", "Role", "Branches", "Hourly rate", "Status", ""]}>
              {list.data.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} font-medium`}>
                    {s.name}
                    {s.userId && <Badge variant="info" className="ml-2">Sign-in</Badge>}
                    <p className="text-xs text-muted-foreground">{s.email || s.phone || "—"}</p>
                  </td>
                  <td className={td}>
                    {s.customRoleName ? (
                      <Badge variant="outline" className="text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30">
                        {s.customRoleName}
                      </Badge>
                    ) : (
                      <span>{ROLE_LABELS[s.role] || s.role}</span>
                    )}
                  </td>
                  <td className={td}>{s.branchIds === "all" ? "All branches" : s.branchIds.map(bName).join(", ")}</td>
                  <td className={td}>{s.hourlyRate ? money(s.hourlyRate) : "—"}</td>
                  <td className={td}>
                    {s.status === "invited" ? (
                      <Badge variant="warning">Invited</Badge>
                    ) : s.status === "draft" ? (
                      <Badge variant="muted">Draft</Badge>
                    ) : s.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="muted">Inactive</Badge>
                    )}
                  </td>
                  <td className={`${td} text-right space-x-1 whitespace-nowrap`}>
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setEditingStaff(s)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Confirm
                          title={`Remove ${s.name}?`}
                          body="This will soft delete the staff member from the active directory."
                          onConfirm={() => withToast(deleteStaff({ tenantId: tenant.id, id: s.id }), "Staff member removed")}
                        >
                          <Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="size-4" />
                          </Button>
                        </Confirm>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>
      </Tabs>

      {/* Staff Dialog */}
      {editingStaff && (
        <StaffDialog
          s={editingStaff === "new" ? null : editingStaff}
          onClose={() => setEditingStaff(null)}
          onOpenRolesTab={() => {
            setEditingStaff(null);
            setActiveTab("roles");
          }}
        />
      )}

      {/* Role Dialog (Create & Update) */}
      {editingRole && (
        <RoleDialog
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={(savedRole) => {
            setCustomRoles((prev) => {
              const idx = prev.findIndex((r) => r.id === savedRole.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = savedRole;
                return next;
              }
              return [...prev, savedRole];
            });
            list.refetch();
          }}
        />
      )}
    </div>
  );
}

// ---------- Role Dialog (Create & Edit) ----------
function RoleDialog({
  role,
  onClose,
  onSaved,
}: {
  role: CustomRole | "new";
  onClose: () => void;
  onSaved: (role: CustomRole) => void;
}) {
  const { tenant } = useTenant();
  const isNew = role === "new";

  const [name, setName] = useState(isNew ? "" : role.name);
  const [description, setDescription] = useState(isNew ? "" : (role.description || ""));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please enter a role name.");
      return;
    }

    const saved = saveCustomRole(tenant.slug, {
      ...(isNew ? {} : { id: role.id }),
      name: trimmed,
      description: description.trim(),
      baseRole: isNew ? "waiter" : role.baseRole,
      color: "purple",
      permissions: isNew ? [] : role.permissions,
    });

    toast.success(isNew ? `Role "${saved.name}" created!` : `Role "${saved.name}" updated!`);
    onSaved(saved);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            {isNew ? "Create role" : `Edit "${role.name}" role`}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "Add a new staff role (e.g. Bartender, Shift Supervisor, Head Chef, Hostess)."
              : "Update this role's name or description."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Role Name */}
          <div className="space-y-1.5">
            <Label htmlFor="custom-role-name">
              Role Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-role-name"
              placeholder="e.g. Bartender, Shift Supervisor, Hostess"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="custom-role-desc">Description (optional)</Label>
            <Textarea
              id="custom-role-desc"
              placeholder="Briefly describe the responsibilities of this role..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {isNew ? "Create role" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Staff Dialog ----------
function StaffDialog({
  s,
  onClose,
  onOpenRolesTab,
}: {
  s: StaffMember | null;
  onClose: () => void;
  onOpenRolesTab: () => void;
}) {
  const { tenant, branches: contextBranches } = useTenant();
  const branchesQuery = useAllBranchesQuery(tenant.id);
  const [save, { isLoading }] = useSaveStaffMutation();
  const customRoles = useMemo(() => getCustomRoles(tenant.slug), [tenant.slug]);

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

          {/* Role selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="staff-role" className="text-sm font-medium">
                Staff Role <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={onOpenRolesTab}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="size-3" /> Manage / Create roles
              </button>
            </div>
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
