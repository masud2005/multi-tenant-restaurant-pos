import { describe, expect, it, vi, beforeEach } from "vitest";
import * as stockService from "./stock.service";
import * as opsService from "./operations.service";
import * as platformService from "./platform.service";
import * as peopleService from "./people.service";
import * as moneyService from "./money.service";
import * as catalogService from "./catalog.service";
import * as apiClient from "./api-client";

describe("Category B Backend Integrations", () => {
  const tenantId = "t_saffron";
  const branchId = "b_se_gulshan";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Stock Counts API", () => {
    it("listStockCounts fetches counts from backend", async () => {
      const mockCounts = [
        {
          id: "sc_1",
          tenantId,
          branchId,
          number: "SC-101",
          notes: "Audit count",
          createdBy: "Auditor",
          createdAt: new Date().toISOString(),
          lines: [
            {
              ingredientId: "ing_1",
              name: "Rice",
              unit: "kg",
              expected: 40,
              counted: 42,
              variance: 2,
            },
          ],
        },
      ];

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockCounts);

      const res = await stockService.listStockCounts(tenantId, branchId);
      expect(res).toHaveLength(1);
      expect(res[0].number).toBe("SC-101");
      expect(res[0].lines[0].variance).toBe(2);
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/tenants/${tenantId}/inventory/stock-counts?branchId=${branchId}`)
      );
    });

    it("submitStockCount posts counts to backend", async () => {
      const mockCreated = {
        id: "sc_2",
        tenantId,
        branchId,
        number: "SC-102",
        notes: "Monthly check",
        createdBy: "Manager",
        createdAt: new Date().toISOString(),
        lines: [
          {
            ingredientId: "ing_rice",
            name: "Chinigura Rice",
            unit: "kg",
            expected: 85,
            counted: 80,
            variance: -5,
          },
        ],
      };

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockCreated);

      const res = await stockService.submitStockCount(tenantId, {
        branchId,
        notes: "Monthly check",
        createdBy: "Manager",
        counts: [{ ingredientId: "ing_rice", counted: 80 }],
      });

      expect(res.id).toBe("sc_2");
      expect(res.lines[0].variance).toBe(-5);
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        `/tenants/${tenantId}/inventory/stock-counts`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Stock Movements API", () => {
    it("listMovements fetches history from backend", async () => {
      const mockMovements = [
        {
          id: "mv_1",
          tenantId,
          branchId,
          ingredientId: "ing_1",
          ingredientName: "Rice",
          qty: 5,
          unit: "kg",
          reason: "purchase",
          reference: "PO-1001",
          createdAt: new Date().toISOString(),
        },
      ];

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockMovements);

      const res = await opsService.listMovements(tenantId, branchId);
      expect(res).toHaveLength(1);
      expect(res[0].ingredientName).toBe("Rice");
      expect(res[0].qty).toBe(5);
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/tenants/${tenantId}/stock-movements?branchId=${branchId}&limit=100`)
      );
    });
  });

  describe("Stock Manual Adjustment API", () => {
    it("adjustStock sends adjustment to backend", async () => {
      const mockResult = {
        id: "ing_rice",
        tenantId,
        branchId,
        name: "Rice",
        unit: "kg",
        stock: 75,
        reorderLevel: 20,
        unitCost: 120,
      };

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockResult);

      const res = await stockService.adjustStock(tenantId, {
        branchId,
        ingredientId: "ing_rice",
        direction: "remove",
        reason: "waste",
        qty: 5,
        note: "Damaged bag",
      });

      expect(res.stock).toBe(75);
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        `/tenants/${tenantId}/inventory/adjust`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Top Bar Branch Switcher API", () => {
    it("listBranches fetches active branches from backend", async () => {
      const mockBranches = [
        { id: "b_1", tenantId, name: "Gulshan Branch", address: "Dhaka", phone: "+8801" },
        { id: "b_2", tenantId, name: "Dhanmondi Branch", address: "Dhaka", phone: "+8802" },
      ];

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockBranches);

      const res = await platformService.listBranches(tenantId, "u_demo");
      expect(res).toHaveLength(2);
      expect(res[0].name).toBe("Gulshan Branch");
      expect(res[1].name).toBe("Dhanmondi Branch");
      expect(apiClient.backendFetch).toHaveBeenCalledWith(`/tenants/${tenantId}/branches`);
    });
  });

  describe("Reservation Rules & Settings API", () => {
    it("getReservationSettings fetches settings from backend", async () => {
      const mockSettings = {
        id: "rs_1",
        tenantId,
        defaultDurationMin: 120,
        bufferTimeMin: 20,
        earlyArrivalWindowMin: 10,
        noShowGracePeriodMin: 20,
        minPartySize: 2,
        maxPartySize: 15,
        maxAdvanceDays: 60,
        minAdvanceHours: 4,
      };

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockSettings);

      const res = await peopleService.getReservationSettings(tenantId);
      expect(res.defaultDurationMin).toBe(120);
      expect(res.bufferTimeMin).toBe(20);
      expect(res.maxAdvanceDays).toBe(60);
      expect(apiClient.backendFetch).toHaveBeenCalledWith(`/tenants/${tenantId}/reservation-settings`);
    });

    it("updateReservationSettings puts new settings to backend", async () => {
      const updatePayload = {
        defaultDurationMin: 105,
        bufferTimeMin: 25,
        maxPartySize: 18,
      };

      const mockUpdated = {
        id: "rs_1",
        tenantId,
        defaultDurationMin: 105,
        bufferTimeMin: 25,
        earlyArrivalWindowMin: 15,
        noShowGracePeriodMin: 15,
        minPartySize: 1,
        maxPartySize: 18,
        maxAdvanceDays: 30,
        minAdvanceHours: 2,
      };

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockUpdated);

      const res = await peopleService.updateReservationSettings(tenantId, updatePayload);
      expect(res.defaultDurationMin).toBe(105);
      expect(res.maxPartySize).toBe(18);
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        `/tenants/${tenantId}/reservation-settings`,
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("Order Refund API", () => {
    it("refundOrder calls backend refunds endpoint and updates order state", async () => {
      const mockRefundedOrder = {
        id: "ord_1001",
        tenantId,
        branchId,
        orderNumber: "#1001",
        status: "COMPLETED",
        total: 1000,
        paid: 1000,
        refunded: 500,
        payments: [{ id: "p_1", method: "CARD", amount: 1000 }],
        refunds: [
          {
            id: "ref_1",
            amount: 500,
            method: "CARD",
            reason: "Dish returned",
            by: "Manager John",
            createdAt: new Date().toISOString(),
          },
        ],
        lines: [],
      };

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce({
        order: mockRefundedOrder,
        refund: mockRefundedOrder.refunds[0],
      });

      const res = await moneyService.refundOrder(tenantId, {
        orderId: "ord_1001",
        amount: 500,
        method: "card",
        reason: "Dish returned",
        by: "Manager John",
      });

      expect(res.refunded).toBe(500);
      expect(res.refunds).toHaveLength(1);
      expect(res.refunds[0].amount).toBe(500);
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        `/tenants/${tenantId}/orders/ord_1001/refunds`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            amount: 500,
            method: "CARD",
            reason: "Dish returned",
            by: "Manager John",
          }),
        })
      );
    });
  });

  describe("Order Void / Cancel API", () => {
    it("cancelOrder calls backend PATCH endpoint and updates status", async () => {
      const mockCancelledOrder = {
        id: "ord_1002",
        tenantId,
        branchId,
        orderNumber: "#1002",
        status: "CANCELLED",
        tableId: "tbl_1",
        notes: "Voided: Customer cancelled food",
        total: 800,
        paid: 0,
        refunded: 0,
        payments: [],
        refunds: [],
        lines: [],
      };

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockCancelledOrder);

      const res = await opsService.cancelOrder(tenantId, "ord_1002", "Customer cancelled food");

      expect(res.status).toBe("cancelled");
      expect(res.notes).toContain("Voided: Customer cancelled food");
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        `/tenants/${tenantId}/orders/ord_1002/cancel`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ reason: "Customer cancelled food" }),
        })
      );
    });
  });
  describe("Category Move / Reorder API", () => {
    it("moveCategory calls backend PATCH endpoint with dir", async () => {
      const mockUpdatedCategories = [
        { id: "cat_2", tenantId, name: "Drinks", sort: 0 },
        { id: "cat_1", tenantId, name: "Food", sort: 1 },
      ];

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockUpdatedCategories);

      const res = await catalogService.moveCategory(tenantId, "cat_1", 1);

      expect(res).toHaveLength(2);
      expect(res[0].id).toBe("cat_2");
      expect(res[1].id).toBe("cat_1");
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        `/tenants/${tenantId}/categories/cat_1/move`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ dir: 1 }),
        })
      );
    });
  });
  describe("Password Reset Flow API", () => {
    it("requestPasswordReset calls backend POST /auth/forgot-password", async () => {
      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce({
        message: "Reset link sent",
        emailSent: true,
        token: "tok-123",
      });

      const res = await platformService.requestPasswordReset("chef@restaurant.com");

      expect(res.ok).toBe(true);
      expect(res.token).toBe("tok-123");
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        "/auth/forgot-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "chef@restaurant.com" }),
        })
      );
    });

    it("validateResetToken calls backend GET /auth/reset-password/validate", async () => {
      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce({
        valid: true,
        email: "chef@restaurant.com",
      });

      const res = await platformService.validateResetToken("tok-123");

      expect(res.valid).toBe(true);
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        "/auth/reset-password/validate?token=tok-123"
      );
    });

    it("resetPassword calls backend POST /auth/reset-password with token and new password", async () => {
      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce({
        message: "Password updated successfully",
      });

      const res = await platformService.resetPassword("tok-123", "NewSecurePassword123!");

      expect(res.message).toBe("Password updated successfully");
      expect(apiClient.backendFetch).toHaveBeenCalledWith(
        "/auth/reset-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "tok-123", newPassword: "NewSecurePassword123!" }),
        })
      );
    });
  });
  describe("Multi-Tenant Workspaces API", () => {
    it("listTenantsForUser calls backend GET /auth/me/tenants and returns workspaces", async () => {
      const mockTenants = [
        {
          id: "t_saffron",
          slug: "saffron-ember",
          name: "Saffron & Ember",
          tagline: "Charcoal grill",
          initials: "SE",
          accent: "oklch(0.6 0.2 40)",
          currency: "BDT",
          locale: "en-BD",
          taxRate: 0.1,
          serviceChargeRate: 0.05,
          receiptFooter: "Thanks",
          role: "owner",
        },
      ];

      vi.spyOn(apiClient, "backendFetch").mockResolvedValueOnce(mockTenants);

      const res = await platformService.listTenantsForUser("usr_1");

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("t_saffron");
      expect(res[0].name).toBe("Saffron & Ember");
      expect(apiClient.backendFetch).toHaveBeenCalledWith("/auth/me/tenants");
    });
  });
});
