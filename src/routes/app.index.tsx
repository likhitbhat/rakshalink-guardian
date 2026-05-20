import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { BatteryWidget } from "@/components/BatteryWidget";
import { supabase } from "@/integrations/supabase/client";
import { Bluetooth, MapPin, Phone, Shield, Bell, ChevronRight, Activity, Mic, Timer } from "lucide-react";
import { getMockLocation } from "@/lib/mock-location";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();
  const [loc, setLoc] = useState(getMockLocation());
  const [contactCount, setContactCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<{ id: string; type: string; status: string; started_at: string }[]>([]);

  useEffect(() => {
    const t = setInterval(() => setLoc(getMockLocation()), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const [c, a] = await Promise.all([
        supabase.from("emergency_contacts").select("id", { count: "exact", head: true }),
        supabase.from("emergency_alerts").select("id, type, status, started_at").order("started_at", { ascending: false }).limit(3),
      ]);
      setContactCount(c.count ?? 0);
      setRecentAlerts((a.data as any) ?? []);
    })();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div className="px-5 pt-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{greeting}</p>
          <h1 className="mt-1 text-2xl font-bold">{profile?.full_name ?? "You"}</h1>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-primary/30 font-display text-sm font-bold">
          {(profile?.full_name?.[0] ?? "U").toUpperCase()}
        </div>
      </div>

      {/* Safety status hero */}
      <div className="glass-strong relative mt-6 overflow-hidden rounded-3xl p-5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-success/15 blur-3xl" />
        <div className="relative">
          <StatusBadge variant="safe" pulse>You are safe</StatusBadge>
          <div className="mt-4 flex items-end gap-2">
            <span className="font-display text-5xl font-bold text-gradient-cyan">{profile?.safety_score ?? 85}</span>
            <span className="mb-2 text-xs text-muted-foreground">/ 100 Safety Score</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} · live
          </div>
        </div>
      </div>

      {/* Device row */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/app/device" className="glass rounded-2xl p-4">
          <Bluetooth className="mb-2 h-5 w-5 text-accent" />
          <p className="text-xs text-muted-foreground">Pendant</p>
          <p className="text-sm font-semibold">Connected</p>
        </Link>
        <div className="glass rounded-2xl p-4">
          <Battery className="mb-2 h-5 w-5 text-success" />
          <p className="text-xs text-muted-foreground">Battery</p>
          <p className="text-sm font-semibold">{battery}%</p>
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</h2>
      <div className="grid grid-cols-3 gap-3">
        <QuickAction to="/app/sos" icon={Shield} label="SOS" tone="danger" />
        <QuickAction to="/app/map" icon={MapPin} label="Track" tone="accent" />
        <QuickAction to="/app/zones" icon={Activity} label="Zones" tone="accent" />
        <QuickAction to="/app/device" icon={Bluetooth} label="Pendant" tone="muted" />
        <QuickAction to="/app/sos" icon={Mic} label="Voice SOS" tone="muted" />
        <QuickAction to="/app/sos" icon={Timer} label="Dead-man" tone="muted" />
      </div>

      {/* Contacts banner */}
      {contactCount === 0 && (
        <Link to="/app/contacts" className="glass mt-5 flex items-center gap-3 rounded-2xl border-warning/40 p-4">
          <Phone className="h-5 w-5 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Add an emergency contact</p>
            <p className="text-[11px] text-muted-foreground">They'll be alerted when you trigger SOS.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* Recent alerts */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent activity</h2>
        <Link to="/app/history" className="text-xs text-accent">View all</Link>
      </div>
      <div className="mt-2 space-y-2">
        {recentAlerts.length === 0 && (
          <div className="glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
            No emergencies — stay safe out there.
          </div>
        )}
        {recentAlerts.map((a) => (
          <div key={a.id} className="glass flex items-center gap-3 rounded-2xl p-3">
            <Bell className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium capitalize">{a.type} alert</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(a.started_at).toLocaleString()}
              </p>
            </div>
            <StatusBadge variant={a.status === "active" ? "danger" : "muted"}>{a.status}</StatusBadge>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "danger" | "accent" | "muted";
}) {
  const ring =
    tone === "danger"
      ? "from-primary/30 to-primary/5 text-primary"
      : tone === "accent"
        ? "from-accent/25 to-accent/5 text-accent"
        : "from-muted/30 to-muted/5 text-foreground";
  return (
    <Link to={to as any} className={`glass flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br ${ring} p-4`}>
      <Icon className="h-5 w-5" />
      <span className="text-[11px] font-medium text-foreground">{label}</span>
    </Link>
  );
}
