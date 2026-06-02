import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { getQueuedAlerts } from "@/lib/offline";
import { startPersistentLocationKeeper } from "@/lib/persistent-location";
import { ShieldAlert, Clock } from "lucide-react";

// 30 minutes of inactivity before the warning appears.
const IDLE_MS = 30 * 60 * 1000;
// 60 second countdown shown in the warning modal.
const WARN_SECONDS = 60;

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "pointerdown"] as const;

/**
 * Idle-based session manager. After 30 minutes without user interaction it
 * shows a "Session expiring" modal with a 60s countdown. If the user does not
 * respond, they are signed out — but the offline SOS queue (localStorage) is
 * preserved and a detached background location keeper is started so the device
 * keeps refreshing its last-known position after logout.
 */
export function SessionTimeout() {
  const { signOut, session } = useAuth();
  const nav = useNavigate();
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARN_SECONDS);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastInteraction = useRef<number>(Date.now());

  const clearIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };
  const clearCountdown = () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
  };

  const doLogout = useCallback(async () => {
    clearIdle();
    clearCountdown();
    setWarning(false);
    // Keep the offline SOS queue alive across logout (it already lives in
    // localStorage — getQueuedAlerts just confirms it remains intact) and keep
    // the background location worker running after sign-out.
    void getQueuedAlerts();
    startPersistentLocationKeeper();
    try {
      await signOut();
    } finally {
      nav({ to: "/auth/login" });
    }
  }, [signOut, nav]);

  const startIdleTimer = useCallback(() => {
    clearIdle();
    idleTimer.current = setTimeout(() => {
      setSecondsLeft(WARN_SECONDS);
      setWarning(true);
    }, IDLE_MS);
  }, []);

  const onActivity = useCallback(() => {
    lastInteraction.current = Date.now();
    if (!warning) startIdleTimer();
  }, [warning, startIdleTimer]);

  // Track interactions while signed in.
  useEffect(() => {
    if (!session) return;
    startIdleTimer();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    return () => {
      clearIdle();
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [session, onActivity, startIdleTimer]);

  // Run the 60s countdown once the warning is visible.
  useEffect(() => {
    if (!warning) {
      clearCountdown();
      return;
    }
    countdownTimer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          void doLogout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return clearCountdown;
  }, [warning, doLogout]);

  const stayLoggedIn = () => {
    setWarning(false);
    clearCountdown();
    lastInteraction.current = Date.now();
    startIdleTimer();
  };

  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-6 text-center shadow-[var(--shadow-elevated)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
          <ShieldAlert className="h-7 w-7 text-warning" />
        </div>
        <h2 className="font-display text-xl font-bold">Session expiring</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You've been inactive for a while. For your security you'll be signed out soon.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-3xl font-bold tabular-nums">
          <Clock className="h-6 w-6 text-warning" />
          0:{String(secondsLeft).padStart(2, "0")}
        </div>
        <div className="mt-6 space-y-3">
          <button
            onClick={stayLoggedIn}
            className="w-full rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] transition active:scale-[0.98]"
          >
            Stay signed in
          </button>
          <button
            onClick={() => void doLogout()}
            className="w-full rounded-2xl border border-border bg-card/50 py-3 text-sm font-semibold transition hover:bg-card"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
