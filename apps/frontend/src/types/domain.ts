// Domain types shared by mock services, RTK Query endpoints and UI.
// Shapes mirror the future REST API DTOs.

export type RoleId = "owner" | "manager" | "cashier" | "kitchen" | "waiter";

export type ActivationStatus = "active" | "grace" | "inactive";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  initials: string;
  /** oklch() colour string used as the tenant accent. */
  accent: string;
  currency: string;
  locale: string;
  taxRate: number;
  serviceChargeRate: number;
  receiptFooter: string;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  phone: string;
}

export interface Membership {
  tenantId: string;
  role: RoleId;
  branchIds: string[] | "all";
}

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  memberships: Membership[];
}

export interface Activation {
  tenantId: string;
  status: ActivationStatus;
  checkedAt: string;
  validUntil: string | null;
  message: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  sort: number;
}

export interface Variant {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  tenantId: string;
  name: string;
  min: number;
  max: number;
  options: ModifierOption[];
}

export interface RecipeLine {
  ingredientKey: string;
  qty: number;
}

export interface MenuItem {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  variants: Variant[];
  modifierGroupIds: string[];
  recipe: RecipeLine[];
  available: boolean;
  tags: string[];
}

export interface Ingredient {
  id: string;
  tenantId: string;
  branchId: string;
  key: string;
  name: string;
  unit: string;
  stock: number;
  reorderLevel: number;
  unitCost: number;
}

export type MovementReason = "sale" | "adjustment" | "purchase" | "waste" | "count" | "return";

export interface StockMovement {
  id: string;
  tenantId: string;
  branchId: string;
  ingredientId: string;
  ingredientName: string;
  qty: number;
  unit: string;
  reason: MovementReason;
  reference: string;
  createdAt: string;
}

export type TableStatus = "available" | "occupied" | "reserved" | "cleaning";

export interface DiningTable {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  seats: number;
  area: string;
  status: TableStatus;
  currentOrderId: string | null;
  x: number;
  y: number;
  shape: "round" | "square" | "long";
}

export type OrderType = "dine_in" | "takeaway" | "pickup" | "counter" | "delivery";

export type OrderStatus = "in_kitchen" | "ready" | "served" | "completed" | "cancelled";

export type KitchenStatus = "new" | "preparing" | "ready" | "bumped";

export type PaymentMethod = "cash" | "card" | "mobile";

export interface SelectedModifier {
  groupId: string;
  optionId: string;
  name: string;
  price: number;
}

export interface OrderLine {
  id: string;
  itemId: string;
  name: string;
  variantId: string | null;
  variantName: string | null;
  modifiers: SelectedModifier[];
  qty: number;
  /** Base price + variant delta, excluding modifiers. */
  unitPrice: number;
  notes: string;
}

export interface Discount {
  kind: "percent" | "amount";
  value: number;
  reason: string;
  promoCode?: string | undefined;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  tendered: number;
  change: number;
  reference: string;
  at: string;
}

export interface Totals {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  total: number;
}

export interface Order {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  type: OrderType;
  tableId: string | null;
  tableName: string | null;
  customerName: string;
  customerPhone: string;
  lines: OrderLine[];
  discount: Discount | null;
  notes: string;
  totals: Totals;
  status: OrderStatus;
  kitchenStatus: KitchenStatus;
  payments: Payment[];
  paid: number;
  refunds: Refund[];
  refunded: number;
  delivery: DeliveryInfo | null;
  inventoryDeducted: boolean;
  createdBy: string;
  createdAt: string;
  sentToKitchenAt: string;
  readyAt: string | null;
  completedAt: string | null;
}

export type NotificationType = "ORDER" | "INVENTORY" | "RESERVATION" | "CASH" | "STAFF" | "SYSTEM";

export interface Notification {
  id: string;
  tenantId: string;
  branchId?: string | null | undefined;
  type?: NotificationType | undefined;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
  updatedAt?: string | undefined;
}

// ---------- Stage 2: catalog, stock operations, purchasing ----------

export interface ComboComponent {
  itemId: string;
  qty: number;
}

export interface Combo {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: number;
  components: ComboComponent[];
  available: boolean;
}

export interface StockCountLine {
  ingredientId: string;
  name: string;
  unit: string;
  expected: number;
  counted: number;
  variance: number;
}

export interface StockCount {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  lines: StockCountLine[];
  notes: string;
  createdBy: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  supplies: string;
  paymentTerms: string;
  active: boolean;
}

export type PurchaseOrderStatus = "draft" | "sent" | "partial" | "received" | "cancelled";

export interface PurchaseOrderLine {
  ingredientId: string;
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  notes: string;
  expectedDate: string;
  total: number;
  createdBy: string;
  createdAt: string;
  sentAt: string | null;
}

export interface GoodsReceiptLine {
  ingredientId: string;
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
}

export interface GoodsReceipt {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  poId: string;
  poNumber: string;
  supplierName: string;
  lines: GoodsReceiptLine[];
  receivedBy: string;
  receivedAt: string;
}

export interface SupplierReturn {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  supplierId: string;
  supplierName: string;
  lines: GoodsReceiptLine[];
  reason: string;
  credit: number;
  createdBy: string;
  createdAt: string;
}

// ---------- Stage 3: people & money ----------

export interface Refund {
  id: string;
  amount: number;
  method: PaymentMethod;
  reason: string;
  by: string;
  at: string;
}

export type DeliveryStatus = "pending" | "assigned" | "out" | "delivered";

export interface DeliveryInfo {
  address: string;
  riderId: string | null;
  riderName: string | null;
  status: DeliveryStatus;
  dispatchedAt: string | null;
  deliveredAt: string | null;
}

export interface Rider {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  phone: string;
}

export type LoyaltyTier = "bronze" | "silver" | "gold";

