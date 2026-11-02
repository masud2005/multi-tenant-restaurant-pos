import { describe, it, expect } from "vitest";
import { getInventoryReport, getOperationsReport, getFinancialReport } from "./stage4.service";

describe("Reports Service (Frontend)", () => {
  const tenantId = "t_saffron";
  const branchId = "b_se_gulshan";

  it("should retrieve inventory valuation report with valid metrics", async () => {
    const report = await getInventoryReport(tenantId, branchId);

    expect(report).toBeDefined();
    expect(typeof report.totalValuation).toBe("number");
    expect(typeof report.totalItems).toBe("number");
    expect(typeof report.lowStockCount).toBe("number");
    expect(typeof report.wastageCost).toBe("number");
    expect(Array.isArray(report.lowStockList)).toBe(true);
    expect(Array.isArray(report.topMovements)).toBe(true);
  });

  it("should retrieve operations mechanics report with valid metrics", async () => {
    const report = await getOperationsReport(tenantId, branchId, "7d");

    expect(report).toBeDefined();
    expect(typeof report.avgPrepTimeMinutes).toBe("number");
    expect(Array.isArray(report.ordersByStatus)).toBe(true);
    expect(Array.isArray(report.ordersByType)).toBe(true);
    expect(typeof report.kitchenBumpsCount).toBe("number");
    expect(Array.isArray(report.tableTurnover)).toBe(true);
    expect(Array.isArray(report.staffShiftsSummary)).toBe(true);
  });

  it("should retrieve financial report with valid metrics", async () => {
    const report = await getFinancialReport(tenantId, branchId, "7d");

    expect(report).toBeDefined();
    expect(typeof report.grossSales).toBe("number");
    expect(typeof report.netRevenue).toBe("number");
    expect(Array.isArray(report.byPaymentMethod)).toBe(true);
  });
});

