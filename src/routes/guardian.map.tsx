import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { MapView } from "@/components/MapView";
import { getMockLocation } from "@/lib/mock-location";

export const Route = createFileRoute("/guardian/map")({
  component: GuardianMap,
});

function GuardianMap() {
  const { user } = useAuth();
  const [users, setUsers] = useState<{ id: string; name: string; lat: number; lng: number; emergency: boolean }[]>([]);
  const [center, setCenter] = useState<[number, number]>([12.9716, 77.5946]);

  async function load() {
    if (!user) return;
    const { data: links } = await supabase.from("guardian_links").select("user_id").eq("guardian_id", user.id).eq("status", "active");
    const ids = (links ?? []).map((l: any) => l.user_id);
    if (!ids.length) {
      setUsers([]);
      return;
    }
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const { data: alerts } = await supabase.from("emergency_alerts").select("user_id").in("user_id", ids).eq("status", "active");
    const danger = new Set((alerts ?? []).map((a: any) => a.user_id));

    // get latest location per user (or mock)
    const list: typeof users = [];
    for (const id of ids) {
      const { data: locs } = await supabase
        .from("live_locations")
        .select("lat, lng")
        .eq("user_id", id)
        .order("recorded_at", { ascending: false })
        .limit(1);
      const p = (profiles ?? []).find((x: any) => x.id === id);
      const loc = locs?.[0] ?? getMockLocation(0);
      list.push({ id, name: p?.full_name ?? "User", lat: loc.lat, lng: loc.lng, emergency: danger.has(id) });
    }
    setUsers(list);
    if (list[0]) setCenter([list[0].lat, list[0].lng]);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 6000);
    // Realtime: update positions instantly when wearers write new rows.
    const ch = supabase
      .channel("guardian-locs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_locations" },
        (payload: any) => {
          const row = payload.new;
          setUsers((prev) =>
            prev.map((u) => (u.id === row.user_id ? { ...u, lat: row.lat, lng: row.lng } : u)),
          );
        },
      )
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [user]);

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-2xl font-bold">Live map</h1>
      <p className="mt-1 text-sm text-muted-foreground">Real-time positions of everyone you protect.</p>

      <div className="mt-4 overflow-hidden rounded-3xl border border-border">
        <MapView
          center={center}
          markers={users.map((u) => ({ id: u.id, lat: u.lat, lng: u.lng, label: u.name, emergency: u.emergency }))}
          height={420}
        />
      </div>

      <div className="mt-4 space-y-2">
        {users.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No linked users yet.
          </div>
        )}
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => setCenter([u.lat, u.lng])}
            className={`glass flex w-full items-center gap-3 rounded-2xl p-3 text-left ${u.emergency ? "border-primary/60 bg-primary/10" : ""}`}
          >
            <span className={`h-2 w-2 rounded-full ${u.emergency ? "bg-primary animate-pulse" : "bg-success"}`} />
            <span className="flex-1 text-sm font-medium">{u.name}</span>
            <span className="text-[11px] text-muted-foreground">{u.lat.toFixed(3)}, {u.lng.toFixed(3)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
