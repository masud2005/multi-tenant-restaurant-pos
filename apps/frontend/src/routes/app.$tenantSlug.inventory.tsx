import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequirePermission } from "@/features/tenant/require-permission";
import { PageHeader } from "@/components/common/states";
import { SubNav } from "@/components/layout/sub-nav";
import { useTenant } from "@/features/tenant/tenant-context";

export const Route = createFileRoute("/app/$tenantSlug/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Tablewise POS" }, { name: "description", content: "Ingredient stock, adjustments, movements and counts." }] }),
  component: InventoryLayout,
});

function InventoryLayout() {
  const { branch } = useTenant();
  return (
    <RequirePermission perm="inventory.view">
      <PageHeader title="Inventory" description={`${branch.name} · paid orders deduct ingredients automatically`} className="mb-3" />
      <SubNav
        items={[
          { to: "/app/$tenantSlug/inventory", label: "Stock levels" },
          { to: "/app/$tenantSlug/inventory/stock-movements", label: "Movements" },
          { to: "/app/$tenantSlug/inventory/stock-counts", label: "Stock counts" },
          { to: "/app/$tenantSlug/inventory/transfers", label: "Transfers" },
        ]}
      />
      <Outlet />
    </RequirePermission>
  );
}
