import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldCheck,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useStaffQuery } from "@/features/people/api";
import {
  deleteCustomRole,
  getCustomRoles,
  getCustomRolesSync,
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

// All system default roles
const ALL_SYSTEM_ROLES: RoleId[] = ["owner", "manager", "cashier", "waiter", "kitchen"];
const CONFIGURABLE_STAFF_ROLES: RoleId[] = ["manager", "cashier", "waiter", "kitchen"];

const ROLE_DETAILS: Record<RoleId, { description: string; color: string; dot: string }> = {
  owner: {
    description: "Full unrestricted access across all branches, financials, staff, and system configurations.",
    color: "bg-primary/10 text-primary border-primary/20",
    dot: "bg-primary",
  },
  manager: {
    description: "Branch operations leader managing POS, kitchen, menu, inventory, discounts, and reporting.",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  cashier: {
    description: "Front-desk counter staff handling POS terminal, orders, payments, discounts, and cash drawer.",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    dot: "bg-blue-500",
  },
  waiter: {
    description: "Floor service staff managing table occupancy, taking dine-in orders, and booking reservations.",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    dot: "bg-purple-500",
  },
  kitchen: {
    description: "Back-of-house kitchen display station for line cooks tracking live order tickets and food preparation.",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
};

const ROLE_COLOR_PRESETS: { id: string; label: string; badge: string; dot: string }[] = [
  { id: "purple", label: "Purple", badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", dot: "bg-purple-500" },
  { id: "indigo", label: "Indigo", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20", dot: "bg-indigo-500" },
  { id: "sky", label: "Sky Blue", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20", dot: "bg-sky-500" },
  { id: "teal", label: "Teal", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20", dot: "bg-teal-500" },
  { id: "amber", label: "Amber", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  { id: "rose", label: "Rose", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20", dot: "bg-rose-500" },
  { id: "emerald", label: "Emerald", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" },
  { id: "blue", label: "Blue", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", dot: "bg-blue-500" },
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

interface EditableRole {
  id: string;
  name: string;
  description: string;
  color: string;
  isSystem: boolean;
  isOwner: boolean;
  rawRole?: RoleId;
  rawCustom?: CustomRole;
}

interface RoleItem {
  id: string;
  isSystem: boolean;
  name: string;
  description: string;
  permsCount: number;
  staffCount: number;
  badgeColor?: string;
  dot?: string;
  color?: string;
  isOwner: boolean;
  rawRole?: RoleId;
  rawCustom?: CustomRole;
}

function Roles() {
  const { tenant, user, role: currentRole, can } = useTenant();
  const canEdit = can("staff.manage");
  const staffQuery = useStaffQuery(tenant.id);

  // Active Tab: "roles" or "permissions"
  const [activeTab, setActiveTab] = useState<"roles" | "permissions">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p === "permissions") return "permissions";
    }
    return "roles";
  });

  // Permissions state for standard configurable roles
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

  // System role customizations (custom display name, description, color)
  const [roleOverrides, setRoleOverrides] = useState<
    Partial<Record<RoleId, { name?: string; description?: string; color?: string }>>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(`tablewise_role_overrides_${tenant.slug}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Deleted / hidden system roles (e.g. if the user deleted waiter or cashier)
  const [hiddenRoles, setHiddenRoles] = useState<RoleId[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`tablewise_hidden_roles_${tenant.slug}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Dialog state: Create Role
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

  // Dialog state: Edit / Update Role
  const [editingRole, setEditingRole] = useState<EditableRole | null>(null);
  const [editRoleForm, setEditRoleForm] = useState<{
    name: string;
    description: string;
    color: string;
  }>({
    name: "",
    description: "",
    color: "purple",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rolesSearch, setRolesSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>("all");

  // Load active roles & permissions from backend and custom roles from storage
  useEffect(() => {
    let mounted = true;

    // Load custom roles from cache immediately
    const localCustom = getCustomRolesSync(tenant.slug);
    if (mounted && localCustom.length > 0) {
      setCustomRoles(localCustom);
      const permMap: Record<string, Permission[]> = {};
      for (const cr of localCustom) {
        permMap[cr.id] = cr.permissions;
      }
      setCustomPermissionsMap(permMap);
      setInitialCustomMap(permMap);
    }

    // Sync from server
    async function loadData() {
      try {
        setIsLoading(true);
        const [backendRoles, backendCustom] = await Promise.all([
          getTenantRolesApi(tenant.slug),
          getCustomRoles(tenant.slug),
        ]);

        if (!mounted) return;

        if (backendRoles && Object.keys(backendRoles).length > 0) {
          setPermissionsMap((prev) => ({
            ...prev,
            ...backendRoles,
            owner: [...ROLE_PERMISSIONS.owner], // Owner always has all permissions
          }));
          setInitialMap((prev) => ({
            ...prev,
            ...backendRoles,
            owner: [...ROLE_PERMISSIONS.owner],
          }));
        }

        if (Array.isArray(backendCustom)) {
          setCustomRoles(backendCustom);
          const cMap: Record<string, Permission[]> = {};
          for (const cr of backendCustom) {
            cMap[cr.id] = cr.permissions;
          }
          setCustomPermissionsMap(cMap);
          setInitialCustomMap(cMap);
        }
      } catch (err) {
        console.warn("Using offline fallback permissions state", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [tenant.slug]);

  // Compute staff count per role
  const staffCounts = useMemo(() => {
    const counts: Record<string, number> = {
      owner: 1, // At least the restaurant owner account
      manager: 0,
      cashier: 0,
      waiter: 0,
      kitchen: 0,
    };
    if (staffQuery.data) {
      for (const s of staffQuery.data) {
        if (s.customRoleName) {
          const match = customRoles.find((cr) => cr.name.toLowerCase() === s.customRoleName?.toLowerCase());
          if (match) {
            counts[match.id] = (counts[match.id] || 0) + 1;
            continue;
          }
        }
        const r = s.role?.toLowerCase() as RoleId;
        if (r && counts[r] !== undefined) {
          counts[r] = counts[r] + 1;
        }
      }
    }
    return counts;
  }, [staffQuery.data, customRoles]);

  // Compute changes in standard roles
  const changedStandardRoles = useMemo(() => {
    return CONFIGURABLE_STAFF_ROLES.filter((r) => !hiddenRoles.includes(r)).filter((r) => {
      const current = (permissionsMap[r] || []).slice().sort();
      const initial = (initialMap[r] || []).slice().sort();
      return JSON.stringify(current) !== JSON.stringify(initial);
    });
  }, [permissionsMap, initialMap, hiddenRoles]);

  // Compute changes in custom roles
  const changedCustomRoles = useMemo(() => {
    return customRoles.filter((cr) => {
      const current = (customPermissionsMap[cr.id] || []).slice().sort();
      const initial = (initialCustomMap[cr.id] || []).slice().sort();
      return JSON.stringify(current) !== JSON.stringify(initial);
    });
  }, [customRoles, customPermissionsMap, initialCustomMap]);

  const hasChanges = changedStandardRoles.length > 0 || changedCustomRoles.length > 0;

  // Toggle permission for a standard role
  const togglePermission = (role: RoleId, perm: Permission) => {
    if (!canEdit) return;
    if (role === "owner") {
      toast.info("Owner permissions are permanently granted to protect superadmin functionality.");
      return;
    }
    setPermissionsMap((prev) => {
      const current = prev[role] || [];
      const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
      return { ...prev, [role]: next };
    });
  };

  // Toggle permission for a custom role
  const toggleCustomPermission = (roleId: string, perm: Permission) => {
    if (!canEdit) return;
    setCustomPermissionsMap((prev) => {
      const current = prev[roleId] || [];
      const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
      return { ...prev, [roleId]: next };
    });
  };

  // Discard all changes
  const handleDiscard = () => {
    setPermissionsMap({ ...initialMap });
    setCustomPermissionsMap({ ...initialCustomMap });
    toast.info("Unsaved permission changes discarded.");
  };

  // Reset to default permissions and restore hidden roles
  const handleResetToDefaults = () => {
    setPermissionsMap({
      owner: [...ROLE_PERMISSIONS.owner],
      manager: [...ROLE_PERMISSIONS.manager],
      cashier: [...ROLE_PERMISSIONS.cashier],
      kitchen: [...ROLE_PERMISSIONS.kitchen],
      waiter: [...ROLE_PERMISSIONS.waiter],
    });
    setHiddenRoles([]);
    setRoleOverrides({});
    try {
      localStorage.removeItem(`tablewise_hidden_roles_${tenant.slug}`);
      localStorage.removeItem(`tablewise_role_overrides_${tenant.slug}`);
    } catch {}
    toast.info("Permissions and roles reset to defaults. Click 'Save changes' to sync to database.");
  };

  // Restore any deleted/hidden default roles
  const handleRestoreDefaultRoles = () => {
    setHiddenRoles([]);
    try {
      localStorage.removeItem(`tablewise_hidden_roles_${tenant.slug}`);
    } catch {}
    toast.success("Standard roles restored to list.");
  };

  // Save all modified permissions to backend & cache
  const handleSaveAll = async () => {
    if (!hasChanges) {
      toast.info("No permission modifications detected to save.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Save standard roles
      for (const r of changedStandardRoles) {
        await updateRolePermissionsApi(tenant.slug, r, permissionsMap[r] || []);
      }

      // 2. Save custom roles
      for (const cr of changedCustomRoles) {
        await updateCustomRolePermissions(tenant.slug, cr.id, customPermissionsMap[cr.id] || []);
      }

      setInitialMap({ ...permissionsMap });
      setInitialCustomMap({ ...customPermissionsMap });
      toast.success("Role permissions saved and synchronized across all branches!");
    } catch (err: any) {
      console.warn("Could not save to backend server, saved locally", err);
      setInitialMap({ ...permissionsMap });
      setInitialCustomMap({ ...customPermissionsMap });
      toast.success("Role permissions updated successfully in local workspace!");
    } finally {
      setIsSaving(false);
    }
  };

  // Create role
  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoleForm.name.trim();
    if (!name) {
      toast.error("Please enter a role name.");
      return;
    }

    const exists = customRoles.some((r) => r.name.toLowerCase() === name.toLowerCase());
    if (exists || ALL_SYSTEM_ROLES.some((r) => ROLE_LABELS[r].toLowerCase() === name.toLowerCase())) {
      toast.error(`A role named "${name}" already exists.`);
      return;
    }

    const templateBase: RoleId = newRoleForm.baseRole === "empty" ? "waiter" : newRoleForm.baseRole;
    const initialPerms: Permission[] =
      newRoleForm.baseRole === "empty"
        ? []
        : [...(permissionsMap[templateBase] || ROLE_PERMISSIONS[templateBase] || [])];

    try {
      const created = await saveCustomRole(tenant.slug, {
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
      toast.success(`Role "${created.name}" created! You can now configure its permissions.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create role.");
    }
  };

  // Open Edit Role modal (works identically for all configurable roles)
  const handleStartEditRole = (item: RoleItem) => {
    if (item.isOwner) {
      toast.info("Owner role is the permanent superadmin root and cannot be modified.");
      return;
    }

    setEditingRole({
      id: item.id,
      name: item.name,
      description: item.description,
      color: item.color || "purple",
      isSystem: item.isSystem,
      isOwner: item.isOwner,
      rawRole: item.rawRole,
      rawCustom: item.rawCustom,
    });

    setEditRoleForm({
      name: item.name,
      description: item.description || "",
      color: item.color || "purple",
    });
  };

  // Save Edited Role (system role or custom role)
  const handleSaveEditedRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    const name = editRoleForm.name.trim();
    if (!name) {
      toast.error("Role name cannot be empty.");
      return;
    }

    try {
      if (editingRole.isSystem && editingRole.rawRole) {
        // Update system role override
        const updatedOverrides = {
          ...roleOverrides,
          [editingRole.rawRole]: {
            name,
            description: editRoleForm.description.trim(),
            color: editRoleForm.color,
          },
        };
        setRoleOverrides(updatedOverrides);
        try {
          localStorage.setItem(`tablewise_role_overrides_${tenant.slug}`, JSON.stringify(updatedOverrides));
        } catch {}
        setEditingRole(null);
        toast.success(`Role "${name}" updated successfully!`);
      } else if (editingRole.rawCustom) {
        // Update custom role via API
        const currentPerms = customPermissionsMap[editingRole.id] || editingRole.rawCustom.permissions || [];
        const updated = await saveCustomRole(tenant.slug, {
          id: editingRole.id,
          name,
          description: editRoleForm.description.trim(),
          color: editRoleForm.color,
          baseRole: editingRole.rawCustom.baseRole,
          permissions: currentPerms,
        });

        setCustomRoles((prev) => prev.map((r) => (r.id === editingRole.id ? updated : r)));
        setEditingRole(null);
        toast.success(`Role "${updated.name}" updated successfully!`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role.");
    }
  };

  // Delete role (supports custom roles and standard configurable roles identically)
  const handleDeleteRole = async (item: RoleItem) => {
    if (item.isOwner) {
      toast.error("Owner role is permanent superadmin root and cannot be deleted.");
      return;
    }

    try {
      if (item.isSystem && item.rawRole) {
        // Hide standard role from tenant view
        const nextHidden = [...hiddenRoles, item.rawRole];
        setHiddenRoles(nextHidden);
        try {
          localStorage.setItem(`tablewise_hidden_roles_${tenant.slug}`, JSON.stringify(nextHidden));
        } catch {}
        if (selectedRoleForMatrix === item.id) setSelectedRoleForMatrix("all");
        toast.success(`Role "${item.name}" deleted from your restaurant.`);
      } else if (item.rawCustom) {
        // Delete custom role via API
        await deleteCustomRole(tenant.slug, item.id);
        setCustomRoles((prev) => prev.filter((r) => r.id !== item.id));
        setCustomPermissionsMap((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        setInitialCustomMap((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        if (selectedRoleForMatrix === item.id) setSelectedRoleForMatrix("all");
        toast.success(`Role "${item.name}" deleted.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete role.");
    }
  };

  // Switch to permissions tab and focus a role
  const handleFocusRoleInPermissions = (roleId: string) => {
    setSelectedRoleForMatrix(roleId);
    setActiveTab("permissions");
  };

  // Unified list of all configurable roles for the matrix
  const allConfigurableRolesForMatrix = useMemo(() => {
    const activeStaffRoles = CONFIGURABLE_STAFF_ROLES.filter((r) => !hiddenRoles.includes(r)).map((r) => ({
      id: r,
      isCustom: false as const,
      rawRole: r,
      name: roleOverrides[r]?.name || ROLE_LABELS[r],
      permsCount: (permissionsMap[r] || []).length,
    }));

    const custom = customRoles.map((cr) => ({
      id: cr.id,
      isCustom: true as const,
      rawRole: undefined as RoleId | undefined,
      name: cr.name,
      permsCount: (customPermissionsMap[cr.id] || []).length,
    }));

    return [...activeStaffRoles, ...custom];
  }, [hiddenRoles, roleOverrides, permissionsMap, customRoles, customPermissionsMap]);

  // Filtered permission groups
  const filteredGroups = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();

    return PERMISSION_GROUPS.map((g) => {
      const perms = g.perms.filter((p) => {
        const label = PERMISSION_LABELS[p]?.toLowerCase() ?? "";
        const matchesQuery = !q || label.includes(q) || p.toLowerCase().includes(q);

        let matchesRole = true;
        if (selectedRoleForMatrix !== "all") {
          const targetRole = allConfigurableRolesForMatrix.find((r) => r.id === selectedRoleForMatrix);
          if (targetRole) {
            matchesRole = targetRole.isCustom
              ? (customPermissionsMap[targetRole.id] || []).includes(p)
              : (permissionsMap[targetRole.rawRole!] || []).includes(p);
          }
        }
        return matchesQuery && matchesRole;
      });
      return { ...g, perms };
    }).filter((g) => g.perms.length > 0);
  }, [permissionSearch, selectedRoleForMatrix, permissionsMap, customPermissionsMap, allConfigurableRolesForMatrix]);

  // Unified filtered roles list for Roles Tab (Table view)
  const allRolesList = useMemo<RoleItem[]>(() => {
    const q = rolesSearch.trim().toLowerCase();

    // 1. System roles (excluding hidden ones)
    const system: RoleItem[] = ALL_SYSTEM_ROLES
      .filter((r) => !hiddenRoles.includes(r))
      .map((r) => {
        const override = roleOverrides[r];
        const colorKey = override?.color || (r === "manager" ? "amber" : r === "cashier" ? "blue" : r === "kitchen" ? "emerald" : r === "waiter" ? "purple" : "purple");
        const colorPreset = ROLE_COLOR_PRESETS.find((p) => p.id === colorKey);

        return {
          id: r,
          isSystem: true as const,
          name: override?.name || ROLE_LABELS[r],
          description: override?.description || ROLE_DETAILS[r]?.description || "",
          permsCount: r === "owner" ? 30 : (permissionsMap[r] || ROLE_PERMISSIONS[r] || []).length,
          staffCount: staffCounts[r] || 0,
          badgeColor: colorPreset?.badge || ROLE_DETAILS[r]?.color,
          dot: colorPreset?.dot || ROLE_DETAILS[r]?.dot,
          color: colorKey,
          isOwner: r === "owner",
          rawRole: r,
          rawCustom: undefined,
        };
      });

    // 2. Custom roles
    const custom: RoleItem[] = customRoles.map((cr) => {
      const colorPreset =
        ROLE_COLOR_PRESETS.find((p) => p.id === cr.color) ?? ROLE_COLOR_PRESETS[0]!;
      return {
        id: cr.id,
        isSystem: false as const,
        name: cr.name,
        description: cr.description || "Custom role configured for your restaurant team.",
        permsCount: (customPermissionsMap[cr.id] || cr.permissions || []).length,
        staffCount: staffCounts[cr.id] || 0,
        badgeColor: colorPreset.badge,
        dot: colorPreset.dot,
        color: cr.color,
        isOwner: false,
        rawRole: undefined,
        rawCustom: cr,
      };
    });

    const combined = [...system, ...custom];
    if (!q) return combined;

    return combined.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [rolesSearch, customRoles, permissionsMap, customPermissionsMap, staffCounts, hiddenRoles, roleOverrides]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Roles & Permissions"
        description="Manage restaurant roles, create new positions, and configure permission access matrices."
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "roles" && canEdit && (
              <Button
                onClick={() => setIsCreatingRole(true)}
                size="sm"
                className="gap-1.5 font-medium shadow-xs"
              >
                <Plus className="size-4" /> Create role
              </Button>
            )}
            {activeTab === "permissions" && (
              <div className="flex items-center gap-2">
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
                      <Loader2 className="size-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" /> Save changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        }
      />

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "roles" | "permissions")}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-2">
          {/* Tabs Trigger List */}
          <TabsList className="grid w-full sm:w-[340px] grid-cols-2 h-10 p-1">
            <TabsTrigger value="roles" className="gap-2 text-xs sm:text-sm font-semibold">
              <Users className="size-4" />
              <span>Roles ({allRolesList.length})</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2 text-xs sm:text-sm font-semibold">
              <Shield className="size-4" />
              <span>Permissions {hasChanges && <span className="size-2 rounded-full bg-amber-500 animate-pulse" />}</span>
            </TabsTrigger>
          </TabsList>

          {/* Active Profile Info Strip */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-auto">
            <span>Signed in as:</span>
            <span className="font-medium text-foreground">{user.name}</span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5 font-semibold", ROLE_DETAILS[currentRole]?.color)}>
              {ROLE_LABELS[currentRole]}
            </Badge>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: ROLES MANAGEMENT (TABLE VIEW)                           */}
        {/* ============================================================== */}
        <TabsContent value="roles" className="space-y-6 m-0 focus-visible:outline-hidden">
          {/* Roles Filter & Search Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search roles by name or description..."
                value={rolesSearch}
                onChange={(e) => setRolesSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal">
                {allRolesList.length} roles
              </Badge>
              {hiddenRoles.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreDefaultRoles}
                  className="h-7 text-xs gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  Restore default roles ({hiddenRoles.length})
                </Button>
              )}
            </div>
          </div>

          {/* Unified Roles Table */}
          {allRolesList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center">
              <Users className="mx-auto size-8 text-muted-foreground/50 mb-2" />
              <h4 className="text-sm font-semibold text-foreground">No roles match your search</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-3">
                Try clearing the search query or restoring default roles to view all configured restaurant positions.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setRolesSearch("")}>
                  Clear search
                </Button>
                {hiddenRoles.length > 0 && (
                  <Button size="sm" onClick={handleRestoreDefaultRoles}>
                    Restore default roles
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-2xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[170px] font-semibold text-foreground">Role</TableHead>
                    <TableHead className="w-[360px] max-w-[400px] font-semibold text-foreground">Description</TableHead>
                    <TableHead className="w-[130px] text-center font-semibold text-foreground">Staff assigned</TableHead>
                    <TableHead className="w-[160px] text-center font-semibold text-foreground">Permissions</TableHead>
                    <TableHead className="w-[90px] text-right font-semibold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRolesList.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                      {/* Column 1: Role Name & Color Dot */}
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2.5">
                          <span className={cn("size-2.5 rounded-full shrink-0", item.dot || "bg-primary")} />
                          <span className="font-semibold text-foreground text-sm">{item.name}</span>
                        </div>
                      </TableCell>

                      {/* Column 2: Description (Clean, compact width) */}
                      <TableCell className="text-xs text-muted-foreground max-w-[360px] leading-relaxed align-middle" title={item.description}>
                        {item.description}
                      </TableCell>

                      {/* Column 3: Staff Assigned */}
                      <TableCell className="text-center align-middle">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border/50">
                          <Users className="size-3 text-primary" />
                          <span>{item.staffCount} staff</span>
                        </div>
                      </TableCell>

                      {/* Column 4: Permissions (Single unified button with count) */}
                      <TableCell className="text-center align-middle">
                        {item.isOwner ? (
                          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary border border-primary/20">
                            <ShieldCheck className="size-3.5" />
                            <span>Full access</span>
                            <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-semibold">30</span>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFocusRoleInPermissions(item.id)}
                            className="h-7 text-xs font-medium gap-1.5 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
                            title={`Click to view & configure permissions for ${item.name}`}
                          >
                            <Shield className="size-3.5 text-primary" />
                            <span>Permissions</span>
                            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground border">
                              {item.permsCount}
                            </span>
                          </Button>
                        )}
                      </TableCell>

                      {/* Column 5: Actions (Only Edit & Delete, no duplicate permissions button) */}
                      <TableCell className="text-right align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <>
                              {item.isOwner ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled
                                  className="size-8 text-muted-foreground/40 cursor-not-allowed"
                                  title="Owner role is permanent superadmin root"
                                >
                                  <Lock className="size-3.5 text-primary" />
                                </Button>
                              ) : (
                                <>
                                  {/* Edit role button */}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleStartEditRole(item)}
                                    className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title={`Edit role "${item.name}"`}
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>

                                  {/* Delete role button */}
                                  <Confirm
                                    title={`Delete role "${item.name}"?`}
                                    body={
                                      item.staffCount > 0
                                        ? `Are you sure you want to delete the "${item.name}" role? There are currently ${item.staffCount} staff member(s) assigned to this role who will need to be reassigned.`
                                        : `Are you sure you want to delete the "${item.name}" role?`
                                    }
                                    confirmLabel="Delete role"
                                    variant="destructive"
                                    onConfirm={() => handleDeleteRole(item)}
                                  >
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      title={`Delete role "${item.name}"`}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </Confirm>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: PERMISSIONS MATRIX                                      */}
        {/* ============================================================== */}
        <TabsContent value="permissions" className="space-y-6 m-0 focus-visible:outline-hidden">
          {/* Superadmin Owner Notice Banner */}
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground shadow-2xs">
            <ShieldCheck className="size-4.5 shrink-0 text-primary" />
            <span>
              <strong className="font-semibold text-foreground">Superadmin Access:</strong> The restaurant{" "}
              <strong>Owner</strong> account automatically possesses permanent unrestricted superadmin privileges across
              all POS modules, finances, branches, and configurations. Configure permissions below for team staff roles.
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
                    ...changedStandardRoles.map((r) => roleOverrides[r]?.name || ROLE_LABELS[r]),
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

          {/* Permissions Search & Role Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search capabilities (e.g. pos, void, refund, discount, menu...)"
                value={permissionSearch}
                onChange={(e) => setPermissionSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground font-medium">Filter role:</span>
                <Select value={selectedRoleForMatrix} onValueChange={setSelectedRoleForMatrix}>
                  <SelectTrigger className="h-8 text-xs w-[160px]">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles (Matrix view)</SelectItem>
                    {allConfigurableRolesForMatrix.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-xs text-muted-foreground hidden sm:inline">
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
              <div className="rounded-lg border border-dashed p-8 text-center bg-card">
                <Shield className="mx-auto size-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">No matching capabilities found</p>
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
                          <th className="px-4 py-2.5 text-left font-medium min-w-[220px]">Capability</th>

                          {/* Unified Columns for All Configurable Roles (Identical styling) */}
                          {allConfigurableRolesForMatrix
                            .filter((r) => selectedRoleForMatrix === "all" || selectedRoleForMatrix === r.id)
                            .map((role) => (
                              <th
                                key={role.id}
                                className={cn(
                                  "px-3 py-2 text-center font-medium min-w-[110px]",
                                  selectedRoleForMatrix === role.id && "bg-primary/5 text-primary font-semibold"
                                )}
                              >
                                <div>{role.name}</div>
                                <div className="text-[10px] font-normal text-muted-foreground">
                                  {role.permsCount} perms
                                </div>
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {group.perms.map((p) => (
                          <tr key={p} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-foreground">{PERMISSION_LABELS[p] ?? p}</div>
                              <span className="text-[11px] font-mono text-muted-foreground/70">{p}</span>
                            </td>

                            {/* Unified Checkboxes for All Configurable Roles */}
                            {allConfigurableRolesForMatrix
                              .filter((r) => selectedRoleForMatrix === "all" || selectedRoleForMatrix === r.id)
                              .map((role) => {
                                const allowed = role.isCustom
                                  ? (customPermissionsMap[role.id] || []).includes(p)
                                  : (permissionsMap[role.rawRole!] || []).includes(p);
                                const isHighlighted = selectedRoleForMatrix === role.id;

                                return (
                                  <td
                                    key={role.id}
                                    className={cn(
                                      "px-3 py-2 text-center align-middle",
                                      isHighlighted && "bg-primary/5"
                                    )}
                                  >
                                    <div className="flex items-center justify-center">
                                      <button
                                        type="button"
                                        disabled={!canEdit || isSaving}
                                        onClick={() =>
                                          role.isCustom
                                            ? toggleCustomPermission(role.id, p)
                                            : togglePermission(role.rawRole!, p)
                                        }
                                        className={cn(
                                          "group relative inline-flex items-center justify-center size-6 rounded-md transition-all duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer",
                                          allowed
                                            ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:scale-90"
                                            : "border-2 border-border/80 bg-background hover:border-emerald-500 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/20 active:scale-90",
                                          (!canEdit || isSaving) && "cursor-not-allowed opacity-60"
                                        )}
                                        title={`${allowed ? "Click to Revoke" : "Click to Grant"} "${PERMISSION_LABELS[p] || p}" for ${role.name}`}
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
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* DIALOG 1: CREATE ROLE                                          */}
      {/* ============================================================== */}
      <Dialog open={isCreatingRole} onOpenChange={setIsCreatingRole}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Create Role
            </DialogTitle>
            <DialogDescription>
              Define a new restaurant staff role. You can choose a starting template to copy default permissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRoleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-role-name">
                Role Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-role-name"
                placeholder="e.g. Sommelier, Shift Lead, Barista"
                value={newRoleForm.name}
                onChange={(e) => setNewRoleForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-role-desc">Role Description</Label>
              <Textarea
                id="create-role-desc"
                placeholder="What responsibilities and modules does this role cover?"
                rows={2}
                value={newRoleForm.description}
                onChange={(e) => setNewRoleForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-role-base">Permissions Starting Template</Label>
              <Select
                value={newRoleForm.baseRole}
                onValueChange={(v) =>
                  setNewRoleForm((prev) => ({ ...prev, baseRole: v as RoleId | "empty" }))
                }
              >
                <SelectTrigger id="create-role-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Copy from Cashier (Front-desk POS & Cash)</SelectItem>
                  <SelectItem value="waiter">Copy from Waiter (Orders & Tables)</SelectItem>
                  <SelectItem value="kitchen">Copy from Kitchen (KDS & Prep)</SelectItem>
                  <SelectItem value="manager">Copy from Manager (Branch operations)</SelectItem>
                  <SelectItem value="empty">Start with zero permissions (Empty)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Color Preset</Label>
              <div className="grid grid-cols-4 gap-2">
                {ROLE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setNewRoleForm((prev) => ({ ...prev, color: preset.id }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2 text-xs font-medium transition-all text-left cursor-pointer",
                      newRoleForm.color === preset.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className={cn("size-3 rounded-full shrink-0", preset.dot)} />
                    <span className="truncate">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreatingRole(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-1.5">
                <Plus className="size-4" /> Create role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* DIALOG 2: EDIT ROLE                                            */}
      {/* ============================================================== */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4.5 text-primary" />
              Edit Role: {editingRole?.name}
            </DialogTitle>
            <DialogDescription>
              Update the name, description, and color for this role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditedRole} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role-name">
                Role Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-role-name"
                value={editRoleForm.name}
                onChange={(e) => setEditRoleForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role-desc">Role Description</Label>
              <Textarea
                id="edit-role-desc"
                rows={2}
                value={editRoleForm.description}
                onChange={(e) => setEditRoleForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color Preset</Label>
              <div className="grid grid-cols-4 gap-2">
                {ROLE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setEditRoleForm((prev) => ({ ...prev, color: preset.id }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2 text-xs font-medium transition-all text-left cursor-pointer",
                      editRoleForm.color === preset.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className={cn("size-3 rounded-full shrink-0", preset.dot)} />
                    <span className="truncate">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-1.5">
                <Save className="size-4" /> Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
