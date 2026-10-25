import { ApiError, commit, latency, tenantDb, uid } from "@/mocks/db";
import { TENANTS } from "@/mocks/platform";
import { computeTotals, round2 } from "@/lib/pricing";
import { awardLoyalty, checkPromotion } from "./people.service";
import { backendFetch } from "./api-client";
import type {
  Category,
  Combo,
  DeliveryInfo,
  DiningTable,
  Discount,
  Ingredient,
  KitchenStatus,
  MenuItem,
  ModifierGroup,
  Notification,
  Order,
  OrderLine,
  OrderStatus,
  OrderType,
  Payment,
  PaymentMethod,
  Refund,
  StockMovement,
  TableStatus,
} from "@/types/domain";

// Every function takes tenantId first and reads only that tenant's store.
// Shapes mirror future REST endpoints under /tenants/:tenantId/...

const tenantOf = (tenantId: string) => {
  const t = TENANTS.find((x) => x.id === tenantId);
  if (!t) throw new ApiError(404, "Restaurant not found.");
  return t;
};

const findOrder = (tenantId: string, orderId: string) => {
  const o = tenantDb(tenantId).orders.find((x) => x.id === orderId);
  if (!o) throw new ApiError(404, "Order not found.");
  return o;
};

// ---------- Menu ----------
export interface MenuBundle {
  categories: Category[];
  items: MenuItem[];
  modifierGroups: ModifierGroup[];
  combos: Combo[];
}

export async function getMenu(tenantId: string): Promise<MenuBundle> {
  try {
    const backendCategories = await backendFetch<Category[]>(`/tenants/${tenantId}/categories?activeOnly=true`);
    if (Array.isArray(backendCategories)) {
      const db = tenantDb(tenantId);
      db.categories = backendCategories.map((c, idx) => ({
        id: c.id,
        tenantId: c.tenantId || tenantId,
        name: c.name,
        sort: c.sort ?? idx,
      }));
      commit(tenantId);
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch categories from backend, using local store:", err);
    }
  }

  try {
    const backendGroups = await backendFetch<any[]>(`/tenants/${tenantId}/modifier-groups`);
    if (Array.isArray(backendGroups)) {
      const db = tenantDb(tenantId);
      db.modifierGroups = backendGroups.map((g) => ({
        id: g.id,
        tenantId: g.tenantId || tenantId,
        name: g.name,
        min: g.min ?? 0,
        max: g.max ?? 1,
        options: (g.options || []).map((o: any) => ({
          id: o.id,
          name: o.name,
          price: Number(o.price) || 0,
        })),
      }));
      commit(tenantId);
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch modifier groups from backend, using local store:", err);
    }
  }

  try {
    const backendCombos = await backendFetch<any[]>(`/tenants/${tenantId}/combos`);
    if (Array.isArray(backendCombos)) {
      const db = tenantDb(tenantId);
      db.combos = backendCombos.map((c) => ({
        id: c.id,
        tenantId: c.tenantId || tenantId,
        name: c.name,
        description: c.description ?? "",
        price: Number(c.price) || 0,
        available: c.available ?? true,
        components: (c.components || c.items || []).map((x: any) => ({
          itemId: x.itemId || x.menuItemId,
          qty: x.qty ?? x.quantity ?? 1,
        })),
      }));
      commit(tenantId);
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch combos from backend, using local store:", err);
    }
  }

  try {
    const backendItems = await backendFetch<any[]>(`/tenants/${tenantId}/menu-items`);
    if (Array.isArray(backendItems)) {
      const db = tenantDb(tenantId);
      db.menuItems = backendItems.map((item) => ({
        id: item.id,
        tenantId: item.tenantId || tenantId,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description ?? "",
        price: Number(item.effectivePrice ?? item.price) || 0,
        available: item.effectiveAvailable ?? item.available ?? true,
        tags: item.tags ?? [],
        modifierGroupIds: item.modifierGroupIds ?? [],
        variants: (item.variants || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          priceDelta: Number(v.priceDelta) || 0,
        })),
        recipe: [],
      }));
      commit(tenantId);
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch menu items from backend, using local store:", err);
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  return { categories: [...db.categories].sort((a, b) => a.sort - b.sort), items: db.menuItems, modifierGroups: db.modifierGroups, combos: db.combos };
}

// ---------- Orders ----------
export interface OrderFilters {
  branchId: string;
  status?: Order["status"] | "active" | "all";
  search?: string;
}

const ACTIVE: Order["status"][] = ["in_kitchen", "ready", "served"];

