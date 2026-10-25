import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  AlertCircle,
  Check,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import {
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/config/permissions.config";
import { Confirm } from "@/components/common/confirm";
import { PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  deleteCustomRole,
  getCustomRoles,
  getTenantRolesApi,
  saveCustomRole,
  updateCustomRolePermissions,
  updateRolePermissionsApi,
} from "@/services/people.service";
import type { CustomRole, RoleId } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/team/roles")({
  head: () => ({
    meta: [
      { title: "Roles & permissions — Tablewise POS" },
      {
        name: "description",
        content: "Role-based access control and system permissions matrix.",
      },
    ],
  }),
  component: () => (
    <RequirePermission perm="roles.view">
      <Roles />
    </RequirePermission>
  ),
});

// Configurable team roles (Owner is excluded as they possess permanent root/superadmin access)
const CONFIGURABLE_STAFF_ROLES: RoleId[] = ["manager", "cashier", "waiter", "kitchen"];

const ROLE_DETAILS: Record<RoleId, { description: string; color: string }> = {
  owner: {
    description: "Full unrestricted access across all branches, financials, staff, and system settings.",
    color: "bg-primary/10 text-primary border-primary/20",
  },
  manager: {
    description: "Branch operations leader managing POS, kitchen, menu, inventory, discounts, and reporting.",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  cashier: {
    description: "Front-desk counter staff handling POS terminal, orders, payments, discounts, and cash drawer.",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  waiter: {
    description: "Floor service staff managing table occupancy, taking dine-in orders, and booking reservations.",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  kitchen: {
    description: "Back-of-house kitchen display station for line cooks tracking live order tickets and food preparation.",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
};

const ROLE_COLOR_PRESETS: { id: string; label: string; badge: string; dot: string }[] = [
  { id: "purple", label: "Purple", badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", dot: "bg-purple-500" },
  { id: "indigo", label: "Indigo", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20", dot: "bg-indigo-500" },
  { id: "sky", label: "Sky Blue", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20", dot: "bg-sky-500" },
  { id: "teal", label: "Teal", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20", dot: "bg-teal-500" },
  { id: "amber", label: "Amber", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  { id: "rose", label: "Rose", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20", dot: "bg-rose-500" },
];

const PERMISSION_GROUPS: { name: string; perms: Permission[] }[] = [
  {
    name: "POS Terminal & Orders",
    perms: ["pos.use", "orders.view", "orders.manage", "orders.void", "discounts.apply"],
  },
  {
    name: "Kitchen & Dining Tables",
    perms: ["kitchen.view", "tables.view", "tables.manage", "reservations.manage"],
  },
  {
    name: "Payments & Cash Drawer",
    perms: ["payments.process", "payments.view", "refunds.process", "cash.manage", "expenses.manage"],
  },
  {
    name: "Menu, Recipes & Inventory",
    perms: ["menu.manage", "recipes.view", "inventory.view", "inventory.manage", "purchasing.manage"],
  },
  {
    name: "Customers & Delivery",
    perms: ["customers.manage", "promotions.manage", "delivery.manage"],
  },
  {
    name: "Management & System",
    perms: [
      "dashboard.view",
      "reports.view",
      "audit.view",
      "staff.manage",
      "roles.view",
      "branches.manage",
      "settings.manage",
      "notifications.view",
    ],
  },
];

function Roles() {
  const { tenant, can } = useTenant();
  const canEdit = can("staff.manage");
  const roles = CONFIGURABLE_STAFF_ROLES;

  const [permissionsMap, setPermissionsMap] = useState<Record<RoleId, Permission[]>>({
    owner: [...ROLE_PERMISSIONS.owner],
    manager: [...ROLE_PERMISSIONS.manager],
    cashier: [...ROLE_PERMISSIONS.cashier],
    kitchen: [...ROLE_PERMISSIONS.kitchen],
    waiter: [...ROLE_PERMISSIONS.waiter],
  });

  const [initialMap, setInitialMap] = useState<Record<RoleId, Permission[]>>({
    owner: [...ROLE_PERMISSIONS.owner],
    manager: [...ROLE_PERMISSIONS.manager],
    cashier: [...ROLE_PERMISSIONS.cashier],
    kitchen: [...ROLE_PERMISSIONS.kitchen],
    waiter: [...ROLE_PERMISSIONS.waiter],
  });

  // Custom roles state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customPermissionsMap, setCustomPermissionsMap] = useState<Record<string, Permission[]>>({});
  const [initialCustomMap, setInitialCustomMap] = useState<Record<string, Permission[]>>({});

  // Dialog state
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState<{
    name: string;
    description: string;
    baseRole: RoleId | "empty";
    color: string;
  }>({
    name: "",
    description: "",
    baseRole: "cashier",
    color: "purple",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");

  // Load active roles & permissions from backend and custom roles from storage
  useEffect(() => {
    let mounted = true;

    // Load custom roles
    const loadedCustom = getCustomRoles(tenant.slug);
    if (mounted) {
      setCustomRoles(loadedCustom);
      const cMap: Record<string, Permission[]> = {};
      for (const cr of loadedCustom) {
        cMap[cr.id] = (cr.permissions || []) as Permission[];
      }
      setCustomPermissionsMap(cMap);
      setInitialCustomMap(cMap);
    }

    getTenantRolesApi(tenant.slug)
      .then((data) => {
        if (!mounted) return;
        const loaded: Record<RoleId, Permission[]> = {
          owner: [...ROLE_PERMISSIONS.owner],
          manager: data.manager?.length ? data.manager : [...ROLE_PERMISSIONS.manager],
          cashier: data.cashier?.length ? data.cashier : [...ROLE_PERMISSIONS.cashier],
          kitchen: data.kitchen?.length ? data.kitchen : [...ROLE_PERMISSIONS.kitchen],
          waiter: data.waiter?.length ? data.waiter : [...ROLE_PERMISSIONS.waiter],
        };
        setPermissionsMap(loaded);
        setInitialMap(loaded);
      })
      .catch((err) => {
        console.error("Could not fetch tenant roles", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tenant.slug]);

  // Identify which standard roles have unsaved modifications
  const changedStandardRoles = useMemo(() => {
    const list: RoleId[] = [];
    for (const r of roles) {
      const cur = new Set(permissionsMap[r] || []);
      const init = new Set(initialMap[r] || []);
      if (cur.size !== init.size || [...cur].some((x) => !init.has(x))) {
        list.push(r);
      }
    }
    return list;
  }, [permissionsMap, initialMap, roles]);

  // Identify which custom roles have unsaved modifications
  const changedCustomRoles = useMemo(() => {
    const list: CustomRole[] = [];
    for (const cr of customRoles) {
      const cur = new Set(customPermissionsMap[cr.id] || []);
      const init = new Set(initialCustomMap[cr.id] || []);
      if (cur.size !== init.size || [...cur].some((x) => !init.has(x))) {
        list.push(cr);
      }
    }
    return list;
  }, [customRoles, customPermissionsMap, initialCustomMap]);

  const hasChanges = changedStandardRoles.length > 0 || changedCustomRoles.length > 0;

  // Toggle permission for a standard role
  const togglePermission = (r: RoleId, p: Permission) => {
    if (!canEdit) {
      toast.error("Only administrators can update role permissions.");
      return;
    }

    setPermissionsMap((prev) => {
      const cur = prev[r] || [];
      const updated = cur.includes(p)
        ? cur.filter((x) => x !== p)
        : [...cur, p];
      return { ...prev, [r]: updated };
    });
  };

  // Toggle permission for a custom role
  const toggleCustomPermission = (roleId: string, p: Permission) => {
    if (!canEdit) {
      toast.error("Only administrators can update role permissions.");
      return;
    }

    setCustomPermissionsMap((prev) => {
      const cur = prev[roleId] || [];
      const updated = cur.includes(p)
        ? cur.filter((x) => x !== p)
        : [...cur, p];
      return { ...prev, [roleId]: updated };
    });
  };

  // Discard changes
  const handleDiscard = () => {
    setPermissionsMap(initialMap);
    setCustomPermissionsMap(initialCustomMap);
    toast.info("Unsaved changes discarded.");
  };

  // Reset standard roles to default restaurant knowledge
  const handleResetToDefaults = () => {
    setPermissionsMap({
      owner: [...ROLE_PERMISSIONS.owner],
      manager: [...ROLE_PERMISSIONS.manager],
      cashier: [...ROLE_PERMISSIONS.cashier],
      kitchen: [...ROLE_PERMISSIONS.kitchen],
      waiter: [...ROLE_PERMISSIONS.waiter],
    });
    toast.info("Standard roles reset to defaults. Click 'Save changes' to apply.");
  };

  // Save changes via backend API & local storage
  const handleSaveAll = async () => {
    if (!hasChanges || isSaving || !canEdit) return;
    setIsSaving(true);
    try {
      // 1. Update standard roles in backend database
      for (const r of changedStandardRoles) {
        await updateRolePermissionsApi(tenant.slug, r, permissionsMap[r]);
      }
      // 2. Update custom roles
      for (const cr of changedCustomRoles) {
        updateCustomRolePermissions(tenant.slug, cr.id, customPermissionsMap[cr.id] || []);
      }

      setInitialMap(permissionsMap);
      setInitialCustomMap(customPermissionsMap);
      toast.success("Role permissions updated successfully in database!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  // Create custom role
  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoleForm.name.trim();
    if (!name) {
      toast.error("Please enter a role name.");
      return;
    }

    // Check duplicate
    const exists = customRoles.some((r) => r.name.toLowerCase() === name.toLowerCase());
    if (exists || CONFIGURABLE_STAFF_ROLES.some((r) => ROLE_LABELS[r].toLowerCase() === name.toLowerCase())) {
      toast.error(`A role named "${name}" already exists.`);
      return;
    }

    const templateBase: RoleId = newRoleForm.baseRole === "empty" ? "waiter" : newRoleForm.baseRole;
    const initialPerms: Permission[] =
      newRoleForm.baseRole === "empty"
        ? []
        : [...(permissionsMap[templateBase] || ROLE_PERMISSIONS[templateBase] || [])];

    const created = saveCustomRole(tenant.slug, {
      name,
      description: newRoleForm.description.trim(),
      color: newRoleForm.color,
      baseRole: templateBase,
      permissions: initialPerms,
    });

    const updatedRoles = [...customRoles, created];
    setCustomRoles(updatedRoles);
    setCustomPermissionsMap((prev) => ({ ...prev, [created.id]: initialPerms }));
    setInitialCustomMap((prev) => ({ ...prev, [created.id]: initialPerms }));

    setIsCreatingRole(false);
    setNewRoleForm({ name: "", description: "", baseRole: "cashier", color: "purple" });
    toast.success(`Custom role "${created.name}" created! You can now customize its permissions.`);
  };

  // Delete custom role
  const handleDeleteRole = (role: CustomRole) => {
    deleteCustomRole(tenant.slug, role.id);
    setCustomRoles((prev) => prev.filter((r) => r.id !== role.id));
    setCustomPermissionsMap((prev) => {
      const next = { ...prev };
      delete next[role.id];
      return next;
    });
    setInitialCustomMap((prev) => {
      const next = { ...prev };
      delete next[role.id];
      return next;
    });
    if (selectedRole === role.id) setSelectedRole("all");
    toast.success(`Custom role "${role.name}" removed.`);
  };

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PERMISSION_GROUPS.map((g) => {
      const perms = g.perms.filter((p) => {
        const label = PERMISSION_LABELS[p]?.toLowerCase() ?? "";
        const matchesQuery = !q || label.includes(q) || p.toLowerCase().includes(q);

        let matchesRole = true;
        if (selectedRole !== "all") {
          if (CONFIGURABLE_STAFF_ROLES.includes(selectedRole as RoleId)) {
            matchesRole = (permissionsMap[selectedRole as RoleId] || []).includes(p);
          } else {
            matchesRole = (customPermissionsMap[selectedRole] || []).includes(p);
          }
        }
        return matchesQuery && matchesRole;
      });
      return { ...g, perms };
    }).filter((g) => g.perms.length > 0);
  }, [search, selectedRole, permissionsMap, customPermissionsMap]);

  const selectedRoleLabel = useMemo(() => {
    if (selectedRole === "all") return "";
    if (CONFIGURABLE_STAFF_ROLES.includes(selectedRole as RoleId)) {
      return ROLE_LABELS[selectedRole as RoleId];
    }
    const found = customRoles.find((cr) => cr.id === selectedRole);
    return found ? found.name : selectedRole;
  }, [selectedRole, customRoles]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        description="Configure role-based access control and system permissions matrix for your restaurant team."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 shadow-2xs">
              <Link to="/app/$tenantSlug/team" params={{ tenantSlug: tenant.slug }}>
                <Users className="size-4 text-primary" /> Staff directory
              </Link>
            </Button>
            {canEdit && (
              <Button
                onClick={() => setIsCreatingRole(true)}
                size="sm"
                className="gap-1.5 font-medium shadow-xs"
              >
                <Plus className="size-4" /> Create role
              </Button>
            )}
            {hasChanges && (
              <Button
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={handleDiscard}
                className="gap-1.5"
              >
                <Undo2 className="size-3.5" /> Discard
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={handleResetToDefaults}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" /> Reset to defaults
            </Button>
            <Button
              size="sm"
              disabled={isSaving || !canEdit || !hasChanges}
              onClick={handleSaveAll}
              className="gap-1.5 font-medium shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Updating...
                </>
              ) : (
                <>
                  <Save className="size-4" /> Save changes
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Superadmin Owner Notice Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground shadow-2xs">
        <ShieldCheck className="size-4.5 shrink-0 text-primary" />
        <span>
          <strong className="font-semibold text-foreground">Superadmin Access:</strong> The restaurant{" "}
          <strong>Owner</strong> account automatically possesses permanent unrestricted superadmin privileges across
          all POS modules, finances, branches, and configurations. Configure permissions below for each team staff role.
        </span>
      </div>

      {/* Unsaved Changes Banner */}
      {hasChanges && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200 text-sm shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              You have unsaved changes (
              {[
                ...changedStandardRoles.map((r) => ROLE_LABELS[r]),
                ...changedCustomRoles.map((cr) => cr.name),
              ].join(", ")}
              ). Click <strong>Save changes</strong> to update the database.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" className="h-7 px-3 text-xs" disabled={isSaving} onClick={handleSaveAll}>
              {isSaving && <Loader2 className="size-3 animate-spin mr-1" />}
              Save changes
            </Button>
          </div>
        </div>
      )}

      {/* Role Summary Cards (Standard Roles + Custom Roles) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Standard Configurable Roles */}
        {roles.map((r) => {
          const isSelected = selectedRole === r;
          const allowedCount = (permissionsMap[r] || []).length;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRole(isSelected ? "all" : r)}
              className={cn(
                "flex flex-col justify-between rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:shadow-xs",
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                  : "bg-card hover:bg-accent/40"
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-semibold text-sm">{ROLE_LABELS[r]}</span>
                  <Badge variant="outline" className={cn("text-xs px-2 py-0.5 font-medium", ROLE_DETAILS[r]?.color)}>
                    {allowedCount} perms
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {ROLE_DETAILS[r]?.description}
                </p>
              </div>
              <div className="mt-3.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="size-3.5 text-primary" />
                  {isSelected ? "Filter active" : "Filter role"}
                </span>
                {isSelected && (
                  <span className="text-[10px] text-primary underline">Clear filter</span>
                )}
              </div>
            </button>
          );
        })}

        {/* Custom Roles Cards */}
        {customRoles.map((cr) => {
          const isSelected = selectedRole === cr.id;
          const allowedCount = (customPermissionsMap[cr.id] || []).length;
          const colorPreset =
            ROLE_COLOR_PRESETS.find((p) => p.id === cr.color) ?? ROLE_COLOR_PRESETS[0]!;

          return (
            <div
              key={cr.id}
              className={cn(
                "relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:shadow-xs",
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                  : "bg-card hover:bg-accent/40"
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-purple-500" />
                    <span className="font-semibold text-sm">{cr.name}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-xs px-2 py-0.5 font-medium", colorPreset.badge)}>
                    {allowedCount} perms
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground mb-1">
                  <span>Base:</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                    {ROLE_LABELS[cr.baseRole]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {cr.description || `Custom operational role configured for ${cr.name}.`}
                </p>
              </div>
              <div className="mt-3.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground border-t pt-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedRole(isSelected ? "all" : cr.id)}
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Shield className="size-3.5" />
                  {isSelected ? "Clear filter" : "Filter role"}
                </button>
                {canEdit && (
                  <Confirm
                    title={`Delete "${cr.name}" role?`}
                    body={`Are you sure you want to remove the custom role "${cr.name}"? Staff members assigned to this role will default to their base template (${ROLE_LABELS[cr.baseRole]}).`}
                    confirmLabel="Delete role"
                    onConfirm={() => handleDeleteRole(cr)}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md"
                      title={`Delete ${cr.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </Confirm>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls Bar: Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search capabilities (e.g. pos, orders, refund, cash, menu)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedRole !== "all" && (
            <Badge variant="secondary" className="gap-1.5 pl-2">
              Viewing: <span className="font-semibold">{selectedRoleLabel}</span>
              <button
                type="button"
                onClick={() => setSelectedRole("all")}
                className="ml-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {filteredGroups.reduce((acc, g) => acc + g.perms.length, 0)} capabilities listed
          </span>
        </div>
      </div>

      {/* Permissions Matrix by Group */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Shield className="mx-auto size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">No matching permissions found</p>
            <p className="text-xs text-muted-foreground">Try clearing the search or role filter.</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.name} className="overflow-hidden rounded-xl border bg-card shadow-xs">
              <div className="border-b bg-muted/40 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.name}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {group.perms.length} capabilities
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/10 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium min-w-[200px]">Capability</th>

                      {/* Standard Roles Columns */}
                      {roles.map((r) => (
                        <th
                          key={r}
                          className={cn(
                            "px-3 py-2 text-center font-medium min-w-[100px]",
                            selectedRole === r && "bg-primary/5 text-primary font-semibold"
                          )}
                        >
                          <div>{ROLE_LABELS[r]}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {(permissionsMap[r] || []).length} perms
                          </div>
                        </th>
                      ))}

                      {/* Custom Roles Columns */}
                      {customRoles.map((cr) => (
                        <th
                          key={cr.id}
                          className={cn(
                            "px-3 py-2 text-center font-medium min-w-[120px] bg-purple-500/5",
                            selectedRole === cr.id && "bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold"
                          )}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <Sparkles className="size-3 text-purple-500" />
                            <span>{cr.name}</span>
                          </div>
                          <div className="text-[10px] font-normal text-muted-foreground">
                            Base: {ROLE_LABELS[cr.baseRole]} • {(customPermissionsMap[cr.id] || []).length} perms
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {group.perms.map((p) => (
                      <tr key={p} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          <div>{PERMISSION_LABELS[p] || p}</div>
                          <span className="text-[11px] font-mono text-muted-foreground/70">{p}</span>
                        </td>

                        {/* Standard Roles Checkboxes */}
                        {roles.map((r) => {
                          const allowed = (permissionsMap[r] || []).includes(p);
                          const isHighlighted = selectedRole === r;

                          return (
                            <td
                              key={r}
                              className={cn(
                                "px-3 py-2 text-center align-middle",
                                isHighlighted && "bg-primary/5"
                              )}
                            >
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  disabled={!canEdit || isSaving}
                                  onClick={() => togglePermission(r, p)}
                                  className={cn(
                                    "group relative inline-flex items-center justify-center size-6 rounded-md transition-all duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                                    allowed
                                      ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:scale-90"
                                      : "border-2 border-border/80 bg-background hover:border-emerald-500 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/20 active:scale-90",
                                    (!canEdit || isSaving) && "cursor-not-allowed opacity-60"
                                  )}
                                  title={`${allowed ? "Click to Revoke" : "Click to Grant"} "${PERMISSION_LABELS[p] || p}" for ${ROLE_LABELS[r]}`}
                                  aria-label={`${ROLE_LABELS[r]}: ${PERMISSION_LABELS[p] || p} (${allowed ? "Granted" : "Denied"})`}
                                >
                                  {allowed ? (
                                    <Check className="size-4 stroke-[3] text-white transition-transform group-hover:scale-110" />
                                  ) : (
                                    <span className="size-2 rounded-xs opacity-0 transition-opacity group-hover:opacity-40 group-hover:bg-emerald-600" />
                                  )}
                                </button>
                              </div>
                            </td>
                          );
                        })}

                        {/* Custom Roles Checkboxes */}
                        {customRoles.map((cr) => {
                          const allowed = (customPermissionsMap[cr.id] || []).includes(p);
                          const isHighlighted = selectedRole === cr.id;

                          return (
                            <td
                              key={cr.id}
                              className={cn(
                                "px-3 py-2 text-center align-middle bg-purple-500/5",
                                isHighlighted && "bg-purple-500/15"
                              )}
                            >
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  disabled={!canEdit || isSaving}
                                  onClick={() => toggleCustomPermission(cr.id, p)}
                                  className={cn(
                                    "group relative inline-flex items-center justify-center size-6 rounded-md transition-all duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                                    allowed
                                      ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:scale-90"
                                      : "border-2 border-border/80 bg-background hover:border-emerald-500 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/20 active:scale-90",
                                    (!canEdit || isSaving) && "cursor-not-allowed opacity-60"
                                  )}
                                  title={`${allowed ? "Click to Revoke" : "Click to Grant"} "${PERMISSION_LABELS[p] || p}" for ${cr.name}`}
                                  aria-label={`${cr.name}: ${PERMISSION_LABELS[p] || p} (${allowed ? "Granted" : "Denied"})`}
                                >
                                  {allowed ? (
                                    <Check className="size-4 stroke-[3] text-white transition-transform group-hover:scale-110" />
                                  ) : (
                                    <span className="size-2 rounded-xs opacity-0 transition-opacity group-hover:opacity-40 group-hover:bg-emerald-600" />
                                  )}
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Custom Role Dialog */}
      <Dialog open={isCreatingRole} onOpenChange={setIsCreatingRole}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Create custom role
            </DialogTitle>
            <DialogDescription>
              Create a custom role (e.g. Bartender, Shift Supervisor, Head Chef, Hostess) with tailored system permissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRoleSubmit} className="space-y-4 pt-2">
            {/* Role Name */}
            <div className="space-y-1.5">
              <Label htmlFor="role-name">
                Role Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-name"
                placeholder="e.g. Bartender, Shift Supervisor, Head Barista"
                value={newRoleForm.name}
                onChange={(e) => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
                maxLength={40}
                required
                autoFocus
              />
            </div>

            {/* Base Role Template */}
            <div className="space-y-1.5">
              <Label htmlFor="base-role">Base Role Template</Label>
              <Select
                value={newRoleForm.baseRole}
                onValueChange={(val) => setNewRoleForm({ ...newRoleForm, baseRole: val as RoleId | "empty" })}
              >
                <SelectTrigger id="base-role">
                  <SelectValue placeholder="Select base template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Cashier (Pre-loads checkout & payments)</SelectItem>
                  <SelectItem value="waiter">Waiter (Pre-loads tables & orders)</SelectItem>
                  <SelectItem value="kitchen">Kitchen (Pre-loads display station)</SelectItem>
                  <SelectItem value="manager">Manager (Pre-loads operations & inventory)</SelectItem>
                  <SelectItem value="empty">Empty (Start with 0 permissions)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Pre-populates starting permissions. You can fine-tune every single permission afterwards in the matrix.
              </p>
            </div>

            {/* Color Theme */}
            <div className="space-y-1.5">
              <Label>Color Badge</Label>
              <div className="flex items-center gap-2">
                {ROLE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setNewRoleForm({ ...newRoleForm, color: preset.id })}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                      preset.badge,
                      newRoleForm.color === preset.id
                        ? "ring-2 ring-primary ring-offset-1 font-semibold"
                        : "opacity-70 hover:opacity-100"
                    )}
                  >
                    <span className={cn("size-2 rounded-full", preset.dot)} />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description (optional)</Label>
              <Textarea
                id="role-desc"
                placeholder="Briefly describe what responsibilities this role handles..."
                value={newRoleForm.description}
                onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                rows={2}
                maxLength={160}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreatingRole(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Create role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
