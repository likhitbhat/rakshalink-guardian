import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  component: () => (
    <div className="mx-auto min-h-screen w-full max-w-md px-6 py-10">
      <Outlet />
    </div>
  ),
});
