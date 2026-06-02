import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveLocation } from "@/lib/use-live-location";
import { sendEmergencySms } from "@/lib/sms.functions";
import { notifyGuardians } from "@/lib/push.functions";
import { toast } from "sonner";

const GRAVITY = 9.81;
const SPIKE_G = 2.5; // free-fall / impact spike threshold
const STILL_G = 0.5; // sudden stop threshold
const WINDOW_MS = 500; // spike must be followed by a stop within this window
const COUNTDOWN_SECONDS = 10;

type PermissionState = "unsupported" | "prompt" | "granted" | "denied";

type FallDetectionContextValue = {
  supported: boolean;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  permission: PermissionState;
  needsPermission: boolean;
  requestPermission: () => Promise<void>;
  active: boolean;
};

const FallDetectionContext = createContext<FallDetectionContextValue | null>(null);

export function useFallDetection() {
  const ctx = useContext(FallDetectionContext);
  if (!ctx) throw new Error("useFallDetection must be used within FallDetectionProvider");
  return ctx;
}

function hasDeviceMotion(): boolean {
  return typeof window !== "undefined" && typeof window.DeviceMotionEvent !== "undefined";
}

function needsIosPermission(): boolean {
  return (
    hasDeviceMotion() &&
    typeof (window.DeviceMotionEvent as any).requestPermission === "function"
  );
}

export function FallDetectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { loc } = useLiveLocation();
  const locRef = useRef(loc);
  locRef.current = loc;
  const sendSms = useServerFn(sendEmergencySms);
  const pushGuardians = useServerFn(notifyGuardians);

  const supported = hasDeviceMotion();
  const [enabled, setEnabledState] = useState(false);
  const [permission, setPermission] = useState<PermissionState>(
    !supported ? "unsupported" : needsIosPermission() ? "prompt" : "granted",
  );
  const [active, setActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const storageKey = user ? `rl:fall:${user.id}` : null;

  // Hydrate persisted enabled state per user
  useEffect(() => {
    if (!storageKey) return;
    try {
      setEnabledState(localStorage.getItem(storageKey) === "1");
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const setEnabled = useCallback(
    (v: boolean) => {
      setEnabledState(v);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, v ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
    },
    [storageKey],
  );

  const requestPermission = useCallback(async () => {
    if (!supported) {
      setPermission("unsupported");
      return;
    }
    if (!needsIosPermission()) {
      setPermission("granted");
      return;
    }
    try {
      const res = await (window.DeviceMotionEvent as any).requestPermission();
      setPermission(res === "granted" ? "granted" : "denied");
      if (res !== "granted") toast.error("Motion access denied — fall detection can't run");
    } catch {
      setPermission("denied");
      toast.error("Could not request motion permission");
    }
  }, [supported]);

  // ----- Fall trigger flow -----
  const triggeringRef = useRef(false);
  const cancelledRef = useRef(false);
  const pingRef = useRef<number | null>(null);

  async function getFreshLocation(): Promise<{ lat: number; lng: number }> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return locRef.current;
    return new Promise((resolve) => {
      const fallback = setTimeout(() => resolve(locRef.current), 4000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallback);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(fallback);
          resolve(locRef.current);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 4000 },
      );
    });
  }

  const fireFallAlert = useCallback(async () => {
    if (!user || triggeringRef.current) return;
    triggeringRef.current = true;
    const loc = await getFreshLocation();
    const { data, error } = await supabase
      .from("emergency_alerts")
      .insert({ user_id: user.id, type: "fall", status: "active", lat: loc.lat, lng: loc.lng })
      .select("id")
      .single();
    if (error || !data) {
      triggeringRef.current = false;
      toast.error(error?.message ?? "Could not raise fall alert");
      return;
    }
    toast.error("Fall alert sent · guardians notified");
    if (typeof navigator !== "undefined" && "vibrate" in navigator)
      navigator.vibrate?.([300, 100, 300, 100, 600]);

    // SMS to all emergency contacts (reuses Step 2 server function)
    sendSms({ data: { alertId: data.id, alertType: "fall", lat: loc.lat, lng: loc.lng } })
      .then((res) => {
        if (res.sent > 0) toast.success(`SMS sent to ${res.sent}/${res.total} contacts`);
        if (res.failed > 0) toast.error(`${res.failed} SMS failed to deliver`);
      })
      .catch((e) => toast.error(`SMS error: ${e?.message ?? "unknown"}`));

    // push notification to linked guardians (best-effort)
    pushGuardians({
      data: {
        type: "fall",
        title: "⚠️ Fall Detected",
        body: "A possible fall was detected for a RakshaLink wearer. Tap to view.",
        alertId: data.id,
      },
    }).catch(() => undefined);

    // Live location pings so guardians can track in real time
    await supabase.from("live_locations").insert({ user_id: user.id, lat: loc.lat, lng: loc.lng, battery: 75 });
    pingRef.current = window.setInterval(async () => {
      const l = locRef.current;
      await supabase.from("live_locations").insert({ user_id: user.id, lat: l.lat, lng: l.lng, battery: 75 });
    }, 5000);

    // Auto-stop pings after a couple of minutes to avoid runaway inserts
    window.setTimeout(() => {
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
      triggeringRef.current = false;
    }, 120000);
  }, [user, sendSms]);

  // Begin the 10s cancellation countdown when a fall is detected
  const onFallDetected = useCallback(() => {
    if (countdown !== null || triggeringRef.current) return;
    cancelledRef.current = false;
    setCountdown(COUNTDOWN_SECONDS);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(500);
  }, [countdown]);

  const cancelCountdown = useCallback(() => {
    cancelledRef.current = true;
    setCountdown(null);
    toast("Fall alert cancelled");
  }, []);

  // Drive the countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      if (!cancelledRef.current) fireFallAlert();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, fireFallAlert]);

  // ----- Accelerometer listener -----
  const lastSpikeRef = useRef(0);
  useEffect(() => {
    const canRun = supported && enabled && permission === "granted" && !!user;
    setActive(canRun);
    if (!canRun) return;

    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const gForce = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) / GRAVITY;
      const now = Date.now();
      if (gForce > SPIKE_G) {
        lastSpikeRef.current = now;
      } else if (gForce < STILL_G && lastSpikeRef.current > 0 && now - lastSpikeRef.current <= WINDOW_MS) {
        lastSpikeRef.current = 0;
        onFallDetected();
      }
    };

    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [supported, enabled, permission, user, onFallDetected]);

  // Cleanup pings on unmount
  useEffect(() => {
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  return (
    <FallDetectionContext.Provider
      value={{
        supported,
        enabled,
        setEnabled,
        permission,
        needsPermission: needsIosPermission() && permission !== "granted",
        requestPermission,
        active,
      }}
    >
      {children}
      {countdown !== null && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 px-6 backdrop-blur">
          <div className="absolute inset-0 -z-10 animate-pulse bg-gradient-to-b from-primary/25 via-transparent to-transparent" />
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/15 text-primary">
            <AlertTriangle className="h-12 w-12 animate-bounce" />
          </div>
          <h2 className="mt-6 font-display text-3xl font-bold text-primary">Fall detected</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sending an emergency alert in
          </p>
          <p className="mt-3 font-display text-6xl font-bold tabular-nums">{countdown}</p>
          <button
            onClick={cancelCountdown}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-glow-red)]"
          >
            <X className="h-5 w-5" /> I'm OK — Cancel
          </button>
        </div>
      )}
    </FallDetectionContext.Provider>
  );
}
