import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLastLocationUpdate } from "@/lib/location-tracker";

export type GpsState = "good" | "stale" | "lost";
export type RealtimeState = "connected" | "reconnecting" | "paused";

export type PhoneBattery = {
  level: number | null;
  charging: boolean;
  supported: boolean;
};

export type SystemStatusValue = {
  battery: PhoneBattery;
  online: boolean;
  gps: GpsState;
  lastGpsUpdate: number;
  realtime: RealtimeState;
};

const DEFAULT_VALUE: SystemStatusValue = {
  battery: { level: null, charging: false, supported: false },
  online: true,
  gps: "good",
  lastGpsUpdate: 0,
  realtime: "connected",
};

const Ctx = createContext<SystemStatusValue | null>(null);

/** Reactive snapshot of phone battery, GPS, internet and realtime health. */
export function useSystemStatus(): SystemStatusValue {
  return useContext(Ctx) ?? DEFAULT_VALUE;
}

const GPS_STALE_MS = 30_000;
const GPS_LOST_MS = 60_000;
const BATTERY_POLL_MS = 60_000;
const REALTIME_RETRY_MS = 30_000;

// ---- Phone battery (Battery Status API) ----
function useBatteryMonitor(): PhoneBattery {
  const [battery, setBattery] = useState<PhoneBattery>({
    level: null,
    charging: false,
    supported: false,
  });
  const lowNotified = useRef(false);
  const criticalNotified = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<any>;
    };
    if (!nav.getBattery) {
      setBattery({ level: null, charging: false, supported: false });
      return;
    }

    let mgr: any = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    const apply = () => {
      if (!mgr) return;
      const level = Math.round((mgr.level ?? 0) * 100);
      const charging = !!mgr.charging;
      setBattery({ level, charging, supported: true });

      if (charging) {
        lowNotified.current = false;
        criticalNotified.current = false;
        return;
      }

      if (level <= 10) {
        criticalNotified.current = true;
      } else {
        criticalNotified.current = false;
      }

      if (level < 20) {
        if (!lowNotified.current) {
          lowNotified.current = true;
          toast.warning("Phone battery low — charge soon");
        }
      } else {
        lowNotified.current = false;
      }
    };

    nav.getBattery().then((b: any) => {
      if (disposed) return;
      mgr = b;
      b.addEventListener("levelchange", apply);
      b.addEventListener("chargingchange", apply);
      apply();
      poll = setInterval(apply, BATTERY_POLL_MS);
    });

    return () => {
      disposed = true;
      if (poll) clearInterval(poll);
      if (mgr) {
        mgr.removeEventListener("levelchange", apply);
        mgr.removeEventListener("chargingchange", apply);
      }
    };
  }, []);

  return battery;
}

// ---- GPS freshness (derived from last successful location write) ----
function useGpsMonitor(lastUpdate: number): GpsState {
  const [gps, setGps] = useState<GpsState>("good");
  const lastRef = useRef(lastUpdate);
  lastRef.current = lastUpdate;
  const wasLost = useRef(false);

  useEffect(() => {
    const check = () => {
      const ts = lastRef.current;
      if (!ts) return; // no fix yet — stay neutral
      const age = Date.now() - ts;
      if (age > GPS_LOST_MS) {
        if (!wasLost.current) {
          wasLost.current = true;
          toast.warning("GPS signal lost");
        }
        setGps("lost");
      } else {
        if (wasLost.current) {
          wasLost.current = false;
          toast.success("GPS signal restored");
        }
        setGps(age > GPS_STALE_MS ? "stale" : "good");
      }
    };
    check();
    const t = setInterval(check, 5_000);
    return () => clearInterval(t);
  }, []);

  return gps;
}

// ---- Supabase Realtime subscription health ----
function useRealtimeMonitor(): RealtimeState {
  const [state, setState] = useState<RealtimeState>("connected");

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retry: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    const connect = () => {
      const name = `system-health-${Math.random().toString(36).slice(2)}`;
      channel = supabase.channel(name).subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setState("connected");
          if (retry) {
            clearInterval(retry);
            retry = null;
          }
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setState((prev) => (prev === "reconnecting" ? prev : "paused"));
          scheduleReconnect();
        }
      });
    };

    const scheduleReconnect = () => {
      if (retry || disposed) return;
      retry = setInterval(() => {
        if (disposed) return;
        setState("reconnecting");
        try {
          if (channel) supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
        connect();
      }, REALTIME_RETRY_MS);
    };

    connect();

    return () => {
      disposed = true;
      if (retry) clearInterval(retry);
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, []);

  return state;
}

function CriticalBatteryBanner({ show, online }: { show: boolean; online: boolean }) {
  if (!show) return null;
  return (
    <div
      className={`fixed left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] ${
        online ? "top-0" : "top-9"
      }`}
    >
      Critical battery — SOS may not send
    </div>
  );
}

/**
 * Mounts all device-health monitors (phone battery, GPS, internet, realtime),
 * fires the relevant toasts/banners, and exposes the live status via context.
 */
export function SystemMonitorProvider({ children }: { children: React.ReactNode }) {
  const battery = useBatteryMonitor();
  const lastGpsUpdate = useLastLocationUpdate();
  const gps = useGpsMonitor(lastGpsUpdate);
  const realtime = useRealtimeMonitor();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      toast.success("Back online — syncing data");
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const criticalBattery =
    battery.level != null && battery.level < 10 && !battery.charging;

  return (
    <Ctx.Provider value={{ battery, online, gps, lastGpsUpdate, realtime }}>
      <CriticalBatteryBanner show={criticalBattery} online={online} />
      {children}
    </Ctx.Provider>
  );
}
