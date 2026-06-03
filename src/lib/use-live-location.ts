import { useEffect, useRef, useState } from "react";
import { getMockLocation } from "@/lib/mock-location";
import { markLocationUpdate } from "@/lib/location-tracker";

const LS_KEY = "rakshalink_last_location";

function loadLastKnown(): LiveLocation | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return parsed as LiveLocation;
  } catch { /* ignore */ }
  return null;
}

function saveLastKnown(loc: LiveLocation) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ lat: loc.lat, lng: loc.lng }));
  } catch { /* ignore */ }
}

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
 * - If denied / unavailable, falls back to the last known location stored
 *   in localStorage. If no last known location exists, uses a simulated
 *   mock location so the rest of the UI keeps working.
 */
export function useLiveLocation(): { loc: LiveLocation; status: LiveLocationStatus } {
  const lastKnown = loadLastKnown();
  const [loc, setLoc] = useState<LiveLocation>(() => lastKnown ?? getMockLocation());
  const [status, setStatus] = useState<LiveLocationStatus>("idle");
  const fallbackTimer = useRef<number | null>(null);

  useEffect(() => {
    const startFallback = (next: LiveLocationStatus) => {
      setStatus(next);
      if (fallbackTimer.current != null) return;
      const saved = loadLastKnown();
      if (saved) setLoc(saved);
      fallbackTimer.current = window.setInterval(() => {
        const s = loadLastKnown();
        setLoc(s ?? getMockLocation());
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
          const newLoc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          saveLastKnown(newLoc);
          setStatus("live");
          setLoc(newLoc);
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

