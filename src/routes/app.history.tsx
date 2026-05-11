import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Mic, Timer, Activity, Hand } from "lucide-react";

export const Route = createFileRoute("/app/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("emergency_alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .then(({ data }) => setAlerts(data ?? []));
  }, [user]);

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-2xl font-bold">Emergency history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Timeline of all alerts and responses.</p>

      <div className="mt-6 space-y-3">
        {alerts.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No emergencies recorded. That's a great thing.
          </div>
        )}
        {alerts.map((a, i) => {
          const Icon = a.type === "fall" ? Activity : a.type === "voice" ? Mic : a.type === "deadman" ? Timer : a.type === "manual" ? Hand : AlertTriangle;
          return (
            <div key={a.id} className="relative pl-8">
              <div className="absolute left-2 top-3 h-3 w-3 rounded-full bg-primary shadow-[0_0_0_4px_oklch(0.62_0.24_25/0.2)]" />
              {i < alerts.length - 1 && <div className="absolute left-3 top-6 h-full w-px bg-border" />}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold capitalize">{a.type}</p>
                  </div>
                  <StatusBadge variant={a.status === "active" ? "danger" : a.status === "resolved" ? "safe" : "muted"}>
                    {a.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(a.started_at).toLocaleString()}
                </p>
                {a.lat && (
                  <p className="mt-2 text-xs text-accent">
                    📍 {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
