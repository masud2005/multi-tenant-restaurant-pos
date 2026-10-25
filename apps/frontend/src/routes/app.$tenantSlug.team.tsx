import { createFileRoute, Outlet } from "@tanstack/react-router";

// Child pages apply their own permission guards.
export const Route = createFileRoute("/app/$tenantSlug/team")({
  head: () => ({
    meta: [
      { title: "Team — Tablewise POS" },
      { name: "description", content: "Staff directory and roles." },
    ],
  }),
  component: () => <Outlet />,
});
