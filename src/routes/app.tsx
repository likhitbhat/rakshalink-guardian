import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Shield } from "lucide-react";
import { useZoneTransitionTracker } from "@/lib/zone-tracker";
import { useBackgroundLocationTracking } from "@/lib/location-tracker";
import { FallDetectionProvider } from "@/lib/fall-detection";
import { OfflineSync } from "@/components/OfflineSync";
import { SessionTimeout } from "@/components/SessionTimeout";
import { SystemMonitorProvider } from "@/lib/system-status";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, profile, user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth/login" });
    // Only bounce guardians away from the wearer home, not shared pages like /app/settings
    if (!loading && session && profile?.role === "guardian" && window.location.pathname === "/app") {
      nav({ to: "/guardian" });
    }
  }, [loading, session, profile, nav]);

  useZoneTransitionTracker(user?.id);
  useBackgroundLocationTracking(user?.id);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Shield className="h-10 w-10 animate-pulse text-accent" />
      </div>
    );
  }

  return (
    <FallDetectionProvider>
      <SystemMonitorProvider>
        <OfflineSync userId={user?.id} />
        <SessionTimeout />
        <AppShell>
          <Outlet />
        </AppShell>
      </SystemMonitorProvider>
    </FallDetectionProvider>
  );
}
