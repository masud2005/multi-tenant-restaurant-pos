import type { RoleId } from "@/types/domain";

export type Permission =
  | "dashboard.view"
  | "pos.use"
  | "orders.view"
  | "orders.manage"
  | "orders.void"
  | "discounts.apply"
  | "payments.process"
  | "kitchen.view"
  | "tables.view"
  | "tables.manage"
  | "inventory.view"
  | "inventory.manage"
  | "menu.manage"
  | "recipes.view"
  | "purchasing.manage"
  | "customers.manage"
  | "reservations.manage"
  | "delivery.manage"
  | "payments.view"
  | "refunds.process"
  | "cash.manage"
  | "expenses.manage"
  | "staff.manage"
  | "roles.view"
  | "branches.manage"
  | "promotions.manage"
  | "reports.view"
  | "audit.view"
  | "settings.manage"
  | "notifications.view";

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard.view": "View dashboard",
  "pos.use": "Use POS terminal",
  "orders.view": "View orders",
  "orders.manage": "Create & update orders",
  "orders.void": "Void orders",
  "discounts.apply": "Apply discounts & promo codes",
  "payments.process": "Take payments",
  "kitchen.view": "Kitchen display",
  "tables.view": "View tables",
  "tables.manage": "Change table status",
  "inventory.view": "View inventory",
  "inventory.manage": "Adjust stock & counts",
  "menu.manage": "Manage menu",
  "recipes.view": "Recipes & food cost",
  "purchasing.manage": "Suppliers & purchasing",
  "customers.manage": "Customers & loyalty",
  "reservations.manage": "Reservations",
  "delivery.manage": "Delivery dispatch",
  "payments.view": "Payments ledger",
  "refunds.process": "Issue refunds",
  "cash.manage": "Cash drawer & shift close",
  "expenses.manage": "Record expenses",
  "staff.manage": "Manage staff",
  "roles.view": "View roles & permissions",
  "branches.manage": "Manage branches",
  "promotions.manage": "Manage promotions",
  "reports.view": "View reports & analytics",
  "audit.view": "View audit logs",
  "settings.manage": "Manage settings & integrations",
  "notifications.view": "View notifications",
};

export const ROLE_LABELS: Record<RoleId, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen",
  waiter: "Waiter",
};

const ALL: Permission[] = [
  "dashboard.view", "pos.use", "orders.view", "orders.manage", "orders.void", "discounts.apply",
  "payments.process", "kitchen.view", "tables.view", "tables.manage", "inventory.view",
  "inventory.manage", "menu.manage", "recipes.view", "purchasing.manage",
  "customers.manage", "reservations.manage", "delivery.manage", "payments.view", "refunds.process",
  "cash.manage", "expenses.manage", "staff.manage", "roles.view",
  "branches.manage", "promotions.manage", "reports.view", "audit.view", "settings.manage", "notifications.view",
];

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  owner: ALL,
  // Managers run a branch and can view reports, audit logs, notifications, and manage branch settings.
  manager: ALL.filter((p) => p !== "branches.manage" && p !== "staff.manage"),
  cashier: ["pos.use", "orders.view", "orders.manage", "discounts.apply", "payments.process", "tables.view", "kitchen.view", "customers.manage", "delivery.manage", "payments.view", "cash.manage", "notifications.view"],
  kitchen: ["kitchen.view", "orders.view", "notifications.view"],
  waiter: ["pos.use", "orders.view", "orders.manage", "tables.view", "tables.manage", "reservations.manage", "notifications.view"],
};

export const can = (role: RoleId | null | undefined, perm: Permission) =>
  !!role && ROLE_PERMISSIONS[role].includes(perm);
