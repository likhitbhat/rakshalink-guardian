import { useEffect, useRef, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePreferences } from "@/lib/preferences";
import { useSafeZones, findContainingZone, type SafeZone } from "@/lib/safe-zone";
import { cacheLastLocation, getCachedLastLocation } from "@/lib/offline";
import { notifyGuardians } from "@/lib/push.functions";

// Battery level (%) at or below which guardians get a low-battery alert.
const LOW_BATTERY_THRESHOLD = 20;

export type TrackingStatus = "paused" | "active" | "background";

// Polling cadence (ms)
const ACTIVE_MS = 10_000; // foreground, outside a safe zone
const SAFE_ZONE_MS = 30_000; // foreground, inside a safe zone
const BACKGROUND_MS = 30_000; // app minimized / hidden
const HEARTBEAT_MS = 10_000; // worker crash-detection cadence
const PONG_GRACE_MS = 4_000; // allowed time to answer a ping

// ---- Reactive status store (shared with the device page badge) ----
let currentStatus: TrackingStatus = "paused";
const statusListeners = new Set<() => void>();
function setStatus(s: TrackingStatus) {
  if (s === currentStatus) return;
  currentStatus = s;
  statusListeners.forEach((l) => l());
}
export function useTrackingStatus(): TrackingStatus {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => currentStatus,
    () => "paused" as TrackingStatus,
  );
}

// ---- Last successful GPS update timestamp ----
let lastUpdateAt = 0; // epoch ms
const updateListeners = new Set<() => void>();
function setLastUpdate(ts: number) {
  lastUpdateAt = ts;
  updateListeners.forEach((l) => l());
}
export function useLastLocationUpdate(): number {
  return useSyncExternalStore(
    (cb) => {
      updateListeners.add(cb);
      return () => updateListeners.delete(cb);
    },
    () => lastUpdateAt,
    () => 0,
  );
}

async function readBattery(): Promise<number> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    if (nav.getBattery) {
      const b = await nav.getBattery();
      return Math.round((b.level ?? 0.75) * 100);
    }
  } catch {
    /* ignore */
  }
  return 75;
}

const BG_NOTIF_TAG = "rl-bg-tracking";

/**
 * Keeps live location tracking alive while the app is minimized.
 *
 * - Runs the polling cadence inside a Web Worker (off the main thread).
 * - Main thread acquires GPS on each worker tick and writes live_locations.
 * - Page Visibility API switches to a 30s battery-saving background cadence
 *   and shows a persistent notification while hidden.
 * - Restarts the worker automatically if it stops responding.
 *
 * NOTE: browsers throttle background tabs and may suspend timers when the OS
 * backgrounds the page; true uninterrupted background GPS requires a native
 * wrapper. This is the best-effort web implementation.
 */
