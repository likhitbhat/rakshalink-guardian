import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Users, Plus, MapPin, Bell, ShieldCheck, Settings2 } from "lucide-react";
import { BatteryWidget } from "@/components/BatteryWidget";
import { findContainingZone, type SafeZone } from "@/lib/safe-zone";
import { toast } from "sonner";

export const Route = createFileRoute("/guardian/")({
  component: GuardianHome,
});

type Link = { id: string; user_id: string; label: string | null; status: string };
type Profile = { id: string; full_name: string | null; safety_score: number };
type LocPoint = { lat: number; lng: number };

function GuardianHome() {
  const { user, profile } = useAuth();
  const [links, setLinks] = useState<Link[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [activeAlerts, setActiveAlerts] = useState<Record<string, boolean>>({});
  const [zonesByUser, setZonesByUser] = useState<Record<string, SafeZone[]>>({});
  const [lastLocByUser, setLastLocByUser] = useState<Record<string, LocPoint>>({});
  const [adding, setAdding] = useState(false);
  const [linkUserId, setLinkUserId] = useState("");

  async function load() {
    if (!user) return;
    const { data: l } = await supabase
      .from("guardian_links")
      .select("*")
      .eq("guardian_id", user.id)
      .eq("status", "active");
    const links = (l as Link[]) ?? [];
    setLinks(links);
    if (links.length) {
      const ids = links.map((x) => x.user_id);
      const { data: ps } = await supabase.from("profiles").select("id, full_name, safety_score").in("id", ids);
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
      const { data: alerts } = await supabase
        .from("emergency_alerts")
        .select("user_id, status")
        .in("user_id", ids)
        .eq("status", "active");
      const m: Record<string, boolean> = {};
      (alerts ?? []).forEach((a: any) => (m[a.user_id] = true));
      setActiveAlerts(m);

      const { data: zs } = await supabase
        .from("safe_zones")
        .select("id, name, lat, lng, radius_m, user_id")
        .in("user_id", ids);
      const zmap: Record<string, SafeZone[]> = {};
      (zs ?? []).forEach((z: any) => {
        (zmap[z.user_id] ||= []).push(z);
      });
      setZonesByUser(zmap);

      const { data: locs } = await supabase
        .from("live_locations")
        .select("user_id, lat, lng, recorded_at")
        .in("user_id", ids)
        .order("recorded_at", { ascending: false });
      const lmap: Record<string, LocPoint> = {};
      (locs ?? []).forEach((l: any) => {
        if (!lmap[l.user_id]) lmap[l.user_id] = { lat: l.lat, lng: l.lng };
      });
      setLastLocByUser(lmap);
    }
  }

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("guardian-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_alerts" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_locations" }, (payload) => {
        const row: any = payload.new;
        setLastLocByUser((m) => ({ ...m, [row.user_id]: { lat: row.lat, lng: row.lng } }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "safe_zones" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "zone_events" }, (payload) => {
        const row: any = payload.new;
        // Only notify for users this guardian watches.
        setProfiles((cur) => {
          const p = cur[row.user_id];
          if (!p) return cur;
          const who = p.full_name ?? "Wearer";
          if (row.event === "enter") {
            toast.success(`${who} entered ${row.zone_name}`, {
              description: "Pendant switched to low-power mode.",
            });
          } else {
            toast.warning(`${who} left ${row.zone_name}`, {
              description: "Live tracking resumed.",
            });
          }
          return cur;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  async function addLink() {
    if (!user || !linkUserId) return;
    const { error } = await supabase.from("guardian_links").insert({
      guardian_id: user.id,
      user_id: linkUserId.trim(),
      status: "active",
    });
    if (error) return toast.error(error.message);
    setLinkUserId("");
    setAdding(false);
    toast.success("User linked");
    load();
  }

  return (
    <div className="px-5 pt-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Guardian</p>
          <h1 className="mt-1 text-2xl font-bold">{profile?.full_name ?? "You"}</h1>
        </div>
        <button onClick={() => setAdding(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="glass-strong mt-6 rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-accent" />
          <p className="text-sm font-semibold">Watching {links.length} {links.length === 1 ? "person" : "people"}</p>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="font-display text-3xl font-bold text-success">All safe</span>
          <StatusBadge variant="safe" pulse>Live</StatusBadge>
        </div>
      </div>

      {adding && (
        <div className="glass-strong mt-4 space-y-2 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Paste the user's account ID (they can find it in Settings).</p>
          <input
            placeholder="User ID (uuid)"
            value={linkUserId}
            onChange={(e) => setLinkUserId(e.target.value)}
            className="w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm outline-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm">Cancel</button>
            <button onClick={addLink} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground">Link</button>
          </div>
        </div>
      )}

      <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monitored</h2>
      <div className="space-y-2">
        {links.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No one linked yet. Tap + to add a user you protect.
          </div>
        )}
        {links.map((l) => {
          const p = profiles[l.user_id];
          const danger = activeAlerts[l.user_id];
          const loc = lastLocByUser[l.user_id] ?? null;
          const zones = zonesByUser[l.user_id] ?? [];
          const activeZone = findContainingZone(loc, zones);
          return (
            <div key={l.id} className={`glass rounded-2xl p-4 ${danger ? "border-primary/60 bg-primary/10" : ""}`}>
              <Link to="/guardian/map" className="block">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-primary/30 font-display font-bold">
                    {(p?.full_name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{p?.full_name ?? "User"}</p>
                    <p className="text-[11px] text-muted-foreground">{l.label ?? "Family"}</p>
                  </div>
                  {danger ? (
                    <StatusBadge variant="danger" pulse>SOS</StatusBadge>
                  ) : activeZone ? (
                    <StatusBadge variant="safe">Low power</StatusBadge>
                  ) : (
                    <StatusBadge variant="safe">Safe</StatusBadge>
                  )}
                </div>
              </Link>
              {activeZone && !danger && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-[11px] text-accent">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="truncate">
                    In safe zone · <span className="font-semibold">{activeZone.name}</span> — pendant in low-power mode
                  </span>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pendant</span>
                <BatteryWidget userId={l.user_id} compact />
              </div>
              <Link
                to="/guardian/zones/$userId"
                params={{ userId: l.user_id }}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/30 py-2 text-[11px] font-medium text-muted-foreground hover:text-accent"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Manage safe zones
              </Link>
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/guardian/map" className="glass rounded-2xl p-4">
          <MapPin className="mb-2 h-5 w-5 text-accent" />
          <p className="text-sm font-semibold">Live map</p>
        </Link>
        <Link to="/guardian/alerts" className="glass rounded-2xl p-4">
          <Bell className="mb-2 h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">Alerts feed</p>
        </Link>
      </div>

      {user && (
        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          Your guardian ID: <code className="text-accent">{user.id}</code>
        </p>
      )}
    </div>
  );
}
