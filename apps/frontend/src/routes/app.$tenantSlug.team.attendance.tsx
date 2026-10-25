import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/$tenantSlug/team/attendance")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/app/$tenantSlug/team/roles", params });
  },
  component: () => null,
});
