import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Home, School, Briefcase, MapPin, Trash2, Pencil, Crosshair } from "lucide-react";
import { getMockLocation } from "@/lib/mock-location";

function getCurrentPositionAsync(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
import { toast } from "sonner";
import { MapView } from "@/components/MapView";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

type ZoneType = "home" | "school" | "work" | "custom";
type Zone = { id: string; name: string; type: ZoneType; lat: number; lng: number; radius_m: number };
type Editor = {
  id: string | null;
  name: string;
  type: ZoneType;
  lat: number;
  lng: number;
  radius_m: number;
};

const TYPE_ICONS: Record<ZoneType, typeof Home> = {
  home: Home,
  school: School,
  work: Briefcase,
  custom: MapPin,
};

export function ZonesManager({
  targetUserId,
  title = "Safe zones",
  subtitle = "Areas where the pendant switches to low-power mode.",
}: {
  targetUserId: string | undefined;
  title?: string;
  subtitle?: string;
}) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!targetUserId) return;
    const { data } = await supabase
      .from("safe_zones")
      .select("id,name,type,lat,lng,radius_m")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });
    setZones((data as any) ?? []);
  }
  useEffect(() => {
    load();
  }, [targetUserId]);

  function startAdd() {
    const loc = getMockLocation();
    setEditor({ id: null, name: "", type: "home", lat: loc.lat, lng: loc.lng, radius_m: 200 });
  }
  function startEdit(z: Zone) {
    setEditor({ id: z.id, name: z.name, type: z.type, lat: z.lat, lng: z.lng, radius_m: z.radius_m });
  }
  function recenter() {
    if (!editor) return;
    const loc = getMockLocation();
    setEditor({ ...editor, lat: loc.lat, lng: loc.lng });
  }

  async function save() {
    if (!targetUserId || !editor) return;
    if (!editor.name.trim()) return toast.error("Give the zone a name");
    setSaving(true);
    const payload = {
      user_id: targetUserId,
      name: editor.name.trim(),
      type: editor.type as any,
      lat: editor.lat,
      lng: editor.lng,
      radius_m: editor.radius_m,
    };
    const { error } = editor.id
      ? await supabase.from("safe_zones").update(payload).eq("id", editor.id)
      : await supabase.from("safe_zones").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editor.id ? "Zone updated" : "Safe zone added");
    setEditor(null);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("safe_zones").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Zone removed");
    load();
  }

  const mapZones = useMemo(
    () =>
      editor
        ? [{ id: "preview", lat: editor.lat, lng: editor.lng, radius_m: editor.radius_m, name: editor.name || "New zone" }]
        : [],
    [editor],
  );
  const mapMarkers = useMemo(
    () => (editor ? [{ id: "center", lat: editor.lat, lng: editor.lng, label: "Zone center" }] : []),
    [editor],
  );

  return (
    <div className="px-5 pt-8 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {!editor && (
          <button
            onClick={startAdd}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground"
            aria-label="Add safe zone"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

      {editor ? (
        <div className="mt-5 space-y-4">
          <div className="glass overflow-hidden rounded-2xl">
            <MapView
              center={[editor.lat, editor.lng]}
              zones={mapZones}
              markers={mapMarkers}
              height={260}
            />
          </div>

          <div className="glass-strong space-y-4 rounded-2xl p-4">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Name</label>
              <Input
                placeholder="e.g. Home, School"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                className="mt-1 rounded-xl bg-background/40"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Type</label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {(Object.keys(TYPE_ICONS) as ZoneType[]).map((t) => {
                  const Icon = TYPE_ICONS[t];
                  const active = editor.type === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setEditor({ ...editor, type: t })}
                      className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] capitalize transition ${
                        active ? "bg-accent text-accent-foreground" : "bg-background/40 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Radius</label>
                <span className="text-xs font-semibold text-accent">{editor.radius_m} m</span>
              </div>
              <Slider
                min={50}
                max={1000}
                step={10}
                value={[editor.radius_m]}
                onValueChange={(v) => setEditor({ ...editor, radius_m: v[0] })}
                className="mt-3"
              />
            </div>

            <button
              onClick={recenter}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/40 py-2.5 text-xs font-medium"
            >
              <Crosshair className="h-3.5 w-3.5" />
              Use current location as center
            </button>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditor(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {saving ? "Saving…" : editor.id ? "Save changes" : "Add zone"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {zones.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No safe zones yet. Add Home, School, or Work to get smart alerts.
            </div>
          )}
          {zones.map((z) => {
            const Icon = TYPE_ICONS[z.type] ?? MapPin;
            return (
              <div key={z.id} className="glass flex items-center gap-3 rounded-2xl p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold">{z.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {z.lat.toFixed(3)}, {z.lng.toFixed(3)} · {z.radius_m}m
                  </p>
                </div>
                <button
                  onClick={() => startEdit(z)}
                  className="text-muted-foreground hover:text-accent"
                  aria-label="Edit zone"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(z.id)}
                  className="text-muted-foreground hover:text-primary"
                  aria-label="Delete zone"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
