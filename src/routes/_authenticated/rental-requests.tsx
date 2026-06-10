import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/rental-requests")({
  beforeLoad: () => {
    throw redirect({ to: "/requests" });
  },
});
