import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SafeZone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  notify_enter?: boolean;
  notify_exit?: boolean;
};

// Haversine distance in meters
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function findContainingZone(
  loc: { lat: number; lng: number } | null,
  zones: SafeZone[],
): SafeZone | null {
  if (!loc) return null;
  for (const z of zones) {
    if (distanceMeters(loc, { lat: z.lat, lng: z.lng }) <= z.radius_m) return z;
  }
  return null;
}

/** Subscribe to the current user's safe zones (initial fetch + realtime). */
export function useSafeZones(userId: string | undefined) {
  const [zones, setZones] = useState<SafeZone[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("safe_zones")
      .select("id, name, lat, lng, radius_m")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!cancelled) setZones((data as any) ?? []);
      });
    const ch = supabase
      .channel(`safe-zones-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "safe_zones", filter: `user_id=eq.${userId}` },
        () => {
          supabase
            .from("safe_zones")
            .select("id, name, lat, lng, radius_m")
            .eq("user_id", userId)
            .then(({ data }) => setZones((data as any) ?? []));
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [userId]);
  return zones;
}
