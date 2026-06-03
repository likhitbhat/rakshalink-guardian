import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { BatteryWidget } from "@/components/BatteryWidget";
import { supabase } from "@/integrations/supabase/client";
import { Bluetooth, MapPin, Phone, Shield, Bell, ChevronRight, Activity, Mic, Timer, Leaf } from "lucide-react";
import { useLiveLocation } from "@/lib/use-live-location";
import { useSafeZones, findContainingZone } from "@/lib/safe-zone";
import { Skeleton, SkeletonText, SkeletonBadge } from "@/components/ui/skeleton";
import { useMinLoading } from "@/lib/use-min-loading";
import { SystemStatusPanel, ConnectionBadge } from "@/components/SystemStatusPanel";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();
  const { loc, status } = useLiveLocation();
  const zones = useSafeZones(user?.id);
  const activeZone = findContainingZone(loc, zones);
  const [contactCount, setContactCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<{ id: string; type: string; status: string; started_at: string }[]>([]);
  const [activeAlert, setActiveAlert] = useState<{ id: string; type: string; started_at: string } | null>(null);
  const [monthAlertCount, setMonthAlertCount] = useState(0);
  const [deviceBattery, setDeviceBattery] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useMinLoading(loading);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [c, a, m, d] = await Promise.all([
        supabase.from("emergency_contacts").select("id", { count: "exact", head: true }),
        supabase.from("emergency_alerts").select("id, type, status, started_at").order("started_at", { ascending: false }).limit(3),
        supabase.from("emergency_alerts").select("id", { count: "exact", head: true }).gte("started_at", startOfMonth.toISOString()),
        supabase.from("devices").select("battery").eq("user_id", user.id).order("last_seen", { ascending: false }).limit(1),
      ]);
      setContactCount(c.count ?? 0);
      const alerts = (a.data as any) ?? [];
      setRecentAlerts(alerts);
      setActiveAlert(alerts.find((x: any) => x.status === "active") ?? null);
      setMonthAlertCount(m.count ?? 0);
      setDeviceBattery((d.data as any)?.[0]?.battery ?? null);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`home-alerts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_alerts", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  

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
        <div className="flex items-center gap-3">
          <ConnectionBadge />
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-primary/30 font-display text-sm font-bold">
            {(profile?.full_name?.[0] ?? "U").toUpperCase()}
          </div>
        </div>
      </div>

      <SystemStatusPanel />

      {/* Safety status hero */}
      <div className={`glass-strong relative mt-6 overflow-hidden rounded-3xl p-5 ${activeAlert ? "border border-primary/50" : ""}`}>
        <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl ${activeAlert ? "bg-primary/30 animate-pulse" : "bg-success/15"}`} />
        <div className="relative">
          {activeAlert ? (
            <StatusBadge variant="danger" pulse>Emergency active</StatusBadge>
          ) : (
            <StatusBadge variant="safe" pulse>You are safe</StatusBadge>
          )}
          {showSkeleton ? (
            <div className="mt-4 flex items-center gap-3">
              <Skeleton className="h-16 w-16 rounded-full" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
          ) : (
          <div className="mt-4 flex items-end gap-2">
            {activeAlert ? (
              <>
                <span className="font-display text-3xl font-bold capitalize text-primary">{activeAlert.type} alert</span>
                <span className="mb-1 text-xs text-muted-foreground">since {new Date(activeAlert.started_at).toLocaleTimeString()}</span>
              </>
            ) : (
              <>
                <span className="font-display text-5xl font-bold text-gradient-cyan">{profile?.safety_score ?? 85}</span>
                <span className="mb-2 text-xs text-muted-foreground">/ 100 Safety Score</span>
              </>
            )}
          </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} ·{" "}
            {status === "live"
              ? "live"
              : status === "requesting"
              ? "locating…"
              : status === "denied"
              ? "last known location"
              : "last known location"}
            {activeZone && !activeAlert && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                <Leaf className="h-3 w-3" /> Low power · {activeZone.name}
              </span>
            )}
          </div>
          {activeAlert && (
            <Link to="/app/sos" className="mt-4 block w-full rounded-2xl bg-primary py-3 text-center text-sm font-semibold text-primary-foreground">
              Open emergency · Cancel
            </Link>
          )}
        </div>
      </div>

      {/* Quick stats */}
      {showSkeleton ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl p-4">
              <Skeleton className="mb-2 h-5 w-5 rounded" />
              <SkeletonBadge className="h-6 w-12" />
              <Skeleton className="mt-2 h-2.5 w-16" />
            </div>
          ))}
        </div>
      ) : (
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4">
          <Bell className="mb-2 h-5 w-5 text-primary" />
          <p className="font-display text-2xl font-bold">{monthAlertCount}</p>
          <p className="text-[11px] text-muted-foreground">Alerts this month</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <Leaf className="mb-2 h-5 w-5 text-accent" />
          <p className="text-sm font-semibold">{activeZone ? activeZone.name : "Outside zones"}</p>
          <p className="text-[11px] text-muted-foreground">Safe zone status</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <Bluetooth className="mb-2 h-5 w-5 text-accent" />
          <p className="font-display text-2xl font-bold">{deviceBattery != null ? `${deviceBattery}%` : "—"}</p>
          <p className="text-[11px] text-muted-foreground">Device battery</p>
        </div>
      </div>
      )}


      {/* Device row */}
      {showSkeleton ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="glass rounded-2xl p-4">
              <Skeleton className="mb-2 h-5 w-5 rounded" />
              <SkeletonText lines={3} className="mt-2" />
            </div>
          ))}
        </div>
      ) : (
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/app/device" className="glass rounded-2xl p-4">
          <Bluetooth className="mb-2 h-5 w-5 text-accent" />
          <p className="text-xs text-muted-foreground">Pendant</p>
          <p className="text-sm font-semibold">{activeZone ? "In safe zone" : "Connected"}</p>
        </Link>
        <BatteryWidget userId={user?.id} isOwn lowPower={!!activeZone} />
      </div>
      )}

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
        {showSkeleton ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="glass flex items-center gap-3 rounded-2xl p-3">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-1.5 h-2.5 w-32" />
              </div>
              <SkeletonBadge />
            </div>
          ))
        ) : recentAlerts.length === 0 ? (
          <div className="glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
            No emergencies — stay safe out there.
          </div>
        ) : (
          recentAlerts.map((a) => (
            <div key={a.id} className="glass flex items-center gap-3 rounded-2xl p-3 fade-in-content">
              <Bell className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium capitalize">{a.type} alert</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(a.started_at).toLocaleString()}
                </p>
              </div>
              <StatusBadge variant={a.status === "active" ? "danger" : "muted"}>{a.status}</StatusBadge>
            </div>
          ))
        )}
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
