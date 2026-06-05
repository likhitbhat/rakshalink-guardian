import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { SessionTimeout } from "@/components/SessionTimeout";
import { GuardianAlertSound } from "@/components/GuardianAlertSound";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/guardian")({
  component: GuardianLayout,
});

function GuardianLayout() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth/login" });
  }, [loading, session, nav]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Shield className="h-10 w-10 animate-pulse text-accent" />
      </div>
    );
  }
  return (
    <AppShell>
      <SessionTimeout />
      <GuardianAlertSound />
      <Outlet />
    </AppShell>
  );
}
