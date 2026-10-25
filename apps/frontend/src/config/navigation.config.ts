import {
  BookOpen,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  Package,
  PackageCheck,
  ShoppingCart,
  Truck,
  Undo2,
  UtensilsCrossed,
  FileText,
  Users,
  CalendarClock,
  Bike,
  Wallet,
  UserCog,
  Store,
  TicketPercent,
  Clock,
  BarChart3,
  Bell,
  History,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "./permissions.config";

export type AppPath =
  | "dashboard"
  | "reports"
  | "pos"
  | "orders"
  | "tables"
  | "kitchen"
  | "menu"
  | "recipes"
  | "inventory"
  | "suppliers"
  | "purchasing/orders"
  | "purchasing/receiving"
  | "purchasing/returns"
  | "customers"
  | "reservations"
  | "delivery"
  | "finance"
  | "team"
  | "team/roles"
  | "branches"
  | "promotions"
  | "notifications"
  | "audit-logs"
  | "settings";

export interface NavItem {
  path: AppPath;
  label: string;
  icon: LucideIcon;
  permission: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { path: "dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
      { path: "reports", label: "Reports", icon: BarChart3, permission: "reports.view" },
    ],
  },
  {
    label: "Service",
    items: [
      { path: "pos", label: "POS terminal", icon: ShoppingCart, permission: "pos.use" },
      { path: "orders", label: "Orders", icon: ClipboardList, permission: "orders.view" },
      { path: "tables", label: "Tables", icon: LayoutGrid, permission: "tables.view" },
      { path: "kitchen", label: "Kitchen display", icon: ChefHat, permission: "kitchen.view" },
      { path: "reservations", label: "Reservations", icon: CalendarClock, permission: "reservations.manage" },
      { path: "delivery", label: "Delivery", icon: Bike, permission: "delivery.manage" },
    ],
  },
  {
    label: "Guests & money",
    items: [
      { path: "customers", label: "Customers & loyalty", icon: Users, permission: "customers.manage" },
      { path: "promotions", label: "Promotions", icon: TicketPercent, permission: "promotions.manage" },
      { path: "finance", label: "Payments & cash", icon: Wallet, permission: "payments.view" },
    ],
  },
  {
    label: "Team",
    items: [
      { path: "team", label: "Staff", icon: Users, permission: "shifts.manage" },
      { path: "team/roles", label: "Roles & permissions", icon: ShieldCheck, permission: "roles.view" },
      { path: "branches", label: "Branches", icon: Store, permission: "branches.manage" },
    ],
  },
  {
    label: "Menu & stock",
    items: [
      { path: "menu", label: "Menu", icon: UtensilsCrossed, permission: "menu.manage" },
      { path: "recipes", label: "Recipes & cost", icon: BookOpen, permission: "recipes.view" },
      { path: "inventory", label: "Inventory", icon: Package, permission: "inventory.view" },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { path: "suppliers", label: "Suppliers", icon: Truck, permission: "purchasing.manage" },
      { path: "purchasing/orders", label: "Purchase orders", icon: FileText, permission: "purchasing.manage" },
      { path: "purchasing/receiving", label: "Receiving", icon: PackageCheck, permission: "purchasing.manage" },
      { path: "purchasing/returns", label: "Supplier returns", icon: Undo2, permission: "purchasing.manage" },
    ],
  },
  {
    label: "Management",
    items: [
      { path: "notifications", label: "Notifications", icon: Bell, permission: "notifications.view" },
      { path: "audit-logs", label: "Audit logs", icon: History, permission: "audit.view" },
      { path: "settings", label: "Settings", icon: Settings, permission: "settings.manage" },
    ],
  },
];
