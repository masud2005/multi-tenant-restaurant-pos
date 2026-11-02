import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCustomRoles,
  getCustomRolesSync,
  saveCustomRole,
  updateCustomRolePermissions,
  deleteCustomRole,
} from "./people.service";

describe("Custom Roles Management (Frontend Service)", () => {
  const tenantSlug = "saffron-ember";

  beforeEach(() => {
    localStorage.clear();
  });

  it("should return empty array when no custom roles exist", () => {
    const roles = getCustomRolesSync(tenantSlug);
    expect(roles).toEqual([]);
  });

  it("should create and retrieve a custom role using local fallback", async () => {
    const created = await saveCustomRole(tenantSlug, {
      name: "Sommelier",
      description: "Wine steward",
      color: "rose",
      baseRole: "waiter",
      permissions: ["pos.use", "tables.view"],
    });

    expect(created.name).toBe("Sommelier");
    expect(created.baseRole).toBe("waiter");
    expect(created.isCustom).toBe(true);

    const list = getCustomRolesSync(tenantSlug);
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe("Sommelier");
  });

  it("should update permissions for an existing custom role", async () => {
    const created = await saveCustomRole(tenantSlug, {
      name: "Shift Lead",
      description: "Supervises cashiers",
      color: "sky",
      baseRole: "cashier",
      permissions: ["pos.use"],
    });

    await updateCustomRolePermissions(tenantSlug, created.id, ["pos.use", "cash.manage", "reports.view"]);

    const list = getCustomRolesSync(tenantSlug);
    expect(list[0]?.permissions).toEqual(["pos.use", "cash.manage", "reports.view"]);
  });

  it("should delete a custom role", async () => {
    const created = await saveCustomRole(tenantSlug, {
      name: "Temporary Helper",
      color: "amber",
      baseRole: "waiter",
      permissions: [],
    });

    expect(getCustomRolesSync(tenantSlug).length).toBe(1);

    await deleteCustomRole(tenantSlug, created.id);

    expect(getCustomRolesSync(tenantSlug).length).toBe(0);
  });
});