export function useBackgroundLocationTracking(userId: string | undefined) {
  const { prefs } = usePreferences();
  const share = prefs.shareLocation;
  const zones = useSafeZones(userId);
  const zonesRef = useRef<SafeZone[]>(zones);
  zonesRef.current = zones;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userId || !share) {
      setStatus("paused");
      return;
    }

    let worker: Worker | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let awaitingPongSince = 0;
    let currentInterval = ACTIVE_MS;
    let lastLoc = getCachedLastLocation();
    let disposed = false;
    // Zone-transition tracking. `undefined` means "not yet initialised" so we
    // don't fire a spurious enter/exit on the very first GPS fix.
    let prevZoneId: string | null | undefined = undefined;
    // Low-battery alert is sent once per descent below the threshold; it re-arms
    // when the battery climbs back above the threshold (e.g. after charging).
    let lowBatteryArmed = true;

    const computeInterval = () => {
      if (document.hidden) return BACKGROUND_MS;
      const inZone = findContainingZone(lastLoc, zonesRef.current);
      return inZone ? SAFE_ZONE_MS : ACTIVE_MS;
    };

    const handleZoneTransition = async (lat: number, lng: number) => {
      const zone = findContainingZone(lastLoc, zonesRef.current);
      const zoneId = zone?.id ?? null;
      if (prevZoneId === undefined) {
        prevZoneId = zoneId; // initialise silently
        return;
      }
      if (zoneId === prevZoneId) return;

      // Exited the previous zone.
      if (prevZoneId !== null) {
        const left = zonesRef.current.find((z) => z.id === prevZoneId);
        if (left && left.notify_exit !== false) {
          await emitZoneEvent("exit", left, lat, lng);
        }
      }
      // Entered a new zone.
      if (zoneId !== null && zone && zone.notify_enter !== false) {
        await emitZoneEvent("enter", zone, lat, lng);
      }
      prevZoneId = zoneId;
    };

    const emitZoneEvent = async (
      event: "enter" | "exit",
      zone: SafeZone,
      lat: number,
      lng: number,
    ) => {
      try {
        await supabase.from("zone_events").insert({
          user_id: userId,
          event,
          zone_id: zone.id,
          zone_name: zone.name,
          lat,
          lng,
        });
        await notifyGuardians({
          data: {
            type: "zone",
            title: event === "enter" ? `Entered ${zone.name}` : `Left ${zone.name}`,
            body:
              event === "enter"
                ? `Arrived at the safe zone "${zone.name}".`
                : `Left the safe zone "${zone.name}".`,
          },
        });
      } catch {
        /* best-effort */
      }
    };

    const handleLowBattery = async (battery: number) => {
      if (battery > LOW_BATTERY_THRESHOLD) {
        lowBatteryArmed = true;
        return;
      }
      if (!lowBatteryArmed) return;
      lowBatteryArmed = false;
      try {
        await notifyGuardians({
          data: {
            type: "battery",
            title: "Low battery",
            body: `Device battery is at ${battery}%. Please charge soon.`,
          },
        });
      } catch {
        /* best-effort */
      }
    };

    const writeFix = async (lat: number, lng: number) => {
      lastLoc = { lat, lng };
      cacheLastLocation(lastLoc);
      const battery = await readBattery();
      await supabase.from("live_locations").insert({ user_id: userId, lat, lng, battery });
      setLastUpdate(Date.now());
      // Notify guardians on safe-zone transitions and low battery.
      void handleZoneTransition(lat, lng);
      void handleLowBattery(battery);
      // Foreground: zone membership may change which interval we should use.
      if (!document.hidden) {
        const next = computeInterval();
        if (next !== currentInterval) {
          currentInterval = next;
          worker?.postMessage({ type: "setInterval", interval: next });
        }
      }
    };

    const acquireAndWrite = () => {
      if (!navigator.geolocation) {
        if (lastLoc) writeFix(lastLoc.lat, lastLoc.lng);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => writeFix(pos.coords.latitude, pos.coords.longitude),
        () => {
          if (lastLoc) writeFix(lastLoc.lat, lastLoc.lng);
        },
        { enableHighAccuracy: !document.hidden, maximumAge: 5_000, timeout: 15_000 },
      );
    };

    const showBgNotif = () => {
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("RakshaLink is tracking your location", {
            body: "Background location sharing is active to keep your guardians updated.",
            icon: "/icon-192.png",
            tag: BG_NOTIF_TAG,
            silent: true,
          });
        }
      } catch {
        /* ignore */
      }
    };

    const dismissBgNotif = () => {
      // Re-creating with the same tag and immediately closing clears it on
      // platforms that keep tagged notifications around.
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification("", { tag: BG_NOTIF_TAG, silent: true });
          n.close();
        }
      } catch {
        /* ignore */
      }
    };

    const spawnWorker = () => {
      const w = new Worker(new URL("./location.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent) => {
        const t = (e.data as { type?: string })?.type;
        if (t === "tick") acquireAndWrite();
        else if (t === "pong") awaitingPongSince = 0;
      };
      w.onerror = () => restartWorker();
      return w;
    };

    const restartWorker = () => {
      if (disposed) return;
      try {
        worker?.terminate();
      } catch {
        /* ignore */
      }
      worker = spawnWorker();
      worker.postMessage({ type: "start", interval: currentInterval });
    };

    const applyVisibility = () => {
      if (document.hidden) {
        currentInterval = BACKGROUND_MS;
        worker?.postMessage({ type: "setInterval", interval: BACKGROUND_MS });
        setStatus("background");
        showBgNotif();
      } else {
        currentInterval = computeInterval();
        worker?.postMessage({ type: "setInterval", interval: currentInterval });
        setStatus("active");
        dismissBgNotif();
      }
    };

    // --- Boot ---
    currentInterval = computeInterval();
    worker = spawnWorker();
    worker.postMessage({ type: "start", interval: currentInterval });
    setStatus(document.hidden ? "background" : "active");
    if (document.hidden) showBgNotif();

    document.addEventListener("visibilitychange", applyVisibility);

    heartbeat = setInterval(() => {
      if (awaitingPongSince && Date.now() - awaitingPongSince > PONG_GRACE_MS) {
        // Worker missed a heartbeat → assume crash and restart.
        awaitingPongSince = 0;
        restartWorker();
        return;
      }
      awaitingPongSince = Date.now();
      worker?.postMessage({ type: "ping" });
    }, HEARTBEAT_MS);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", applyVisibility);
      if (heartbeat) clearInterval(heartbeat);
      try {
        worker?.postMessage({ type: "stop" });
        worker?.terminate();
      } catch {
        /* ignore */
      }
      worker = null;
      dismissBgNotif();
      setStatus("paused");
    };
  }, [userId, share]);
}
