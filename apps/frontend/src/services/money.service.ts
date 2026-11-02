import { ApiError, commit, latency, tenantDb, uid } from "@/mocks/db";
import type { TenantDb } from "@/mocks/seed";
import { round2 } from "@/lib/pricing";
import type { CashSession, DeliveryStatus, Expense, Order, PaymentMethod, Rider } from "@/types/domain";
import { backendFetch } from "./api-client";
import { mapBackendOrderToDomain } from "./operations.service";

// Payments ledger, refunds, cash drawer sessions, expenses and delivery dispatch.
// Future REST: /tenants/:tenantId/payments, /orders/:id/refunds, /cash-sessions, /expenses, /deliveries

// ---------- Payments ledger ----------
export interface LedgerRow {
  id: string;
  kind: "payment" | "refund";
  orderId: string;
  orderNumber: string;
  method: PaymentMethod;
  amount: number;
  reference: string;
  at: string;
}

export async function listLedger(tenantId: string, branchId: string): Promise<LedgerRow[]> {
  await latency();
  const rows: LedgerRow[] = [];
  for (const o of tenantDb(tenantId).orders) {
    if (o.branchId !== branchId) continue;
    for (const p of o.payments) rows.push({ id: p.id, kind: "payment", orderId: o.id, orderNumber: o.number, method: p.method, amount: p.amount, reference: p.reference, at: p.at });
    for (const r of o.refunds) rows.push({ id: r.id, kind: "refund", orderId: o.id, orderNumber: o.number, method: r.method, amount: -r.amount, reference: r.reason, at: r.at });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------- Refunds ----------
export interface RefundInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reason: string;
  by: string;
}

export async function refundOrder(tenantId: string, input: RefundInput): Promise<Order> {
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new ApiError(422, "Enter an amount greater than zero.");
  if (!input.reason.trim()) throw new ApiError(422, "A reason is required.");

  try {
    const res = await backendFetch<any>(`/tenants/${tenantId}/orders/${encodeURIComponent(input.orderId)}/refunds`, {
      method: "POST",
      body: JSON.stringify({
        amount,
        method: input.method.toUpperCase(),
        reason: input.reason.trim(),
        by: input.by,
      }),
    });

    const orderData = res?.order || res;
    if (orderData && orderData.id) {
      const mapped = mapBackendOrderToDomain(orderData);
      const db = tenantDb(tenantId);
      const idx = db.orders.findIndex((x) => x.id === mapped.id);
      if (idx >= 0) db.orders[idx] = mapped;
      else db.orders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for refund, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency(300, 600);
  const db = tenantDb(tenantId);
  const o = db.orders.find((x) => x.id === input.orderId);
  if (!o) throw new ApiError(404, "Order not found.");
  const refundable = round2(o.paid - o.refunded);
  if (refundable <= 0) throw new ApiError(409, "Nothing left to refund on this order.");
  if (amount > refundable) throw new ApiError(422, `You can refund at most ${refundable}.`);
  if (!o.payments.some((p) => p.method === input.method)) throw new ApiError(422, "Refund to a method the guest paid with.");
  if (input.method === "cash" && !openSession(db, o.branchId)) throw new ApiError(409, "Open the cash drawer before giving a cash refund.");
  o.refunds.push({ id: uid("ref"), amount, method: input.method, reason: input.reason.trim(), by: input.by, at: new Date().toISOString() });
  o.refunded = round2(o.refunded + amount);
  // Take back loyalty points earned on the refunded share of the order.
  const c = db.customers.find((x) => x.ledger.some((l) => l.reference === o.number && l.reason === "Order"));
  const back = Math.min(c?.points ?? 0, Math.floor(amount / db.loyalty.spendPerPoint));
  if (c && back > 0) {
    c.points -= back;
    c.ledger.unshift({ id: uid("led"), points: -back, reason: "Refund", reference: o.number, at: new Date().toISOString() });
  }
  commit(tenantId);
  return o;
}

// ---------- Cash drawer ----------
const openSession = (db: TenantDb, branchId: string) => db.cashSessions.find((s) => s.branchId === branchId && s.closedAt === null);

export interface CashSummary {
  openingFloat: number;
  cashSales: number;
  cashRefunds: number;
  cashExpenses: number;
  cashIn: number;
  cashOut: number;
  expected: number;
}

/** Expected drawer cash = float + cash taken − cash refunds − drawer expenses + pay-ins − pay-outs. */
export function summariseSession(db: TenantDb, s: CashSession, until = new Date().toISOString()): CashSummary {
  const end = s.closedAt ?? until;
  const inWindow = (at: string) => at >= s.openedAt && at <= end;
  let cashSales = 0;
  let cashRefunds = 0;
  for (const o of db.orders) {
    if (o.branchId !== s.branchId) continue;
    for (const p of o.payments) if (p.method === "cash" && inWindow(p.at)) cashSales += p.amount;
    for (const r of o.refunds) if (r.method === "cash" && inWindow(r.at)) cashRefunds += r.amount;
  }
  const cashExpenses = db.expenses.filter((e) => e.branchId === s.branchId && e.paidFrom === "cash_drawer" && inWindow(e.createdAt)).reduce((a, e) => a + e.amount, 0);
  const cashIn = s.entries.filter((e) => e.kind === "in").reduce((a, e) => a + e.amount, 0);
  const cashOut = s.entries.filter((e) => e.kind === "out").reduce((a, e) => a + e.amount, 0);
  const expected = round2(s.openingFloat + cashSales - cashRefunds - cashExpenses + cashIn - cashOut);
  return { openingFloat: s.openingFloat, cashSales: round2(cashSales), cashRefunds: round2(cashRefunds), cashExpenses: round2(cashExpenses), cashIn: round2(cashIn), cashOut: round2(cashOut), expected };
}

export interface CashSessionView extends CashSession {
  summary: CashSummary;
}

export async function listCashSessions(tenantId: string, branchId: string): Promise<CashSessionView[]> {
  await latency();
  const db = tenantDb(tenantId);
  return db.cashSessions
    .filter((s) => s.branchId === branchId)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    .map((s) => ({ ...s, summary: summariseSession(db, s) }));
}

export async function openCashSession(tenantId: string, input: { branchId: string; openingFloat: number; by: string }): Promise<CashSession> {
  await latency();
  const db = tenantDb(tenantId);
  if (openSession(db, input.branchId)) throw new ApiError(409, "A cash drawer is already open for this branch.");
  if (!(input.openingFloat >= 0)) throw new ApiError(422, "Opening float can't be negative.");
  db.docSeq += 1;
  const s: CashSession = { id: uid("cash"), tenantId, branchId: input.branchId, number: `CS-${db.docSeq}`, openedBy: input.by, openedAt: new Date().toISOString(), openingFloat: round2(input.openingFloat), entries: [], closedBy: null, closedAt: null, expectedCash: null, countedCash: null, variance: null, notes: "" };
  db.cashSessions.push(s);
  commit(tenantId);
  return s;
}

export async function addCashEntry(tenantId: string, input: { branchId: string; kind: "in" | "out"; amount: number; reason: string; by: string }): Promise<CashSession> {
  await latency();
  const db = tenantDb(tenantId);
  const s = openSession(db, input.branchId);
  if (!s) throw new ApiError(409, "Open the cash drawer first.");
  if (!(input.amount > 0)) throw new ApiError(422, "Enter an amount greater than zero.");
  if (!input.reason.trim()) throw new ApiError(422, "A reason is required.");
  if (input.kind === "out" && input.amount > summariseSession(db, s).expected) throw new ApiError(422, "Pay-out is more than the cash in the drawer.");
  s.entries.push({ id: uid("ce"), kind: input.kind, amount: round2(input.amount), reason: input.reason.trim(), by: input.by, at: new Date().toISOString() });
  commit(tenantId);
  return s;
}

export async function closeCashSession(tenantId: string, input: { branchId: string; countedCash: number; notes: string; by: string }): Promise<CashSession> {
  await latency();
  const db = tenantDb(tenantId);
  const s = openSession(db, input.branchId);
  if (!s) throw new ApiError(409, "No open cash drawer for this branch.");
  if (!(input.countedCash >= 0)) throw new ApiError(422, "Enter the counted cash.");
  const sum = summariseSession(db, s);
  s.closedAt = new Date().toISOString();
  s.closedBy = input.by;
  s.expectedCash = sum.expected;
  s.countedCash = round2(input.countedCash);
  s.variance = round2(s.countedCash - sum.expected);
  s.notes = input.notes.trim();
  if (Math.abs(s.variance) > 0) {
    db.notifications.unshift({ id: uid("n"), tenantId, title: "Cash variance", body: `${s.number} closed ${s.variance > 0 ? "over" : "short"} by ${Math.abs(s.variance)}.`, createdAt: s.closedAt, read: false });
  }
  commit(tenantId);
  return s;
}

// ---------- Expenses ----------
export async function listExpenses(tenantId: string, branchId: string): Promise<Expense[]> {
  await latency();
  return tenantDb(tenantId).expenses.filter((e) => e.branchId === branchId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export type ExpenseInput = Pick<Expense, "branchId" | "category" | "description" | "amount" | "paidFrom" | "date" | "createdBy">;

export async function createExpense(tenantId: string, input: ExpenseInput): Promise<Expense> {
  await latency();
  const db = tenantDb(tenantId);
  if (!input.description.trim()) throw new ApiError(422, "Description is required.");
  if (!(input.amount > 0)) throw new ApiError(422, "Enter an amount greater than zero.");
  if (input.paidFrom === "cash_drawer") {
    const s = openSession(db, input.branchId);
    if (!s) throw new ApiError(409, "Open the cash drawer to pay from cash.");
    if (input.amount > summariseSession(db, s).expected) throw new ApiError(422, "Not enough cash in the drawer.");
  }
  const e: Expense = { id: uid("exp"), tenantId, ...input, description: input.description.trim(), amount: round2(input.amount), createdAt: new Date().toISOString() };
  db.expenses.push(e);
  commit(tenantId);
  return e;
}

export async function deleteExpense(tenantId: string, id: string): Promise<{ ok: true }> {
  await latency();
  const db = tenantDb(tenantId);
  const e = db.expenses.find((x) => x.id === id);
  if (!e) throw new ApiError(404, "Expense not found.");
  if (e.paidFrom === "cash_drawer") {
    const s = db.cashSessions.find((x) => x.branchId === e.branchId && e.createdAt >= x.openedAt && (x.closedAt === null || e.createdAt <= x.closedAt));
    if (s?.closedAt) throw new ApiError(409, "This cash expense belongs to a closed drawer and can't be deleted.");
  }
  db.expenses = db.expenses.filter((x) => x.id !== id);
  commit(tenantId);
  return { ok: true };
}

// ---------- Delivery ----------
export async function listDeliveries(tenantId: string, branchId: string): Promise<Order[]> {
  try {
    const params = new URLSearchParams();
    if (branchId) params.append("branchId", branchId);
    params.append("type", "DELIVERY");

    const backendOrders = await backendFetch<any[]>(`/tenants/${tenantId}/orders?${params.toString()}`);
    if (Array.isArray(backendOrders)) {
      const mapped = backendOrders
        .map(mapBackendOrderToDomain)
        .filter((o) => o.status !== "cancelled");
      const db = tenantDb(tenantId);
      for (const order of mapped) {
        const idx = db.orders.findIndex((x) => x.id === order.id);
        if (idx >= 0) db.orders[idx] = order;
        else db.orders.push(order);
      }
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch deliveries from backend, using local store:", err);
    }
  }

  await latency();
  return tenantDb(tenantId)
    .orders.filter((o) => o.branchId === branchId && o.type === "delivery" && o.status !== "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listRiders(tenantId: string, branchId: string): Promise<Rider[]> {
  try {
    const params = new URLSearchParams();
    if (branchId) params.append("branchId", branchId);
    params.append("activeOnly", "true");

    const backendRiders = await backendFetch<any[]>(`/tenants/${tenantId}/riders?${params.toString()}`);
    if (Array.isArray(backendRiders)) {
      const mapped: Rider[] = backendRiders.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        branchId: r.branchId,
        name: r.name,
        phone: r.phone || "",
      }));
      const db = tenantDb(tenantId);
      db.riders = mapped;
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch riders from backend, using local store:", err);
    }
  }

  await latency(60, 150);
  return tenantDb(tenantId).riders.filter((r) => r.branchId === branchId);
}

export async function saveRider(
  tenantId: string,
  input: { id?: string; branchId: string; name: string; phone: string }
): Promise<Rider> {
  const trimmedName = input.name.trim();
  const trimmedPhone = input.phone.trim();
  if (!trimmedName) throw new ApiError(422, "Rider name is required.");

  try {
    const body = {
      branchId: input.branchId,
      name: trimmedName,
      phone: trimmedPhone,
    };

    let backendRider: any;
    if (input.id) {
      backendRider = await backendFetch<any>(`/tenants/${tenantId}/riders/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      backendRider = await backendFetch<any>(`/tenants/${tenantId}/riders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (backendRider && backendRider.id) {
      const mapped: Rider = {
        id: backendRider.id,
        tenantId: backendRider.tenantId,
        branchId: backendRider.branchId,
        name: backendRider.name,
        phone: backendRider.phone || "",
      };
      const db = tenantDb(tenantId);
      const idx = db.riders.findIndex((r) => r.id === mapped.id);
      if (idx >= 0) db.riders[idx] = mapped;
      else db.riders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const r: Rider = {
    id: input.id || uid("rider"),
    tenantId,
    branchId: input.branchId,
    name: trimmedName,
    phone: trimmedPhone,
  };
  const idx = db.riders.findIndex((x) => x.id === r.id);
  if (idx >= 0) db.riders[idx] = r;
  else db.riders.push(r);
  commit(tenantId);
  return r;
}

export async function deleteRider(tenantId: string, id: string): Promise<{ success: boolean; message: string }> {
  try {
    await backendFetch(`/tenants/${tenantId}/riders/${id}`, {
      method: "DELETE",
    });
    const db = tenantDb(tenantId);
    db.riders = db.riders.filter((r) => r.id !== id);
    commit(tenantId);
    return { success: true, message: "Rider deleted successfully" };
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      throw err;
    }
  }

  const db = tenantDb(tenantId);
  db.riders = db.riders.filter((r) => r.id !== id);
  commit(tenantId);
  return { success: true, message: "Rider deleted successfully" };
}

const DELIVERY_NEXT: Record<DeliveryStatus, DeliveryStatus | null> = {
  pending: "assigned",
  assigned: "out",
  out: "delivered",
  delivered: null,
};

export async function updateDelivery(
  tenantId: string,
  input: { orderId: string; status: DeliveryStatus; riderId?: string | undefined }
): Promise<Order> {
  try {
    const backendRes = await backendFetch<any>(`/tenants/${tenantId}/orders/${input.orderId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: input.status,
        riderId: input.riderId,
      }),
    });

    if (backendRes && backendRes.id) {
      const mapped = mapBackendOrderToDomain(backendRes);
      const db = tenantDb(tenantId);
      const idx = db.orders.findIndex((o) => o.id === mapped.id);
      if (idx >= 0) db.orders[idx] = mapped;
      else db.orders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const o = db.orders.find((x) => x.id === input.orderId);
  if (!o || !o.delivery) throw new ApiError(404, "Delivery not found.");
  const d = o.delivery;
  if (DELIVERY_NEXT[d.status] !== input.status) throw new ApiError(409, `Can't move a ${d.status} delivery to ${input.status}.`);
  const now = new Date().toISOString();
  if (input.status === "assigned") {
    const rider = db.riders.find((r) => r.id === input.riderId && r.branchId === o.branchId);
    if (!rider) throw new ApiError(422, "Choose a rider.");
    d.riderId = rider.id;
    d.riderName = rider.name;
  }
  if (input.status === "out") {
    if (o.kitchenStatus !== "ready" && o.kitchenStatus !== "bumped") throw new ApiError(409, "Wait until the kitchen marks the order ready.");
    d.dispatchedAt = now;
    if (o.kitchenStatus === "ready") o.kitchenStatus = "bumped";
  }
  if (input.status === "delivered") {
    d.deliveredAt = now;
    if (o.status === "ready" || o.status === "in_kitchen") o.status = "served";
    if (o.status === "served" && o.paid >= o.totals.total) {
      o.status = "completed";
      o.completedAt = now;
    }
  }
  d.status = input.status;
  commit(tenantId);
  return o;
}
