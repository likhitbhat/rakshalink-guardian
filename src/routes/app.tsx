import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Shield } from "lucide-react";
import { useZoneTransitionTracker } from "@/lib/zone-tracker";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, profile, user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth/login" });
    if (!loading && session && profile?.role === "guardian") nav({ to: "/guardian" });
  }, [loading, session, profile, nav]);

  useZoneTransitionTracker(user?.id);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Shield className="h-10 w-10 animate-pulse text-accent" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