export interface LoyaltyEntry {
  id: string;
  points: number;
  reason: string;
  reference: string;
  at: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  points: number;
  lifetimePoints: number;
  visits: number;
  totalSpent: number;
  lastVisitAt: string | null;
  ledger: LoyaltyEntry[];
  createdAt: string;
}

export interface LoyaltySettings {
  /** Amount of spend (tenant currency) that earns one point. */
  spendPerPoint: number;
  /** Currency value of one point when redeemed. */
  pointValue: number;
}

export type ReservationStatus = "booked" | "seated" | "completed" | "cancelled" | "no_show";

export interface Reservation {
  id: string;
  tenantId: string;
  branchId: string;
  customerName: string;
  phone: string;
  partySize: number;
  at: string;
  durationMin: number;
  tableId: string | null;
  tableName: string | null;
  status: ReservationStatus;
  notes: string;
  createdAt: string;
}

export interface CashEntry {
  id: string;
  kind: "in" | "out";
  amount: number;
  reason: string;
  by: string;
  at: string;
}

export interface CashSession {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  openedBy: string;
  openedAt: string;
  openingFloat: number;
  entries: CashEntry[];
  closedBy: string | null;
  closedAt: string | null;
  expectedCash: number | null;
  countedCash: number | null;
  variance: number | null;
  notes: string;
}

export type ExpenseCategory = "supplies" | "utilities" | "rent" | "maintenance" | "marketing" | "wages" | "other";

export interface Expense {
  id: string;
  tenantId: string;
  branchId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paidFrom: "cash_drawer" | "bank";
  date: string;
  createdBy: string;
  createdAt: string;
}

export type StaffStatus = "active" | "invited" | "draft" | "inactive";

export interface CustomRole {
  id: string;
  name: string;
  description?: string | undefined;
  color?: string | undefined;
  baseRole: RoleId;
  permissions: string[];
  isCustom: true;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  tenantId: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  role: RoleId;
  customRoleName?: string | undefined;
  branchIds: string[] | "all";
  hourlyRate: number;
  active: boolean;
  status?: StaffStatus | undefined;
  inviteToken?: string | null;
  invitedAt?: string | null;
  inviteUrl?: string | null;
  emailSent?: boolean | undefined;
}

export interface Shift {
  id: string;
  tenantId: string;
  branchId: string;
  staffId: string;
  staffName: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:mm
  end: string; // HH:mm
  notes: string;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  branchId: string;
  staffId: string;
  staffName: string;
  clockIn: string;
  clockOut: string | null;
}

export interface Promotion {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  kind: "percent" | "amount";
  value: number;
  minSpend: number;
  startsAt: string; // yyyy-mm-dd
  endsAt: string; // yyyy-mm-dd
  active: boolean;
  uses: number;
  maxUses: number | null;
}

// ---------- Stage 4: reports, audit logs, integrations, and settings ----------

export type AuditAction = "create" | "update" | "delete" | "void" | "refund" | "stock_adjust" | "status_change" | "payment";
export type AuditEntity = "order" | "inventory" | "staff" | "payment" | "table" | "menu" | "settings" | "branch";

export interface AuditLog {
  id: string;
  tenantId: string;
  branchId?: string | null;
  actorId?: string | null;
  actorName: string;
  actorRole?: string | null;
  action: AuditAction | string;
  entity: AuditEntity | string;
  entityId?: string | null;
  summary: string;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AuditLogStats {
  total: number;
  today?: number;
  criticalCount?: number;
  byEntity?: Record<string, number>;
}

export interface AuditLogQueryParams {
  entity?: string;
  action?: string;
  branchId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogs {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type IntegrationCategory = "payments" | "delivery" | "accounting" | "notifications";

export interface Integration {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  icon: string;
  enabled: boolean;
  config: Record<string, string>;
  lastSyncAt: string | null;
  status: "connected" | "disconnected" | "error";
}

export interface SalesReport {
  totalRevenue: number;
  netSales: number;
  totalOrders: number;
  avgOrderValue: number;
  hourlySales: {
    hour: string;
    sales: number;
    orders: number;
    label?: string;
    period?: string;
    isCurrent?: boolean;
    isPeak?: boolean;
  }[];
  dailySales: { date: string; fullDate?: string; sales: number; orders: number }[];
  topItems: {
    itemId: string;
    name: string;
    qty: number;
    revenue: number;
    percentage?: number;
    avgPrice?: number;
  }[];
  salesByCategory: { categoryId: string; name: string; revenue: number }[];
}

export interface FinancialReport {
  grossSales: number;
  discounts: number;
  taxes: number;
  serviceCharges: number;
  refunds: number;
  netRevenue: number;
  expensesTotal: number;
  netProfit: number;
  byPaymentMethod: { method: PaymentMethod; count: number; total: number }[];
}

export interface InventoryReport {
  totalValuation: number;
  totalItems: number;
  lowStockCount: number;
  wastageCost: number;
  lowStockList: { id: string; name: string; unit: string; stock: number; reorderLevel: number; unitCost: number }[];
  topMovements: { ingredientId: string; name: string; qty: number; reason: string }[];
}

export interface OperationsReport {
  avgPrepTimeMinutes: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
  ordersByType: { type: OrderType; count: number; revenue: number }[];
  kitchenBumpsCount: number;
  tableTurnover: { tableId: string; name: string; orderCount: number; totalRevenue: number }[];
  staffShiftsSummary: { staffId: string; name: string; shiftsCount: number; totalHours: number }[];
}

export interface TenantSettingsInput {
  name: string;
  tagline: string;
  initials: string;
  accent: string;
  currency: string;
  locale: string;
  taxRate: number;
  serviceChargeRate: number;
  receiptFooter: string;
}

