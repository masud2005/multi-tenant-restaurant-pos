import { UserRole } from '../../../prisma/generated/client';

export enum Permission {
  // Dashboard
  DASHBOARD_VIEW = 'dashboard.view',

  // POS & Orders
  POS_USE = 'pos.use',
  ORDERS_VIEW = 'orders.view',
  ORDERS_MANAGE = 'orders.manage',
  ORDERS_VOID = 'orders.void',

  // Payments, Discounts & Cash
  DISCOUNTS_APPLY = 'discounts.apply',
  PAYMENTS_PROCESS = 'payments.process',
  PAYMENTS_VIEW = 'payments.view',
  REFUNDS_PROCESS = 'refunds.process',
  CASH_MANAGE = 'cash.manage',

  // Kitchen & Tables
  KITCHEN_VIEW = 'kitchen.view',
  TABLES_VIEW = 'tables.view',
  TABLES_MANAGE = 'tables.manage',

  // Inventory & Menu
  INVENTORY_VIEW = 'inventory.view',
  INVENTORY_MANAGE = 'inventory.manage',
  MENU_MANAGE = 'menu.manage',
  RECIPES_VIEW = 'recipes.view',
  PURCHASING_MANAGE = 'purchasing.manage',

  // Operations & Staff
  CUSTOMERS_MANAGE = 'customers.manage',
  RESERVATIONS_MANAGE = 'reservations.manage',
  DELIVERY_MANAGE = 'delivery.manage',
  EXPENSES_MANAGE = 'expenses.manage',
  STAFF_MANAGE = 'staff.manage',
  ROLES_VIEW = 'roles.view',
  SHIFTS_MANAGE = 'shifts.manage',
  ATTENDANCE_SELF = 'attendance.self',
  BRANCHES_MANAGE = 'branches.manage',
  PROMOTIONS_MANAGE = 'promotions.manage',
  SETTINGS_MANAGE = 'settings.manage',
  REPORTS_VIEW = 'reports.view',
  AUDIT_VIEW = 'audit.view',
  NOTIFICATIONS_VIEW = 'notifications.view',
}


export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: ALL_PERMISSIONS,

  [UserRole.MANAGER]: ALL_PERMISSIONS.filter(
    (p) => p !== Permission.BRANCHES_MANAGE && p !== Permission.STAFF_MANAGE,
  ),

  [UserRole.CASHIER]: [
    Permission.POS_USE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_MANAGE,
    Permission.DISCOUNTS_APPLY,
    Permission.PAYMENTS_PROCESS,
    Permission.PAYMENTS_VIEW,
    Permission.CASH_MANAGE,
    Permission.TABLES_VIEW,
    Permission.KITCHEN_VIEW,
    Permission.CUSTOMERS_MANAGE,
    Permission.DELIVERY_MANAGE,
    Permission.ATTENDANCE_SELF,
  ],

  [UserRole.KITCHEN]: [
    Permission.KITCHEN_VIEW,
    Permission.ORDERS_VIEW,
    Permission.ATTENDANCE_SELF,
  ],

  [UserRole.WAITER]: [
    Permission.POS_USE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_MANAGE,
    Permission.TABLES_VIEW,
    Permission.TABLES_MANAGE,
    Permission.RESERVATIONS_MANAGE,
    Permission.ATTENDANCE_SELF,
  ],
};
