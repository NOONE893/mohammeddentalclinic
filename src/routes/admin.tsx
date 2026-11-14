import { createFileRoute, redirect } from "@tanstack/react-router";

// Private staff entry point: not linked from the public site.
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
