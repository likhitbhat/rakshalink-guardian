import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/guardian/alerts")({
  component: GuardianAlerts,
});

function GuardianAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [clearing, setClearing] = useState(false);
  const [wearerIds, setWearerIds] = useState<string[]>([]);

  async function load() {
    if (!user) return;
    const { data: links } = await supabase.from("guardian_links").select("user_id").eq("guardian_id", user.id).eq("status", "active");
    const ids = (links ?? []).map((l: any) => l.user_id);
    setWearerIds(ids);
    if (!ids.length) return setAlerts([]);
    const { data } = await supabase
      .from("emergency_alerts")
      .select("*")
      .in("user_id", ids)
      .eq("hidden_by_guardian", false)
      .order("started_at", { ascending: false })
      .limit(50);
    setAlerts(data ?? []);
    const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const m: Record<string, string> = {};
    (ps ?? []).forEach((p: any) => (m[p.id] = p.full_name ?? "User"));
    setNames(m);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("guardian-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_alerts" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const clearHistory = async () => {
    if (!user || !wearerIds.length) return;
    setClearing(true);
    for (const uid of wearerIds) {
      await supabase.rpc("hide_all_alerts_for_guardian", { _user_id: uid });
    }
    setClearing(false);
    setAlerts([]);
    toast.success("History cleared from your dashboard");
  };

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-2xl font-bold">Alerts</h1>
      <p className="mt-1 text-sm text-muted-foreground">Live emergency feed for everyone you watch.</p>

      <div className="mt-6 space-y-2">
        {alerts.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            All quiet — no alerts to show.
          </div>
        )}
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`glass flex items-start gap-3 rounded-2xl p-4 ${a.status === "active" ? "border-primary/50 bg-primary/10" : ""}`}
          >
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${a.status === "active" ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {names[a.user_id] ?? "User"} · <span className="capitalize">{a.type}</span>
                </p>
                <StatusBadge variant={a.status === "active" ? "danger" : "muted"} pulse={a.status === "active"}>
                  {a.status}
                </StatusBadge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(a.started_at).toLocaleString()}
              </p>
              {a.lat && (
                <p className="mt-1 text-xs text-accent">📍 {a.lat.toFixed(4)}, {a.lng.toFixed(4)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