export function mapBackendOrderToDomain(raw: any): Order {
  const statusMap: Record<string, OrderStatus> = {
    IN_KITCHEN: "in_kitchen",
    READY: "ready",
    SERVED: "served",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  };
  const kitchenStatusMap: Record<string, KitchenStatus> = {
    NEW: "new",
    PREPARING: "preparing",
    READY: "ready",
    BUMPED: "bumped",
  };
  const typeMap: Record<string, OrderType> = {
    DINE_IN: "dine_in",
    TAKEAWAY: "takeaway",
    PICKUP: "pickup",
    COUNTER: "counter",
    DELIVERY: "delivery",
  };

  const discountKind = raw.discountKind
    ? ((raw.discountKind.toLowerCase() === "percent" ? "percent" : "amount") as "percent" | "amount")
    : null;

  return {
    id: raw.id,
    tenantId: raw.tenantId,
    branchId: raw.branchId,
    number: raw.orderNumber || raw.number || `#${raw.id.slice(0, 4)}`,
    type: typeMap[raw.type] || (raw.type?.toLowerCase() as OrderType) || "dine_in",
    tableId: raw.tableId || null,
    tableName: raw.tableName || raw.table?.name || null,
    customerName: raw.customerName || "",
    customerPhone: raw.customerPhone || "",
    lines: (raw.lines || []).map((l: any) => ({
      id: l.id,
      itemId: l.menuItemId || l.itemId || "",
      name: l.name,
      variantId: l.variantId || null,
      variantName: l.variantName || null,
      modifiers: (l.modifiers || []).map((m: any) => ({
        groupId: m.groupId || "",
        optionId: m.optionId || "",
        name: m.name,
        price: Number(m.price) || 0,
      })),
      qty: Number(l.qty) || 1,
      unitPrice: Number(l.unitPrice) || 0,
      notes: l.notes || "",
    })),
    discount: discountKind
      ? {
          kind: discountKind,
          value: Number(raw.discount) || 0,
          reason: raw.discountReason || "",
          promoCode: raw.promoCode || undefined,
        }
      : null,
    notes: raw.notes || "",
    totals: {
      subtotal: Number(raw.subtotal) || 0,
      discount: Number(raw.discount) || 0,
      serviceCharge: Number(raw.serviceCharge) || 0,
      tax: Number(raw.tax) || 0,
      total: Number(raw.total) || 0,
    },
    status: statusMap[raw.status] || (raw.status?.toLowerCase() as OrderStatus) || "in_kitchen",
    kitchenStatus: kitchenStatusMap[raw.kitchenStatus] || (raw.kitchenStatus?.toLowerCase() as KitchenStatus) || "new",
    payments: (raw.payments || []).map((p: any) => ({
      id: p.id,
      method: (p.method?.toLowerCase() as PaymentMethod) || "cash",
      amount: Number(p.amount) || 0,
      tendered: Number(p.tendered) || Number(p.amount) || 0,
      change: Number(p.change) || 0,
      reference: p.reference || "",
      at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    })),
    paid: Number(raw.paid) || 0,
    refunds: (raw.refunds || []).map((r: any) => ({
      id: r.id,
      amount: Number(r.amount) || 0,
      reason: r.reason || "",
      at: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      by: r.createdBy || "",
    })),
    refunded: Number(raw.refunded) || 0,
    delivery: raw.deliveryAddress
      ? {
          address: raw.deliveryAddress,
          riderId: raw.riderId || null,
          riderName: raw.riderName || null,
          status: (raw.deliveryStatus?.toLowerCase() as any) || "pending",
          dispatchedAt: raw.dispatchedAt ? new Date(raw.dispatchedAt).toISOString() : null,
          deliveredAt: raw.deliveredAt ? new Date(raw.deliveredAt).toISOString() : null,
        }
      : null,
    inventoryDeducted: Boolean(raw.inventoryDeducted),
    createdBy: raw.createdBy || "",
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    sentToKitchenAt: raw.sentToKitchenAt ? new Date(raw.sentToKitchenAt).toISOString() : new Date().toISOString(),
    readyAt: raw.readyAt ? new Date(raw.readyAt).toISOString() : null,
    completedAt: raw.completedAt ? new Date(raw.completedAt).toISOString() : null,
  };
}

