import { cacheLastLocation, getCachedLastLocation } from "@/lib/offline";

/**
 * A detached location keeper that intentionally lives OUTSIDE the React tree.
 *
 * The normal background tracker (`useBackgroundLocationTracking`) is tied to
 * the authenticated app shell and is torn down on logout. For safety, we want
 * the device to keep refreshing its last-known GPS fix into the offline cache
 * even after the user has been signed out (e.g. after a session timeout) so a
 * queued/offline SOS still carries a recent location.
 *
 * This singleton spawns its own Web Worker for timing and writes only to
 * localStorage (no authenticated Supabase calls, which would fail post-logout).
 */

const POLL_MS = 30_000;

let worker: Worker | null = null;
let started = false;

function acquire() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => cacheLastLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => {
      // keep the previous cached fix on error
      const last = getCachedLastLocation();
      if (last) cacheLastLocation(last);
    },
    { enableHighAccuracy: false, maximumAge: 10_000, timeout: 15_000 },
  );
}

/** Starts the detached keeper. Safe to call repeatedly (no-op if running). */
export function startPersistentLocationKeeper() {
  if (typeof window === "undefined" || started) return;
  started = true;
  try {
    worker = new Worker(new URL("./location.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "tick") acquire();
    };
    worker.postMessage({ type: "start", interval: POLL_MS });
    acquire();
  } catch {
    started = false;
  }
}

/** Stops the detached keeper (e.g. after a fresh sign-in resumes normal tracking). */
export function stopPersistentLocationKeeper() {
  if (!started) return;
  started = false;
  try {
    worker?.postMessage({ type: "stop" });
    worker?.terminate();
  } catch {
    /* ignore */
  }
  worker = null;
}

export function isPersistentKeeperRunning() {
  return started;
}
