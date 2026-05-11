import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Home, School, Briefcase, MapPin, Trash2 } from "lucide-react";
import { getMockLocation } from "@/lib/mock-location";
import { toast } from "sonner";

export const Route = createFileRoute("/app/zones")({
  component: ZonesPage,
});

type Zone = { id: string; name: string; type: string; lat: number; lng: number; radius_m: number };

function ZonesPage() {
  const { user } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", type: "home" as Zone["type"], radius_m: 200 });

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("safe_zones").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setZones((data as any) ?? []);
  }
  useEffect(() => {
    load();
  }, [user]);

  async function add() {
    if (!user || !form.name) return;
    const loc = getMockLocation();
    const { error } = await supabase.from("safe_zones").insert({
      user_id: user.id,
      name: form.name,
      type: form.type as any,
      lat: loc.lat,
      lng: loc.lng,
      radius_m: form.radius_m,
    });
    if (error) return toast.error(error.message);
    setAdding(false);
    setForm({ name: "", type: "home", radius_m: 200 });
    toast.success("Safe zone added");
    load();
  }

  async function remove(id: string) {
    await supabase.from("safe_zones").delete().eq("id", id);
    load();
  }

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Safe zones</h1>
        <button
          onClick={() => setAdding(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Get notified when entering or leaving these areas.</p>

      <div className="mt-6 space-y-2">
        {zones.length === 0 && !adding && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No safe zones yet. Add Home, School, or Work to get smart alerts.
          </div>
        )}
        {zones.map((z) => {
          const Icon = z.type === "home" ? Home : z.type === "school" ? School : z.type === "work" ? Briefcase : MapPin;
          return (
            <div key={z.id} className="glass flex items-center gap-3 rounded-2xl p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{z.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {z.lat.toFixed(3)}, {z.lng.toFixed(3)} · {z.radius_m}m
                </p>
              </div>
              <button onClick={() => remove(z.id)} className="text-muted-foreground hover:text-primary">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {adding && (
        <div className="glass-strong mt-4 space-y-3 rounded-2xl p-4">
          <input
            placeholder="Zone name (e.g. School)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm outline-none"
          />
          <div className="grid grid-cols-4 gap-2">
            {(["home", "school", "work", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className={`rounded-xl py-2 text-[11px] capitalize ${form.type === t ? "bg-accent text-accent-foreground" : "bg-background/40"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Radius: {form.radius_m}m</label>
            <input
              type="range"
              min={50}
              max={1000}
              step={50}
              value={form.radius_m}
              onChange={(e) => setForm({ ...form, radius_m: +e.target.value })}
              className="w-full accent-accent"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Uses your current location as the zone center.</p>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm">
              Cancel
            </button>
            <button onClick={add} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground">
              Add zone
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