export async function listOrders(tenantId: string, f: OrderFilters): Promise<Order[]> {
  try {
    const params = new URLSearchParams();
    if (f.branchId) params.append("branchId", f.branchId);
    if (f.status) params.append("status", f.status);
    if (f.search) params.append("search", f.search);

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const backendOrders = await backendFetch<any[]>(`/tenants/${tenantId}/orders${queryStr}`);
    if (Array.isArray(backendOrders)) {
      const mapped = backendOrders.map(mapBackendOrderToDomain);
      const db = tenantDb(tenantId);
      db.orders = mapped;
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch orders from backend, using local store:", err);
    }
  }

  await latency();
  const q = f.search?.trim().toLowerCase();
  return tenantDb(tenantId)
    .orders.filter((o) => o.branchId === f.branchId)
    .filter((o) =>
      !f.status || f.status === "all" ? true : f.status === "active" ? ACTIVE.includes(o.status) : o.status === f.status,
    )
    .filter((o) => !q || o.number.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || (o.tableName ?? "").toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrder(tenantId: string, orderId: string): Promise<Order> {
  try {
    const backendOrder = await backendFetch<any>(`/tenants/${tenantId}/orders/${encodeURIComponent(orderId)}`);
    if (backendOrder && backendOrder.id) {
      const mapped = mapBackendOrderToDomain(backendOrder);
      const db = tenantDb(tenantId);
      const idx = db.orders.findIndex((x) => x.id === mapped.id);
      if (idx >= 0) db.orders[idx] = mapped;
      else db.orders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch order from backend, using local store:", err);
    }
  }

  await latency(80, 200);
  return findOrder(tenantId, orderId);
}

export interface CreateOrderInput {
  branchId: string;
  type: OrderType;
  tableId: string | null;
  customerName: string;
  customerPhone: string;
  lines: OrderLine[];
  discount: Discount | null;
  notes: string;
  createdBy: string;
  deliveryAddress?: string | undefined;
}

export async function createOrder(tenantId: string, input: CreateOrderInput): Promise<Order> {
  try {
    const payload = {
      branchId: input.branchId,
      type: input.type,
      tableId: input.tableId || undefined,
      customerName: input.customerName?.trim() || undefined,
      customerPhone: input.customerPhone?.trim() || undefined,
      deliveryAddress: input.type === "delivery" ? (input.deliveryAddress ?? "").trim() : undefined,
      notes: input.notes?.trim() || undefined,
      createdBy: input.createdBy || undefined,
      discount: input.discount
        ? {
            kind: input.discount.kind,
            value: input.discount.value,
            reason: input.discount.reason,
            promoCode: input.discount.promoCode,
          }
        : undefined,
      lines: input.lines.map((l) => ({
        menuItemId: l.itemId,
        itemId: l.itemId,
        name: l.name,
        variantId: l.variantId || undefined,
        variantName: l.variantName || undefined,
        qty: l.qty,
        unitPrice: l.unitPrice,
        notes: l.notes || undefined,
        modifiers: (l.modifiers || []).map((m) => ({
          groupId: m.groupId || undefined,
          optionId: m.optionId || undefined,
          name: m.name,
          price: m.price,
        })),
      })),
    };

    const backendOrder = await backendFetch<any>(`/tenants/${tenantId}/orders`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (backendOrder && backendOrder.id) {
      const mapped = mapBackendOrderToDomain(backendOrder);
      const db = tenantDb(tenantId);
      const existingIdx = db.orders.findIndex((o) => o.id === mapped.id);
      if (existingIdx >= 0) {
        db.orders[existingIdx] = mapped;
      } else {
        db.orders.unshift(mapped);
      }
      if (mapped.tableId) {
        const t = db.tables.find((x) => x.id === mapped.tableId || x.name === mapped.tableName);
        if (t) {
          t.status = "occupied";
          t.currentOrderId = mapped.id;
        }
      }
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable, falling back to local database for order creation");
    } else {
      throw err;
    }
  }

  await latency(250, 500);
  const tenant = tenantOf(tenantId);
  const db = tenantDb(tenantId);
  if (input.lines.length === 0) throw new ApiError(422, "Add at least one item.");
  let tableName: string | null = null;
  if (input.type === "dine_in") {
    const table = db.tables.find((t) => t.id === input.tableId && t.branchId === input.branchId);
    if (!table) throw new ApiError(422, "Select a table for dine-in orders.");
    if (table.status === "occupied") throw new ApiError(409, `${table.name} already has an open order.`);
    tableName = table.name;
  }
  if (input.type === "delivery" && !(input.deliveryAddress ?? "").trim()) throw new ApiError(422, "Enter a delivery address.");
  if (input.discount?.promoCode) {
    // Re-validate promo codes server-side; the client value is never trusted.
    const subtotal = computeTotals({ lines: input.lines, discount: null, orderType: input.type, taxRate: tenant.taxRate, serviceChargeRate: tenant.serviceChargeRate }).subtotal;
    const promo = checkPromotion(db, input.discount.promoCode, subtotal);
    input = { ...input, discount: { kind: promo.kind, value: promo.value, reason: `Promo ${promo.code}`, promoCode: promo.code } };
    promo.uses += 1;
  }
  db.orderSeq += 1;
  const now = new Date().toISOString();
  const order: Order = {
    id: uid("ord"),
    tenantId,
    branchId: input.branchId,
    number: `#${db.orderSeq}`,
    type: input.type,
    tableId: input.type === "dine_in" ? input.tableId : null,
    tableName,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    lines: structuredClone(input.lines),
    discount: input.discount ? { ...input.discount } : null,
    notes: input.notes,
    totals: computeTotals({ lines: input.lines, discount: input.discount, orderType: input.type, taxRate: tenant.taxRate, serviceChargeRate: tenant.serviceChargeRate }),
    status: "in_kitchen",
    kitchenStatus: "new",
    payments: [],
    paid: 0,
    refunds: [],
    refunded: 0,
    delivery: input.type === "delivery" ? { address: (input.deliveryAddress ?? "").trim(), riderId: null, riderName: null, status: "pending", dispatchedAt: null, deliveredAt: null } : null,
    inventoryDeducted: false,
    createdBy: input.createdBy,
    createdAt: now,
    sentToKitchenAt: now,
    readyAt: null,
    completedAt: null,
  };
  db.orders.push(order);
  if (order.tableId) {
    const t = db.tables.find((x) => x.id === order.tableId)!;
    t.status = "occupied";
    t.currentOrderId = order.id;
  }
  commit(tenantId);
  return order;
}

export async function addOrderLines(tenantId: string, orderId: string, lines: OrderLine[]): Promise<Order> {
  try {
    const payload = lines.map((l) => ({
      menuItemId: l.itemId,
      itemId: l.itemId,
      name: l.name,
      variantId: l.variantId || undefined,
      variantName: l.variantName || undefined,
      qty: l.qty,
      unitPrice: l.unitPrice,
      notes: l.notes || undefined,
      modifiers: (l.modifiers || []).map((m) => ({
        groupId: m.groupId || undefined,
        optionId: m.optionId || undefined,
        name: m.name,
        price: m.price,
      })),
    }));

    const backendOrder = await backendFetch<any>(`/tenants/${tenantId}/orders/${orderId}/lines`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (backendOrder && backendOrder.id) {
      const mapped = mapBackendOrderToDomain(backendOrder);
      const db = tenantDb(tenantId);
      const idx = db.orders.findIndex((x) => x.id === mapped.id);
      if (idx >= 0) db.orders[idx] = mapped;
      else db.orders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Backend addOrderLines failed, using local store:", err);
    }
  }

  await latency(200, 400);
  const tenant = tenantOf(tenantId);
  const db = tenantDb(tenantId);
  const order = findOrder(tenantId, orderId);
  if (order.status === "completed" || order.status === "cancelled") {
    throw new ApiError(400, "Cannot add items to a completed or cancelled order.");
  }
  order.lines.push(...structuredClone(lines));
  order.totals = computeTotals({
    lines: order.lines,
    discount: order.discount,
    orderType: order.type,
    taxRate: tenant.taxRate,
    serviceChargeRate: tenant.serviceChargeRate,
  });
  order.sentToKitchenAt = new Date().toISOString();
  order.kitchenStatus = "new";
  commit(tenantId);
  return order;
}

function maybeComplete(tenantId: string, order: Order) {
  const db = tenantDb(tenantId);
  if (order.status === "served" && order.paid >= order.totals.total) {
    order.status = "completed";
    order.completedAt = new Date().toISOString();
    if (order.tableId) {
      const t = db.tables.find((x) => x.id === order.tableId);
      if (t && t.currentOrderId === order.id) {
        t.status = "cleaning";
        t.currentOrderId = null;
      }
    }
  }
}

function deductInventory(tenantId: string, order: Order) {
  if (order.inventoryDeducted) return;
  const db = tenantDb(tenantId);
  // Expand combos into their component items so each recipe is deducted.
  const units: { itemId: string; qty: number }[] = order.lines.flatMap((line) => {
    const combo = db.combos.find((c) => c.id === line.itemId);
    return combo ? combo.components.map((c) => ({ itemId: c.itemId, qty: c.qty * line.qty })) : [{ itemId: line.itemId, qty: line.qty }];
  });
  for (const line of units) {
    const item = db.menuItems.find((m) => m.id === line.itemId);
    if (!item) continue;
    for (const r of item.recipe) {
      const ing = db.ingredients.find((i) => i.branchId === order.branchId && i.key === r.ingredientKey);
      if (!ing) continue;
      const qty = round2(r.qty * line.qty * 1000) / 1000;
      ing.stock = Math.round((ing.stock - qty) * 1000) / 1000;
      const mv: StockMovement = {
        id: uid("mv"),
        tenantId,
        branchId: order.branchId,
        ingredientId: ing.id,
        ingredientName: ing.name,
        qty: -qty,
        unit: ing.unit,
        reason: "sale",
        reference: order.number,
        createdAt: new Date().toISOString(),
      };
      db.movements.unshift(mv);
    }
  }
  order.inventoryDeducted = true;
  const low = db.ingredients.filter((i) => i.branchId === order.branchId && i.stock <= i.reorderLevel);
  if (low.length) {
    db.notifications.unshift({
      id: uid("n"),
      tenantId,
      title: "Low stock",
      body: `${low.map((l) => l.name).slice(0, 3).join(", ")} at or below reorder level.`,
      createdAt: new Date().toISOString(),
      read: false,
    });
  }
}

const KITCHEN_FLOW: Record<KitchenStatus, KitchenStatus | null> = { new: "preparing", preparing: "ready", ready: "bumped", bumped: null };

export async function advanceKitchen(
  tenantId: string,
  orderId: string,
  targetStatus?: KitchenStatus,
): Promise<Order> {
  try {
    const url = targetStatus
      ? `/tenants/${tenantId}/orders/${encodeURIComponent(orderId)}/kitchen/status`
      : `/tenants/${tenantId}/orders/${encodeURIComponent(orderId)}/kitchen/advance`;

    const backendOrder = await backendFetch<any>(url, {
      method: "PATCH",
      ...(targetStatus && {
        body: JSON.stringify({ kitchenStatus: targetStatus.toUpperCase() }),
      }),
    });
    if (backendOrder && backendOrder.id) {
      const mapped = mapBackendOrderToDomain(backendOrder);
      const db = tenantDb(tenantId);
      const idx = db.orders.findIndex((x) => x.id === mapped.id || x.number === mapped.number);
      if (idx >= 0) db.orders[idx] = mapped;
      else db.orders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status !== 503) {
      throw err;
    }
    console.warn("Backend advanceKitchen failed, using local store:", err);
  }

  await latency(100, 250);
  const order = findOrder(tenantId, orderId);
  if (order.status === "cancelled") throw new ApiError(409, "Order was cancelled.");
  const next = targetStatus || KITCHEN_FLOW[order.kitchenStatus];
  if (!next) throw new ApiError(409, "Ticket already bumped.");
  order.kitchenStatus = next;
  if (next === "ready") {
    order.readyAt = new Date().toISOString();
    if (order.status === "in_kitchen") order.status = "ready";
  }
  commit(tenantId);
  return order;
}

export async function markServed(tenantId: string, orderId: string): Promise<Order> {
  try {
    const backendOrder = await backendFetch<any>(`/tenants/${tenantId}/orders/${encodeURIComponent(orderId)}/serve`, {
      method: "PATCH",
    });
    if (backendOrder && backendOrder.id) {
      const mapped = mapBackendOrderToDomain(backendOrder);
      const db = tenantDb(tenantId);
      const idx = db.orders.findIndex((x) => x.id === mapped.id || x.number === mapped.number);
      if (idx >= 0) db.orders[idx] = mapped;
      else db.orders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status !== 503) {
      throw err;
    }
    console.warn("Backend markServed failed, using local store:", err);
  }

  await latency(100, 250);
  const order = findOrder(tenantId, orderId);
  if (order.status !== "ready") throw new ApiError(409, "Only ready orders can be served.");
  order.status = "served";
  if (order.kitchenStatus === "ready") order.kitchenStatus = "bumped";
  maybeComplete(tenantId, order);
  commit(tenantId);
  return order;
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  tendered: number;
  reference: string;
}

export async function addPayment(tenantId: string, orderId: string, input: PaymentInput): Promise<Order> {
  try {
    const payload = {
      method: input.method.toUpperCase(),
      amount: input.amount,
      tendered: input.tendered,
      change: input.method === "cash" ? Math.max(0, input.tendered - input.amount) : 0,
      reference: input.reference || undefined,
    };
    const res = await backendFetch<any>(`/tenants/${tenantId}/orders/${orderId}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const backendOrder = res?.order || res;
    if (backendOrder && backendOrder.id) {
      const mapped = mapBackendOrderToDomain(backendOrder);
      const db = tenantDb(tenantId);
      const idx = db.orders.findIndex((x) => x.id === mapped.id);
      if (idx >= 0) db.orders[idx] = mapped;
      else db.orders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Backend addPayment failed, using local store:", err);
    }
  }

  await latency(400, 800);
  const order = findOrder(tenantId, orderId);
  if (order.status === "cancelled") throw new ApiError(409, "Cannot pay a cancelled order.");
  const due = round2(order.totals.total - order.paid);
  if (due <= 0) throw new ApiError(409, "Order is already paid.");
  const amount = round2(Math.min(input.amount, due));
  if (amount <= 0) throw new ApiError(422, "Enter an amount greater than zero.");
  if (input.method === "cash" && input.tendered < amount) throw new ApiError(422, "Cash tendered is less than the amount.");
  order.payments.push({
    id: uid("pay"),
    method: input.method,
    amount,
    tendered: input.method === "cash" ? input.tendered : amount,
    change: input.method === "cash" ? round2(input.tendered - amount) : 0,
    reference: input.reference,
    at: new Date().toISOString(),
  });
  order.paid = round2(order.paid + amount);
  if (order.paid >= order.totals.total) {
    deductInventory(tenantId, order);
    awardLoyalty(tenantDb(tenantId), order);
  }
  maybeComplete(tenantId, order);
  commit(tenantId);
  return order;
}

export async function cancelOrder(tenantId: string, orderId: string, reason: string): Promise<Order> {
  await latency();
  const order = findOrder(tenantId, orderId);
  if (order.status === "completed") throw new ApiError(409, "Completed orders cannot be voided.");
  if (round2(order.paid - order.refunded) > 0) throw new ApiError(409, "Refund all payments before voiding.");
  order.status = "cancelled";
  order.notes = [order.notes, `Voided: ${reason}`].filter(Boolean).join("\n");
  const db = tenantDb(tenantId);
  if (order.tableId) {
    const t = db.tables.find((x) => x.id === order.tableId);
    if (t && t.currentOrderId === order.id) {
      t.status = "available";
      t.currentOrderId = null;
    }
  }
  commit(tenantId);
  return order;
}

// ---------- Tables ----------
export async function listTables(tenantId: string, branchId: string): Promise<DiningTable[]> {
  try {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    const backendTables = await backendFetch<any[]>(`/tenants/${tenantId}/tables${qs}`);
    if (Array.isArray(backendTables)) {
      const statusMap: Record<string, TableStatus> = {
        AVAILABLE: "available",
        OCCUPIED: "occupied",
        RESERVED: "reserved",
        CLEANING: "cleaning",
      };
      const db = tenantDb(tenantId);
      const mapped: DiningTable[] = backendTables.map((t) => {
        const shape: "round" | "square" | "long" =
          t.shape === "round" || t.shape === "long" || t.shape === "square"
            ? t.shape
            : t.shape === "rectangle" || t.shape === "booth"
            ? "long"
            : "square";

        return {
          id: t.id,
          tenantId: t.tenantId || tenantId,
          branchId: t.branchId || branchId,
          name: t.name,
          seats: t.seats ?? 4,
          area: t.area || "Main hall",
          status: statusMap[t.status] || (t.status?.toLowerCase() as TableStatus) || "available",
          currentOrderId: t.currentOrderId || t.orders?.[0]?.id || null,
          x: t.x ?? 0,
          y: t.y ?? 0,
          shape,
        };
      });

      mapped.forEach((tbl) => {
        const idx = db.tables.findIndex((x) => x.id === tbl.id || (x.branchId === tbl.branchId && x.name === tbl.name));
        if (idx >= 0) db.tables[idx] = tbl;
        else db.tables.push(tbl);
      });
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch tables from backend, using local store:", err);
    }
  }

  await latency(80, 200);
  return tenantDb(tenantId).tables.filter((t) => !branchId || t.branchId === branchId);
}

export async function getTable(tenantId: string, tableId: string): Promise<DiningTable> {
  const statusMap: Record<string, TableStatus> = {
    AVAILABLE: "available",
    OCCUPIED: "occupied",
    RESERVED: "reserved",
    CLEANING: "cleaning",
  };

  try {
    const t = await backendFetch<any>(`/tenants/${tenantId}/tables/${encodeURIComponent(tableId)}`);
    if (t && t.id) {
      const shape: "round" | "square" | "long" =
        t.shape === "round" || t.shape === "long" || t.shape === "square"
          ? t.shape
          : t.shape === "rectangle" || t.shape === "booth"
          ? "long"
          : "square";

      const mapped: DiningTable = {
        id: t.id,
        tenantId: t.tenantId || tenantId,
        branchId: t.branchId,
        name: t.name,
        seats: t.seats ?? 4,
        area: t.area || "Main hall",
        status: statusMap[t.status] || (t.status?.toLowerCase() as TableStatus) || "available",
        currentOrderId: t.currentOrderId || t.orders?.[0]?.id || null,
        x: t.x ?? 0,
        y: t.y ?? 0,
        shape,
      };

      const db = tenantDb(tenantId);
      const idx = db.tables.findIndex((x) => x.id === mapped.id || (x.branchId === mapped.branchId && x.name === mapped.name));
      if (idx >= 0) db.tables[idx] = mapped;
      else db.tables.push(mapped);
      commit(tenantId);

      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch table from backend, using local store:", err);
    }
  }

  await latency(60, 150);
  const found = tenantDb(tenantId).tables.find((x) => x.id === tableId || x.name === tableId);
  if (!found) throw new ApiError(404, "Table not found");
  return found;
}

export async function setTableStatus(tenantId: string, tableId: string, status: TableStatus): Promise<DiningTable> {
  const statusMap: Record<string, TableStatus> = {
    AVAILABLE: "available",
    OCCUPIED: "occupied",
    RESERVED: "reserved",
    CLEANING: "cleaning",
  };

  try {
    const res = await backendFetch<any>(`/tenants/${tenantId}/tables/${encodeURIComponent(tableId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: status.toUpperCase() }),
    });

    if (res && res.id) {
      const db = tenantDb(tenantId);
      const target = db.tables.find((x) => x.id === tableId || x.id === res.id);
      if (target) {
        target.status = statusMap[res.status] || status;
        commit(tenantId);
        return target;
      }
    }
  } catch (err) {
    if (err instanceof ApiError && err.status !== 503 && err.status !== 404) {
      throw err;
    }
    console.warn("Could not update table status via backend, updating local store:", err);
  }

  await latency(80, 200);
  const t = tenantDb(tenantId).tables.find((x) => x.id === tableId);
  if (!t) throw new ApiError(404, "Table not found.");
  if (t.status === "occupied") throw new ApiError(409, "Close the open order before changing this table.");
  if (status === "occupied") throw new ApiError(422, "Tables become occupied when an order is opened.");
  t.status = status;
  commit(tenantId);
  return t;
}

export interface CreateTableInput {
  branchId: string;
  name: string;
  seats: number;
  area: string;
  shape: "square" | "round" | "long";
}

export async function createTable(tenantId: string, input: CreateTableInput): Promise<DiningTable> {
  const trimmedName = input.name.trim();

  try {
    const payload = {
      branchId: input.branchId,
      name: trimmedName,
      seats: input.seats || 4,
      area: input.area?.trim() || "Main hall",
      shape: input.shape || "square",
      status: "AVAILABLE",
    };

    const res = await backendFetch<any>(`/tenants/${tenantId}/tables`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res && res.id) {
      const statusMap: Record<string, TableStatus> = {
        AVAILABLE: "available",
        OCCUPIED: "occupied",
        RESERVED: "reserved",
        CLEANING: "cleaning",
      };

      const mapped: DiningTable = {
        id: res.id,
        tenantId: res.tenantId || tenantId,
        branchId: res.branchId || input.branchId,
        name: res.name || trimmedName,
        seats: res.seats ?? (input.seats || 4),
        area: res.area || input.area || "Main hall",
        status: statusMap[res.status] || (res.status?.toLowerCase() as TableStatus) || "available",
        currentOrderId: res.currentOrderId || null,
        x: res.x ?? 0,
        y: res.y ?? 0,
        shape: (res.shape?.toLowerCase() as any) || input.shape || "square",
      };

      const db = tenantDb(tenantId);
      const existingIdx = db.tables.findIndex(
        (t) => t.id === mapped.id || (t.branchId === mapped.branchId && t.name.toLowerCase() === mapped.name.toLowerCase()),
      );
      if (existingIdx >= 0) {
        db.tables[existingIdx] = mapped;
      } else {
        db.tables.push(mapped);
      }
      commit(tenantId);

      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status !== 503) {
      throw err;
    }
    console.warn("Could not create table via backend, falling back to local store:", err);
  }

  await latency(120, 250);
  const db = tenantDb(tenantId);
  const exists = db.tables.find(
    (t) => t.branchId === input.branchId && t.name.toLowerCase() === trimmedName.toLowerCase(),
  );
  if (exists) {
    throw new ApiError(409, `Table "${trimmedName}" already exists in this branch.`);
  }
  const table: DiningTable = {
    id: `${input.branchId}_tbl_${uid("tbl")}`,
    tenantId,
    branchId: input.branchId,
    name: trimmedName,
    seats: input.seats || 4,
    area: input.area.trim() || "Main hall",
    status: "available",
    currentOrderId: null,
    x: 0,
    y: 0,
    shape: input.shape || "square",
  };
  db.tables.push(table);
  commit(tenantId);
  return table;
}

export interface UpdateTableInput {
  name?: string;
  seats?: number;
  area?: string;
  shape?: "square" | "round" | "long";
  status?: TableStatus;
  isActive?: boolean;
}

export async function updateTable(
  tenantId: string,
  tableId: string,
  input: UpdateTableInput,
): Promise<DiningTable> {
  const statusMap: Record<string, TableStatus> = {
    AVAILABLE: "available",
    OCCUPIED: "occupied",
    RESERVED: "reserved",
    CLEANING: "cleaning",
  };

  try {
    const payload: any = {};
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.seats !== undefined) payload.seats = Number(input.seats);
    if (input.area !== undefined) payload.area = input.area.trim();
    if (input.shape !== undefined) payload.shape = input.shape;
    if (input.status !== undefined) payload.status = input.status.toUpperCase();
    if (input.isActive !== undefined) payload.isActive = input.isActive;

    const res = await backendFetch<any>(`/tenants/${tenantId}/tables/${encodeURIComponent(tableId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    if (res && res.id) {
      const shape: "round" | "square" | "long" =
        res.shape === "round" || res.shape === "long" || res.shape === "square"
          ? res.shape
          : res.shape === "rectangle" || res.shape === "booth"
          ? "long"
          : "square";

      const mapped: DiningTable = {
        id: res.id,
        tenantId: res.tenantId || tenantId,
        branchId: res.branchId,
        name: res.name,
        seats: res.seats ?? (input.seats || 4),
        area: res.area || input.area || "Main hall",
        status: statusMap[res.status] || (res.status?.toLowerCase() as TableStatus) || "available",
        currentOrderId: res.currentOrderId || null,
        x: res.x ?? 0,
        y: res.y ?? 0,
        shape,
      };

      const db = tenantDb(tenantId);
      const idx = db.tables.findIndex((x) => x.id === tableId || x.id === res.id);
      if (idx >= 0) db.tables[idx] = mapped;
      else db.tables.push(mapped);
      commit(tenantId);

      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status !== 503) {
      throw err;
    }
    console.warn("Could not update table via backend, updating local store:", err);
  }

  await latency(80, 200);
  const db = tenantDb(tenantId);
  const t = db.tables.find((x) => x.id === tableId);
  if (!t) throw new ApiError(404, "Table not found.");
  if (input.name) t.name = input.name.trim();
  if (input.seats) t.seats = input.seats;
  if (input.area) t.area = input.area.trim();
  if (input.shape) t.shape = input.shape;
  if (input.status) t.status = input.status;
  commit(tenantId);
  return t;
}

export async function deleteTable(tenantId: string, tableId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await backendFetch<any>(`/tenants/${tenantId}/tables/${encodeURIComponent(tableId)}`, {
      method: "DELETE",
    });

    const db = tenantDb(tenantId);
    const idx = db.tables.findIndex((x) => x.id === tableId);
    if (idx >= 0) {
      db.tables.splice(idx, 1);
      commit(tenantId);
    }

    return {
      ok: true,
      message: res?.message || "Table deleted successfully",
    };
  } catch (err) {
    if (err instanceof ApiError && err.status !== 503) {
      throw err;
    }
    console.warn("Could not delete table via backend, updating local store:", err);
  }

  await latency(80, 200);
  const db = tenantDb(tenantId);
  const idx = db.tables.findIndex((x) => x.id === tableId);
  const target = idx >= 0 ? db.tables[idx] : undefined;
  if (!target) throw new ApiError(404, "Table not found.");
  if (target.status === "occupied") {
    throw new ApiError(409, "Cannot delete table while occupied with an active order.");
  }
  db.tables.splice(idx, 1);
  commit(tenantId);
  return { ok: true, message: "Table deleted successfully" };
}

// ---------- Inventory ----------
export async function listIngredients(tenantId: string, branchId: string): Promise<Ingredient[]> {
  try {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    const backendIngs = await backendFetch<any[]>(`/tenants/${tenantId}/inventory/ingredients${qs}`);
    if (Array.isArray(backendIngs)) {
      const db = tenantDb(tenantId);
      const mapped: Ingredient[] = backendIngs.map((ing) => ({
        id: ing.id,
        tenantId: ing.tenantId || tenantId,
        branchId: ing.branchId || branchId,
        key: ing.key || ing.id,
        name: ing.name,
        unit: ing.unit,
        stock: Number(ing.stock) || 0,
        reorderLevel: Number(ing.reorderLevel) || 0,
        unitCost: Number(ing.unitCost) || 0,
      }));
      db.ingredients = [
        ...db.ingredients.filter((x) => x.branchId !== branchId),
        ...mapped,
      ];
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch ingredients from backend, using local store:", err);
    }
  }

  await latency();
  return tenantDb(tenantId).ingredients.filter((i) => i.branchId === branchId);
}

export async function listMovements(tenantId: string, branchId: string): Promise<StockMovement[]> {
  await latency();
  return tenantDb(tenantId).movements.filter((m) => m.branchId === branchId).slice(0, 100);
}

// ---------- Notifications ----------
export async function listNotifications(tenantId: string): Promise<Notification[]> {
  await latency(60, 150);
  return tenantDb(tenantId).notifications.slice(0, 20);
}

export async function markNotificationsRead(tenantId: string): Promise<{ ok: true }> {
  await latency(60, 120);
  tenantDb(tenantId).notifications.forEach((n) => (n.read = true));
  commit(tenantId);
  return { ok: true };
}

// ---------- Dashboard ----------
export interface DashboardSummary {
  todaySales: number;
  todayOrders: number;
  avgTicket: number;
  activeOrders: number;
  kitchenQueue: number;
  occupiedTables: number;
  totalTables: number;
  salesByDay: { date: string; sales: number; orders: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  lowStock: Ingredient[];
  recentOrders: Order[];
}

export async function getDashboard(tenantId: string, branchId: string): Promise<DashboardSummary> {
  await latency(200, 400);
  const db = tenantDb(tenantId);
  const orders = db.orders.filter((o) => o.branchId === branchId && o.status !== "cancelled");
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const paidToday = orders.filter((o) => o.paid > 0 && o.createdAt >= startOfDay.toISOString());
  const todaySales = round2(paidToday.reduce((s, o) => s + o.paid, 0));
  const days: DashboardSummary["salesByDay"] = [];
  for (let d = 6; d >= 0; d--) {
    const start = new Date(startOfDay.getTime() - d * 86400000);
    const end = new Date(start.getTime() + 86400000);
    const inDay = orders.filter((o) => o.createdAt >= start.toISOString() && o.createdAt < end.toISOString());
    days.push({ date: start.toISOString(), sales: round2(inDay.reduce((s, o) => s + o.paid, 0)), orders: inDay.length });
  }
  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of orders) for (const l of o.lines) {
    const e = itemMap.get(l.itemId) ?? { name: l.name, qty: 0, revenue: 0 };
    e.qty += l.qty;
    e.revenue = round2(e.revenue + l.unitPrice * l.qty);
    itemMap.set(l.itemId, e);
  }
  const tables = db.tables.filter((t) => t.branchId === branchId);
  return {
    todaySales,
    todayOrders: paidToday.length,
    avgTicket: paidToday.length ? round2(todaySales / paidToday.length) : 0,
    activeOrders: orders.filter((o) => ACTIVE.includes(o.status)).length,
    kitchenQueue: orders.filter((o) => o.kitchenStatus === "new" || o.kitchenStatus === "preparing").length,
    occupiedTables: tables.filter((t) => t.status === "occupied").length,
    totalTables: tables.length,
    salesByDay: days,
    topItems: [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    lowStock: db.ingredients.filter((i) => i.branchId === branchId && i.stock <= i.reorderLevel),
    recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
  };
}
