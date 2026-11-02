import { beforeEach, describe, expect, it } from "vitest";
import { resetTenantDb, tenantDb } from "@/mocks/db";
import { addPayment, advanceKitchen, cancelOrder, createOrder } from "./operations.service";
import { refundOrder, openCashSession, addCashEntry, closeCashSession, createExpense, updateDelivery } from "./money.service";
import { saveReservation, saveStaff, setReservationStatus, tierFor } from "./people.service";
import type { OrderLine } from "@/types/domain";

const T = "t_saffron";
const B = "b_se_gulshan";
const line = (price = 1000): OrderLine => ({ id: "l1", itemId: tenantDb(T).menuItems[0]!.id, name: "x", variantId: null, variantName: null, modifiers: [], qty: 1, unitPrice: price, notes: "" });
const order = (extra: Partial<Parameters<typeof createOrder>[1]> = {}) =>
  createOrder(T, { branchId: B, type: "takeaway", tableId: null, customerName: "Test Guest", customerPhone: "+8801700000001", lines: [line()], discount: null, notes: "", createdBy: "t", ...extra });

beforeEach(() => resetTenantDb(T));

describe("stage 3 rules", () => {
  it("full payment earns 1 point per 100 spent (Saffron) and creates the customer", async () => {
    const o = await order();
    await addPayment(T, o.id, { method: "card", amount: o.totals.total, tendered: o.totals.total, reference: "" });
    const c = tenantDb(T).customers.find((x) => x.phone === "+8801700000001")!;
    expect(c.points).toBe(Math.floor(o.totals.total / 100));
    expect(c.visits).toBe(1);
  });

  it("refunding takes back the points earned on the refunded amount", async () => {
    const o = await order();
    await addPayment(T, o.id, { method: "card", amount: o.totals.total, tendered: o.totals.total, reference: "" });
    await refundOrder(T, { orderId: o.id, amount: 500, method: "card", reason: "r", by: "t" });
    const c = tenantDb(T).customers.find((x) => x.phone === "+8801700000001")!;
    expect(c.points).toBe(Math.floor(o.totals.total / 100) - 5);
  });

  it("loyalty tiers: silver at 250, gold at 600 lifetime points", () => {
    expect(tierFor(249)).toBe("bronze");
    expect(tierFor(250)).toBe("silver");
    expect(tierFor(600)).toBe("gold");
  });

  it("promo codes re-validate minimum spend on the server", async () => {
    await expect(order({ lines: [line(500)], discount: { kind: "percent", value: 50, reason: "x", promoCode: "LUNCH10" } })).rejects.toThrow(/Minimum spend/);
    const o = await order({ discount: { kind: "percent", value: 50, reason: "x", promoCode: "LUNCH10" } });
    expect(o.discount?.value).toBe(10);
  });

  it("refunds cannot exceed paid amount; void allowed only once fully refunded", async () => {
    const o = await order();
    await addPayment(T, o.id, { method: "card", amount: o.totals.total, tendered: o.totals.total, reference: "" });
    await expect(refundOrder(T, { orderId: o.id, amount: o.totals.total + 1, method: "card", reason: "r", by: "t" })).rejects.toThrow();
    await expect(cancelOrder(T, o.id, "x")).rejects.toThrow(/Refund/);
    await refundOrder(T, { orderId: o.id, amount: o.totals.total, method: "card", reason: "r", by: "t" });
    expect((await cancelOrder(T, o.id, "x")).status).toBe("cancelled");
  });

  it("cash drawer expected = float + cash sales − cash refunds − drawer expenses + in − out", async () => {
    await openCashSession(T, { branchId: B, openingFloat: 5000, by: "t" });
    const o = await order();
    await addPayment(T, o.id, { method: "cash", amount: o.totals.total, tendered: o.totals.total, reference: "" });
    await refundOrder(T, { orderId: o.id, amount: 100, method: "cash", reason: "r", by: "t" });
    await createExpense(T, { branchId: B, category: "supplies", description: "ice", amount: 200, paidFrom: "cash_drawer", date: "2026-01-01", createdBy: "t" });
    await addCashEntry(T, { branchId: B, kind: "in", amount: 50, reason: "change", by: "t" });
    await addCashEntry(T, { branchId: B, kind: "out", amount: 30, reason: "tip", by: "t" });
    const s = await closeCashSession(T, { branchId: B, countedCash: 0, notes: "", by: "t" });
    expect(s.expectedCash).toBeCloseTo(5000 + o.totals.total - 100 - 200 + 50 - 30, 2);
    expect(s.variance).toBeCloseTo(-(s.expectedCash ?? 0), 2);
  });

  it("only one drawer can be open per branch", async () => {
    await openCashSession(T, { branchId: B, openingFloat: 0, by: "t" });
    await expect(openCashSession(T, { branchId: B, openingFloat: 0, by: "t" })).rejects.toThrow(/already open/);
  });

  it("reservations reject double-booking a table and oversized parties", async () => {
    const table = tenantDb(T).tables.find((t) => t.branchId === B)!;
    const base = { branchId: B, customerName: "A", phone: "", partySize: 2, at: "2030-01-01T18:00:00.000Z", durationMin: 90, tableId: table.id, notes: "" };
    const r = await saveReservation(T, base);
    await expect(saveReservation(T, { ...base, at: "2030-01-01T19:00:00.000Z" })).rejects.toThrow(/already booked/);
    await expect(saveReservation(T, { ...base, at: "2030-01-02T19:00:00.000Z", partySize: table.seats + 1 })).rejects.toThrow(/seats only/);
    await setReservationStatus(T, r.id, "cancelled");
    await expect(setReservationStatus(T, r.id, "seated")).rejects.toThrow();
  });

  it("the last active owner can't be demoted", async () => {
    const owner = tenantDb(T).staff.find((x) => x.role === "owner")!;
    await expect(saveStaff(T, { ...owner, role: "manager" })).rejects.toThrow(/owner/);
  });

  it("delivery needs an address and can't dispatch before the kitchen is ready", async () => {
    await expect(order({ type: "delivery", deliveryAddress: "" })).rejects.toThrow(/address/);
    const o = await order({ type: "delivery", deliveryAddress: "Road 1" });
    const rider = tenantDb(T).riders[0]!;
    await updateDelivery(T, { orderId: o.id, status: "assigned", riderId: rider.id });
    await expect(updateDelivery(T, { orderId: o.id, status: "out" })).rejects.toThrow(/kitchen/);
    await advanceKitchen(T, o.id);
    await advanceKitchen(T, o.id);
    await updateDelivery(T, { orderId: o.id, status: "out" });
    expect((await updateDelivery(T, { orderId: o.id, status: "delivered" })).delivery?.status).toBe("delivered");
  });
});
