import { useEffect, useRef, useState } from "react";
import { getMockLocation } from "@/lib/mock-location";

export type LiveLocation = { lat: number; lng: number; accuracy?: number };

export type LiveLocationStatus =
  | "idle"
  | "requesting"
  | "live"
  | "denied"
  | "unavailable"
  | "fallback";

/**
 * Tracks the device's real GPS position via the Geolocation API.
 *
 * - Asks the browser for permission on mount.
 * - If granted, streams real coordinates via watchPosition.
 * - If denied / unavailable / running outside a secure context, falls back
 *   to the simulated mock location so the rest of the UI keeps working.
 */
export function useLiveLocation(): { loc: LiveLocation; status: LiveLocationStatus } {
  const [loc, setLoc] = useState<LiveLocation>(() => getMockLocation());
  const [status, setStatus] = useState<LiveLocationStatus>("idle");
  const fallbackTimer = useRef<number | null>(null);

  useEffect(() => {
    const startFallback = (next: LiveLocationStatus) => {
      setStatus(next);
      if (fallbackTimer.current != null) return;
      fallbackTimer.current = window.setInterval(() => {
        setLoc(getMockLocation());
      }, 3000) as unknown as number;
    };

    const stopFallback = () => {
      if (fallbackTimer.current != null) {
        clearInterval(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      startFallback("unavailable");
      return () => stopFallback();
    }

    setStatus("requesting");
    let watchId: number | null = null;

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          stopFallback();
          setStatus("live");
          setLoc({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) startFallback("denied");
          else startFallback("fallback");
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      );
    } catch {
      startFallback("unavailable");
    }

    return () => {
      if (watchId != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      stopFallback();
    };
  }, []);

  return { loc, status };
}
