import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import { getMockLocation, NEARBY } from "@/lib/mock-location";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Navigation, Hospital, Shield as ShieldIcon, Leaf } from "lucide-react";
import { useSafeZones, findContainingZone } from "@/lib/safe-zone";

export const Route = createFileRoute("/app/map")({
  component: MapPage,
});

function MapPage() {
  const { user } = useAuth();
  const [loc, setLoc] = useState(getMockLocation());
  const [path, setPath] = useState<[number, number][]>([]);
  const zones = useSafeZones(user?.id);
  const [showNearby, setShowNearby] = useState(true);

  const activeZone = useMemo(() => findContainingZone(loc, zones), [loc, zones]);
  const lowPower = !!activeZone;

  useEffect(() => {
    let lastWrite = 0;
    const t = setInterval(() => {
      const l = getMockLocation();
      setLoc(l);
      setPath((p) => [...p.slice(-30), [l.lat, l.lng]]);
      // In a safe zone, the pendant goes into low-power mode: slow writes to ~30s.
      // Outside any zone, write every ~10s for responsive guardian tracking.
      const interval = findContainingZone(l, zones) ? 30000 : 10000;
      const now = Date.now();
      if (user && now - lastWrite > interval) {
        lastWrite = now;
        supabase.from("live_locations").insert({ user_id: user.id, lat: l.lat, lng: l.lng }).then(() => {});
      }
    }, 3000);
    return () => clearInterval(t);
  }, [user, zones]);

  const markers = [
    { id: "me", lat: loc.lat, lng: loc.lng, label: "You", color: "oklch(0.78 0.14 200)" },
    ...(showNearby
      ? NEARBY.map((n) => ({
          id: n.id,
          lat: n.lat,
          lng: n.lng,
          label: n.name,
          color: n.type === "police" ? "oklch(0.78 0.17 75)" : "oklch(0.72 0.18 155)",
        }))
      : []),
  ];

  return (
    <div className="px-5 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Live tracking</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · updated every 3s
      </p>

      <div className="mt-4 overflow-hidden rounded-3xl border border-border">
        <MapView center={[loc.lat, loc.lng]} markers={markers} zones={zones} path={path} height={420} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Toggle active={showNearby} onClick={() => setShowNearby((v) => !v)} icon={Hospital} label="Hospitals" />
        <Toggle active={showNearby} onClick={() => setShowNearby((v) => !v)} icon={ShieldIcon} label="Police" />
        <Toggle active={path.length > 1} onClick={() => setPath([])} icon={Navigation} label="Trail" />
      </div>

      <div className="glass mt-4 rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nearby</p>
        <div className="mt-2 space-y-2">
          {NEARBY.slice(0, 3).map((n) => (
            <div key={n.id} className="flex items-center gap-3">
              {n.type === "police" ? (
                <ShieldIcon className="h-4 w-4 text-warning" />
              ) : (
                <Hospital className="h-4 w-4 text-success" />
              )}
              <span className="flex-1 text-sm">{n.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {(Math.abs(n.lat - loc.lat) * 111).toFixed(1)} km
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`glass flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium transition ${
        active ? "border-accent/40 text-accent" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
