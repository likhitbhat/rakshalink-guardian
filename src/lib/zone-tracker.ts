import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveLocation } from "@/lib/use-live-location";
import { useSafeZones, findContainingZone, type SafeZone } from "@/lib/safe-zone";

/**
 * Tracks the wearer's safe-zone membership and inserts zone_events rows when
 * the user enters or exits a zone. Guardians subscribe to these events for
 * real-time notifications.
 *
 * Mount once near the top of the wearer app (e.g. in the /app layout).
 */
export function useZoneTransitionTracker(userId: string | undefined) {
  const zones = useSafeZones(userId);
  const zonesRef = useRef<SafeZone[]>([]);
  zonesRef.current = zones;
  const prevZoneId = useRef<string | null>(null);
  const prevZoneName = useRef<string>("");
  const hydrated = useRef(false);

  useEffect(() => {
    if (!userId) return;
    // hydrate previous zone from localStorage per user so we don't fire
    // duplicate events across navigation / reload.
    const key = `rl:lastZone:${userId}`;
    if (!hydrated.current) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const v = JSON.parse(raw) as { id: string | null; name: string };
          prevZoneId.current = v.id;
          prevZoneName.current = v.name ?? "";
        }
      } catch {}
      hydrated.current = true;
    }

    const tick = async () => {
      const loc = getMockLocation();
      const current = findContainingZone(loc, zonesRef.current);
      const currentId = current?.id ?? null;
      if (currentId === prevZoneId.current) return;

      // exit previous
      if (prevZoneId.current) {
        await supabase.from("zone_events").insert({
          user_id: userId,
          zone_id: prevZoneId.current,
          zone_name: prevZoneName.current || "Zone",
          event: "exit",
          lat: loc.lat,
          lng: loc.lng,
        });
      }
      // enter new
      if (current) {
        await supabase.from("zone_events").insert({
          user_id: userId,
          zone_id: current.id,
          zone_name: current.name,
          event: "enter",
          lat: loc.lat,
          lng: loc.lng,
        });
      }

      prevZoneId.current = currentId;
      prevZoneName.current = current?.name ?? "";
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ id: currentId, name: current?.name ?? "" }),
        );
      } catch {}
    };

    // Run once on mount, then poll. Polling keeps the wearer's pendant simulation honest.
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [userId]);
}
