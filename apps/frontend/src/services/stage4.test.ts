import { describe, expect, it } from "vitest";
import {
  getSalesReport,
  getFinancialReport,
  getInventoryReport,
  getOperationsReport,
  listAuditLogs,
  recordAuditLog,
  getAuditLogStats,
  listIntegrations,
  toggleIntegration,
  updateTenantSettings,
} from "./stage4.service";

const demoTenantId = "t_saffron";

describe("Stage 4: Reports, Audit Logs, Integrations & Settings", () => {
  it("computes sales report with total revenue, orders count and top dishes", async () => {
    const report = await getSalesReport(demoTenantId);
    expect(report.totalOrders).toBeGreaterThan(0);
    expect(report.totalRevenue).toBeGreaterThan(0);
    expect(report.avgOrderValue).toBeGreaterThan(0);
    expect(report.dailySales.length).toBe(7);
    expect(report.topItems.length).toBeGreaterThan(0);
    expect(report.topItems[0]?.name).toBeDefined();
    expect(report.topItems[0]?.qty).toBeGreaterThan(0);
    expect(report.topItems[0]?.revenue).toBeGreaterThan(0);
    expect(typeof report.topItems[0]?.percentage).toBe("number");
    expect(report.hourlySales.length).toBe(8);
    expect(report.hourlySales[0]?.hour).toBe("08:00");
    expect(report.hourlySales[0]?.label).toBe("08:00 - 10:00");
    expect(typeof report.hourlySales[0]?.orders).toBe("number");
    expect(typeof report.hourlySales[0]?.sales).toBe("number");
    expect(report.hourlySales.some((h) => h.isPeak)).toBe(true);
  });

  it("computes financial report with gross sales, tax, discounts and net profit", async () => {
    const report = await getFinancialReport(demoTenantId);
    expect(report.grossSales).toBeGreaterThan(0);
    expect(report.netRevenue).toBe(report.grossSales - report.refunds);
    expect(report.byPaymentMethod.length).toBe(3);
    const cash = report.byPaymentMethod.find((payment) => payment.method === "cash");
    expect(cash).toBeDefined();
  });

  it("calculates inventory valuation and flags low stock items", async () => {
    const report = await getInventoryReport(demoTenantId);
    expect(report.totalValuation).toBeGreaterThan(0);
    expect(report.totalItems).toBeGreaterThan(0);
    expect(Array.isArray(report.lowStockList)).toBe(true);
  });

  it("computes operational metrics including table turnover and kitchen prep time", async () => {
    const report = await getOperationsReport(demoTenantId);
    expect(report.avgPrepTimeMinutes).toBeGreaterThan(0);
    expect(report.ordersByStatus.length).toBe(5);
    expect(report.tableTurnover.length).toBeGreaterThan(0);
  });

  it("records new audit actions and returns them in reverse chronological order", async () => {
    const created = await recordAuditLog(demoTenantId, {
      actorId: "u_owner",
      actorName: "Test Manager",
      action: "void",
      entity: "order",
      entityId: "ord_test_void",
      summary: "Voided test order due to mistake",
    });
    expect(created.id).toBeDefined();

    const logs = await listAuditLogs(demoTenantId, "order");
    expect(logs[0]?.id).toBe(created.id);
    expect(logs[0]?.summary).toBe("Voided test order due to mistake");

    // Test with query filters object
    const filtered = await listAuditLogs(demoTenantId, { entity: "order", search: "mistake" });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0]?.summary).toContain("mistake");

    // Test stats
    const stats = await getAuditLogStats(demoTenantId);
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.criticalCount).toBeGreaterThan(0);
  });

  it("toggles third party integrations and records an audit trail", async () => {
    const list = await listIntegrations(demoTenantId);
    expect(list.length).toBeGreaterThan(0);

    const updated = await toggleIntegration(demoTenantId, "int_stripe", false);
    expect(updated.enabled).toBe(false);
    expect(updated.status).toBe("disconnected");

    const reEnabled = await toggleIntegration(demoTenantId, "int_stripe", true);
    expect(reEnabled.enabled).toBe(true);
    expect(reEnabled.status).toBe("connected");
    expect(reEnabled.lastSyncAt).not.toBeNull();
  });

  it("updates tenant branding, theme color and tax settings", async () => {
    const updated = await updateTenantSettings(demoTenantId, {
      name: "Saffron & Ember Grill",
      tagline: "Fine charcoal & dining",
      initials: "SEG",
      accent: "oklch(0.60 0.18 45)",
      currency: "BDT",
      locale: "en-BD",
      taxRate: 0.1,
      serviceChargeRate: 0.05,
      receiptFooter: "Thank you for dining with us!",
    });

    expect(updated.name).toBe("Saffron & Ember Grill");
    expect(updated.taxRate).toBe(0.1);
    expect(updated.accent).toBe("oklch(0.60 0.18 45)");
  });
});
