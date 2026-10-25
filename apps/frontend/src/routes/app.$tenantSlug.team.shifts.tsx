import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/$tenantSlug/team/shifts")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/app/$tenantSlug/team", params });
  },
  component: () => null,
});
