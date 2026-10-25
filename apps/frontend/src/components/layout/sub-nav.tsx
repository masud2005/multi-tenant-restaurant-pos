import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import type { Permission } from "@/config/permissions.config";

export type SubNavTo =
  | "/app/$tenantSlug/menu"
  | "/app/$tenantSlug/menu/categories"
  | "/app/$tenantSlug/menu/modifiers"
  | "/app/$tenantSlug/menu/combos"
  | "/app/$tenantSlug/inventory"
  | "/app/$tenantSlug/inventory/stock-movements"
  | "/app/$tenantSlug/inventory/stock-counts"
  | "/app/$tenantSlug/finance"
  | "/app/$tenantSlug/finance/cash"
  | "/app/$tenantSlug/finance/expenses"
  | "/app/$tenantSlug/team"
  | "/app/$tenantSlug/team/roles";

export interface SubNavItem {
  to: SubNavTo;
  label: string;
  perm?: Permission | undefined;
  icon?: LucideIcon | undefined;
}

/** Tab-style links between sibling pages of one module. */
export function SubNav({ items }: { items: SubNavItem[] }) {
  const { tenant, can } = useTenant();
  return (
    <nav aria-label="Section" className="mb-5 flex gap-1 overflow-x-auto border-b">
      {items
        .filter((i) => !i.perm || can(i.perm))
        .map((i) => (
          <Link
            key={i.to}
            to={i.to}
            params={{ tenantSlug: tenant.slug }}
            activeOptions={{ exact: true }}
            className="-mb-px shrink-0 flex items-center gap-2 border-b-2 border-transparent px-3.5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: "border-primary font-semibold text-foreground" }}
          >
            {i.icon && <i.icon className="size-4 shrink-0" />}
            <span>{i.label}</span>
          </Link>
        ))}
    </nav>
  );
}
