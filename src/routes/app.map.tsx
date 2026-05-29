import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "@/components/MapView";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Navigation, Hospital, Shield as ShieldIcon, Leaf, MapPinOff, Pill, LifeBuoy } from "lucide-react";
import { useSafeZones, findContainingZone } from "@/lib/safe-zone";
import { useLiveLocation } from "@/lib/use-live-location";
import { distanceMeters } from "@/lib/safe-zone";
import { getNearbyPlaces, type NearbyPlace } from "@/lib/places.functions";
import { usePreferences } from "@/lib/preferences";

export const Route = createFileRoute("/app/map")({
  component: MapPage,
});

function MapPage() {
  const { user } = useAuth();
  const { loc, status } = useLiveLocation();
  const { prefs } = usePreferences();
  const [path, setPath] = useState<[number, number][]>([]);
  const [showTrail, setShowTrail] = useState(true);
  const zones = useSafeZones(user?.id);
  const [showHospitals, setShowHospitals] = useState(true);
  const [showPolice, setShowPolice] = useState(true);
  const [showPharmacies, setShowPharmacies] = useState(true);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const lastWriteRef = useRef(0);
  const lastFetchKeyRef = useRef<string>("");

  const activeZone = useMemo(() => findContainingZone(loc, zones), [loc, zones]);
  const lowPower = !!activeZone;

  useEffect(() => {
    if (status !== "live") return;
    setPath((p) => {
      const last = p[p.length - 1];
      if (last && last[0] === loc.lat && last[1] === loc.lng) return p;
      return [...p.slice(-9), [loc.lat, loc.lng]];
    });
    if (!user || !prefs.shareLocation) return;
    const interval = activeZone ? 30000 : 10000;
    const now = Date.now();
    if (now - lastWriteRef.current > interval) {
      lastWriteRef.current = now;
      supabase.from("live_locations").insert({ user_id: user.id, lat: loc.lat, lng: loc.lng }).then(() => {});
    }
  }, [user, loc, activeZone, status, prefs.shareLocation]);

  // Fetch real nearby police + hospitals around the live location.
  // Only refetch when we move > ~500m to avoid hammering the API.
  useEffect(() => {
    if (status !== "live") return;
    const key = `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}`;
    if (key === lastFetchKeyRef.current) return;
    lastFetchKeyRef.current = key;
    setLoadingNearby(true);
    getNearbyPlaces({ data: { lat: loc.lat, lng: loc.lng, radius: 5000 } })
      .then((res) => setNearby(res.places))
      .catch((err) => console.error("nearby places failed", err))
      .finally(() => setLoadingNearby(false));
  }, [loc, status]);

  const sortedNearby = useMemo(() => {
    return [...nearby]
      .filter((n) => (n.type === "police" ? showPolice : showHospitals))
      .map((n) => ({ ...n, dist: distanceMeters(loc, { lat: n.lat, lng: n.lng }) }))
      .sort((a, b) => a.dist - b.dist);
  }, [nearby, loc, showPolice, showHospitals]);

  const markers = [
    { id: "me", lat: loc.lat, lng: loc.lng, label: "You", color: "oklch(0.78 0.14 200)" },
    ...sortedNearby.map((n) => ({
      id: n.id,
      lat: n.lat,
      lng: n.lng,
      label: n.name,
      color: n.type === "police" ? "oklch(0.78 0.17 75)" : "oklch(0.72 0.18 155)",
    })),
  ];

  return (
    <div className="px-5 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Live tracking</h1>
        {lowPower ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-accent">
            <Leaf className="h-3 w-3" /> Low power
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} ·{" "}
        {status === "denied"
          ? "location permission denied — showing demo"
          : status === "unavailable" || status === "fallback"
          ? "GPS unavailable — showing demo"
          : status === "requesting"
          ? "getting your location…"
          : lowPower ? `in "${activeZone?.name}" — saving battery` : "live GPS"}
      </p>

      {status === "denied" && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <MapPinOff className="h-5 w-5 shrink-0 text-primary" />
          <div className="text-xs">
            <p className="font-semibold text-primary">Location permission denied</p>
            <p className="mt-1 text-muted-foreground">
              RakshaLink needs your location to share live position with guardians, trigger SOS with accurate coordinates, and detect safe zones. Enable location access in your browser settings and reload this page.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-3xl border border-border">
        <MapView center={[loc.lat, loc.lng]} markers={markers} zones={zones} path={showTrail ? path : []} height={420} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Toggle active={showHospitals} onClick={() => setShowHospitals((v: boolean) => !v)} icon={Hospital} label="Hospitals" />
        <Toggle active={showPolice} onClick={() => setShowPolice((v: boolean) => !v)} icon={ShieldIcon} label="Police" />
        <Toggle active={showTrail} onClick={() => setShowTrail((v) => !v)} icon={Navigation} label="Trail" />
      </div>

      <div className="glass mt-4 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nearby</p>
          {loadingNearby && <span className="text-[10px] text-muted-foreground">searching…</span>}
        </div>
        <div className="mt-2 space-y-2">
          {sortedNearby.length === 0 && !loadingNearby && (
            <p className="text-xs text-muted-foreground">
              {status === "live"
                ? "No nearby police or hospitals found within 5 km."
                : "Waiting for your location…"}
            </p>
          )}
          {sortedNearby.slice(0, 6).map((n) => (
            <div key={n.id} className="flex items-center gap-3">
              {n.type === "police" ? (
                <ShieldIcon className="h-4 w-4 text-warning" />
              ) : (
                <Hospital className="h-4 w-4 text-success" />
              )}
              <span className="flex-1 truncate text-sm">{n.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {n.dist < 1000 ? `${Math.round(n.dist)} m` : `${(n.dist / 1000).toFixed(1)} km`}
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
