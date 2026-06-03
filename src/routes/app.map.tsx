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
import { useSystemStatus } from "@/lib/system-status";

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

  // Fetch real nearby hospitals, police + pharmacies around the live location.
  // Only runs once the user taps "Nearby Help"; refetches when we move > ~500m.
  const fetchNearby = (lat: number, lng: number) => {
    setLoadingNearby(true);
    getNearbyPlaces({ data: { lat, lng, radius: 5000 } })
      .then((res) => setNearby(res.places))
      .catch((err) => console.error("nearby places failed", err))
      .finally(() => setLoadingNearby(false));
  };

  useEffect(() => {
    if (!nearbyEnabled || status !== "live") return;
    const key = `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}`;
    if (key === lastFetchKeyRef.current) return;
    lastFetchKeyRef.current = key;
    fetchNearby(loc.lat, loc.lng);
  }, [loc, status, nearbyEnabled]);

  const handleNearbyHelp = () => {
    setNearbyEnabled(true);
    lastFetchKeyRef.current = `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}`;
    fetchNearby(loc.lat, loc.lng);
  };

  const sortedNearby = useMemo(() => {
    return [...nearby]
      .filter((n) =>
        n.type === "police" ? showPolice : n.type === "hospital" ? showHospitals : showPharmacies,
      )
      .map((n) => ({ ...n, dist: distanceMeters(loc, { lat: n.lat, lng: n.lng }) }))
      .sort((a, b) => a.dist - b.dist);
  }, [nearby, loc, showPolice, showHospitals, showPharmacies]);

  const colorFor = (t: NearbyPlace["type"]) =>
    t === "police"
      ? "oklch(0.78 0.17 75)"
      : t === "hospital"
      ? "oklch(0.62 0.24 25)"
      : "oklch(0.72 0.18 155)";

  const markers = [
    { id: "me", lat: loc.lat, lng: loc.lng, label: "You", color: "oklch(0.78 0.14 200)" },
    ...sortedNearby.map((n) => {
      const distLabel =
        n.dist < 1000 ? `${Math.round(n.dist)} m away` : `${(n.dist / 1000).toFixed(1)} km away`;
      const typeLabel =
        n.type === "police" ? "Police" : n.type === "hospital" ? "Hospital" : "Pharmacy";
      const openLabel =
        n.openNow == null
          ? ""
          : n.openNow
          ? `<span style="color:#22c55e;font-weight:600">Open now</span>`
          : `<span style="color:#ef4444;font-weight:600">Closed</span>`;
      const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${n.lat},${n.lng}&destination_place_id=${encodeURIComponent(n.id)}`;
      const popupHtml = `<div style="min-width:170px;font-family:inherit">
        <div style="font-weight:700;font-size:13px;margin-bottom:2px">${n.name}</div>
        <div style="font-size:11px;color:#888">${typeLabel} · ${distLabel}</div>
        ${openLabel ? `<div style="font-size:11px;margin-top:2px">${openLabel}</div>` : ""}
        <a href="${dirUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:5px 10px;border-radius:8px;background:#2563eb;color:#fff;font-size:11px;font-weight:600;text-decoration:none">Get Directions</a>
      </div>`;
      return {
        id: n.id,
        lat: n.lat,
        lng: n.lng,
        label: n.name,
        color: colorFor(n.type),
        popupHtml,
      };
    }),
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
          ? "location permission denied — showing last known location"
          : status === "unavailable" || status === "fallback"
          ? "GPS unavailable — showing last known location"
          : status === "requesting"
          ? "getting your location…"
          : lowPower ? `in "${activeZone?.name}" — saving battery` : "live GPS"}
      </p>

      {(status === "denied" || status === "unavailable" || status === "fallback") && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <MapPinOff className="h-5 w-5 shrink-0 text-warning" />
          <div className="text-xs">
            <p className="font-semibold text-warning">GPS signal unavailable</p>
            <p className="mt-1 text-muted-foreground">
              {status === "denied"
                ? "Location permission was denied. We are displaying your last known location from this device. Enable location access in your browser settings for live tracking."
                : "We can't access your live GPS right now. Showing the last known location saved on this device."}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-3xl border border-border">
        <MapView center={[loc.lat, loc.lng]} markers={markers} zones={zones} path={showTrail ? path : []} height={420} />
      </div>

      <button
        onClick={handleNearbyHelp}
        disabled={loadingNearby}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-60"
      >
        <LifeBuoy className="h-4 w-4" />
        {loadingNearby ? "Finding help nearby…" : "Nearby Help"}
      </button>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Toggle active={showHospitals} onClick={() => setShowHospitals((v: boolean) => !v)} icon={Hospital} label="Hospitals" />
        <Toggle active={showPolice} onClick={() => setShowPolice((v: boolean) => !v)} icon={ShieldIcon} label="Police" />
        <Toggle active={showPharmacies} onClick={() => setShowPharmacies((v: boolean) => !v)} icon={Pill} label="Pharmacies" />
        <Toggle active={showTrail} onClick={() => setShowTrail((v) => !v)} icon={Navigation} label="Trail" />
      </div>

      <div className="glass mt-4 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nearby</p>
          {loadingNearby && <span className="text-[10px] text-muted-foreground">searching…</span>}
        </div>
        <div className="mt-2 space-y-2">
          {!nearbyEnabled && !loadingNearby && (
            <p className="text-xs text-muted-foreground">
              Tap “Nearby Help” to find hospitals, police and pharmacies around you.
            </p>
          )}
          {nearbyEnabled && sortedNearby.length === 0 && !loadingNearby && (
            <p className="text-xs text-muted-foreground">
              {status === "live"
                ? "No nearby help found within 5 km."
                : "Waiting for your location…"}
            </p>
          )}
          {sortedNearby.slice(0, 8).map((n) => (
            <div key={n.id} className="flex items-center gap-3">
              {n.type === "police" ? (
                <ShieldIcon className="h-4 w-4 text-warning" />
              ) : n.type === "hospital" ? (
                <Hospital className="h-4 w-4 text-destructive" />
              ) : (
                <Pill className="h-4 w-4 text-success" />
              )}
              <span className="flex-1 truncate text-sm">{n.name}</span>
              {n.openNow != null && (
                <span className={`shrink-0 text-[10px] font-medium ${n.openNow ? "text-success" : "text-destructive"}`}>
                  {n.openNow ? "Open" : "Closed"}
                </span>
              )}
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
