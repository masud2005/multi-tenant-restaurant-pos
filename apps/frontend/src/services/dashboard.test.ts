import { describe, it, expect } from "vitest";
import { getDashboard } from "./operations.service";

describe("Dashboard Service (Frontend)", () => {
  const tenantId = "t_saffron";
  const branchId = "b_se_gulshan";

  it("should retrieve dashboard summary with required metrics", async () => {
    const summary = await getDashboard(tenantId, branchId);

    expect(summary).toBeDefined();
    expect(typeof summary.todaySales).toBe("number");
    expect(typeof summary.todayOrders).toBe("number");
    expect(typeof summary.avgTicket).toBe("number");
    expect(typeof summary.activeOrders).toBe("number");
    expect(typeof summary.kitchenQueue).toBe("number");
    expect(typeof summary.occupiedTables).toBe("number");
    expect(typeof summary.totalTables).toBe("number");

    expect(Array.isArray(summary.salesByDay)).toBe(true);
    expect(summary.salesByDay.length).toBe(7);

    expect(Array.isArray(summary.topItems)).toBe(true);
    expect(Array.isArray(summary.lowStock)).toBe(true);
    expect(Array.isArray(summary.recentOrders)).toBe(true);
  });
});

