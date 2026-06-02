import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, MapPin, ShieldCheck, Bell, Settings2, UserMinus, Battery, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { BatteryWidget } from "@/components/BatteryWidget";
import { findContainingZone, type SafeZone } from "@/lib/safe-zone";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/guardian/wearer/$userId")({
  component: WearerManagePage,
});

type Profile = { id: string; full_name: string | null; phone: string | null; safety_score: number; false_alarm_count: number };
type FalseAlarm = { id: string; started_at: string };

function WearerManagePage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [linkRow, setLinkRow] = useState<{ id: string; label: string | null } | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [alertsCount, setAlertsCount] = useState(0);
  const [falseAlarms, setFalseAlarms] = useState<FalseAlarm[]>([]);

  async function load() {
    if (!user) return;
    const [{ data: p }, { data: zs }, { data: locs }, { data: link }, { data: alerts }, { data: fa }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, safety_score, false_alarm_count").eq("id", userId).maybeSingle(),
      supabase.from("safe_zones").select("id, name, lat, lng, radius_m").eq("user_id", userId),
      supabase.from("live_locations").select("lat, lng").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(1),
      supabase.from("guardian_links").select("id, label").eq("guardian_id", user.id).eq("user_id", userId).maybeSingle(),
      supabase.from("emergency_alerts").select("id", { count: "exact", head: false }).eq("user_id", userId).eq("status", "active"),
      supabase.from("emergency_alerts").select("id, started_at").eq("user_id", userId).ilike("notes", "false_alarm%").order("started_at", { ascending: false }).limit(10),
    ]);
    setProfile((p as any) ?? null);
    setZones(((zs as any) ?? []) as SafeZone[]);
    setLoc(locs?.[0] ? { lat: (locs[0] as any).lat, lng: (locs[0] as any).lng } : null);
    setLinkRow((link as any) ?? null);
    setLabelDraft(((link as any)?.label as string) ?? "");
    setAlertsCount((alerts as any[])?.length ?? 0);
    setFalseAlarms(((fa as any) ?? []) as FalseAlarm[]);
  }

  useEffect(() => {
    load();
  }, [userId, user?.id]);

  const activeZone = findContainingZone(loc, zones);
  const initial = (profile?.full_name?.[0] ?? "?").toUpperCase();

  async function saveLabel() {
    if (!linkRow) return;
    const { error } = await supabase.from("guardian_links").update({ label: labelDraft.trim() || null }).eq("id", linkRow.id);
    if (error) return toast.error(error.message);
    toast.success("Label updated");
    load();
  }

  async function unlink() {
    if (!linkRow) return;
    if (!confirm("Stop watching this wearer?")) return;
    const { error } = await supabase.from("guardian_links").delete().eq("id", linkRow.id);
    if (error) return toast.error(error.message);
    toast.success("Unlinked");
    navigate({ to: "/guardian" });
  }

  return (
    <div className="px-5 pt-6 pb-10">
      <Link to="/guardian" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent">
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <div className="glass-strong mt-4 rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-primary/30 font-display text-xl font-bold">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="truncate font-display text-xl font-bold">{profile?.full_name ?? "Wearer"}</h1>
            <p className="truncate text-xs text-muted-foreground">{profile?.phone ?? "No phone on file"}</p>
          </div>
          {alertsCount > 0 ? (
            <StatusBadge variant="danger" pulse>SOS</StatusBadge>
          ) : activeZone ? (
            <StatusBadge variant="safe">Low power</StatusBadge>
          ) : (
            <StatusBadge variant="safe">Safe</StatusBadge>
          )}
        </div>

        {activeZone && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-[11px] text-accent">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="truncate">In safe zone · <span className="font-semibold">{activeZone.name}</span></span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-background/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Safety score</p>
            <p className="mt-1 font-display text-lg font-bold">{profile?.safety_score ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-background/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Safe zones</p>
            <p className="mt-1 font-display text-lg font-bold">{zones.length}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-background/40 p-3 text-xs">
          <span className="flex items-center gap-2 text-muted-foreground"><Battery className="h-3.5 w-3.5" /> Pendant</span>
          <BatteryWidget userId={userId} compact />
        </div>
      </div>

      <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relationship</h2>
      <div className="glass-strong space-y-3 rounded-2xl p-4">
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Label</label>
        <div className="flex gap-2">
          <input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="e.g. Mom, Daughter"
            className="flex-1 rounded-xl bg-background/40 px-3 py-2.5 text-sm outline-none"
          />
          <button onClick={saveLabel} className="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground">
            Save
          </button>
        </div>
      </div>

      <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manage</h2>
      <div className="space-y-2">
        <Link
          to="/guardian/zones/$userId"
          params={{ userId }}
          className="glass flex items-center gap-3 rounded-2xl p-4"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Settings2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Safe zones</p>
            <p className="text-[11px] text-muted-foreground">View, add or edit low-power zones</p>
          </div>
          <span className="text-xs text-muted-foreground">{zones.length}</span>
        </Link>

        <Link to="/guardian/map" className="glass flex items-center gap-3 rounded-2xl p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Live location</p>
            <p className="text-[11px] text-muted-foreground">Open the live map</p>
          </div>
        </Link>

        <Link to="/guardian/alerts" className="glass flex items-center gap-3 rounded-2xl p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Alert history</p>
            <p className="text-[11px] text-muted-foreground">Review SOS and zone events</p>
          </div>
        </Link>
      </div>

      <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">False alarm history</h2>
      <div className="glass-strong rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-primary" /> Reported false alarms
          </span>
          <span className="font-display text-lg font-bold">{profile?.false_alarm_count ?? 0}</span>
        </div>
        {falseAlarms.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {falseAlarms.map((fa) => (
              <li key={fa.id} className="flex items-center justify-between rounded-xl bg-background/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Marked false alarm</span>
                <span className="tabular-nums">{new Date(fa.started_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">No false alarms reported.</p>
        )}
      </div>

      <button
        onClick={unlink}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary"
      >
        <UserMinus className="h-4 w-4" />
        Stop watching this wearer
      </button>
    </div>
  );
}
