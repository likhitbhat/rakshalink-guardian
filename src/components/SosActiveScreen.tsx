import { useCallback, useEffect, useRef, useState } from "react";
import { Shield, Volume2, VolumeX, X } from "lucide-react";
import { useLiveLocation } from "@/lib/use-live-location";

const VIBRATE_PATTERN = [500, 200, 500, 200, 500];
const CANCEL_HOLD_MS = 2000;
const REMUTE_RESUME_MS = 30000;

function formatElapsed(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function SosActiveScreen({
  startSeconds,
  guardianCount,
  onCancel,
}: {
  startSeconds: number;
  guardianCount: number;
  onCancel: () => void | Promise<void>;
}) {
  const { loc } = useLiveLocation();
  const locRef = useRef(loc);
  locRef.current = loc;

  const [elapsed, setElapsed] = useState(startSeconds);
  const [coords, setCoords] = useState({ lat: loc.lat, lng: loc.lng });
  const [muted, setMuted] = useState(false);

  // ----- Elapsed timer (HH:MM:SS) -----
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ----- Live coordinates refresh every 5 seconds -----
  useEffect(() => {
    setCoords({ lat: locRef.current.lat, lng: locRef.current.lng });
    const t = setInterval(() => {
      setCoords({ lat: locRef.current.lat, lng: locRef.current.lng });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // ----- Fullscreen + portrait orientation lock -----
  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => undefined);
    (screen.orientation as any)?.lock?.("portrait").catch(() => undefined);
    return () => {
      (screen.orientation as any)?.unlock?.();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);

  // ----- Web Audio alarm (alternating 880Hz / 440Hz beeps) -----
  const audioRef = useRef<{ ctx: AudioContext; interval: number; high: boolean } | null>(null);

  const startAlarm = useCallback(() => {
    if (audioRef.current) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    ctx.resume?.();
    const state = { ctx, interval: 0, high: true };
    const beep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = state.high ? 880 : 440;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      state.high = !state.high;
    };
    beep();
    state.interval = window.setInterval(beep, 350);
    audioRef.current = state;
  }, []);

  const stopAlarm = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    clearInterval(a.interval);
    a.ctx.close().catch(() => undefined);
    audioRef.current = null;
  }, []);

  // ----- Vibration (SOS pattern repeating every 5s) -----
  const vibrateRef = useRef<number | null>(null);
  const startVibration = useCallback(() => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (vibrateRef.current) return;
    navigator.vibrate?.(VIBRATE_PATTERN);
    vibrateRef.current = window.setInterval(() => navigator.vibrate?.(VIBRATE_PATTERN), 5000);
  }, []);
  const stopVibration = useCallback(() => {
    if (vibrateRef.current) {
      clearInterval(vibrateRef.current);
      vibrateRef.current = null;
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(0);
  }, []);

  // Drive alarm + vibration from mute state
  const remuteRef = useRef<number | null>(null);
  useEffect(() => {
    if (muted) {
      stopAlarm();
      stopVibration();
      // Resume automatically after 30s if still muted
      remuteRef.current = window.setTimeout(() => setMuted(false), REMUTE_RESUME_MS);
    } else {
      startAlarm();
      startVibration();
    }
    return () => {
      if (remuteRef.current) {
        clearTimeout(remuteRef.current);
        remuteRef.current = null;
      }
    };
  }, [muted, startAlarm, stopAlarm, startVibration, stopVibration]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      stopAlarm();
      stopVibration();
    };
  }, [stopAlarm, stopVibration]);

  // ----- Block back navigation while SOS is active -----
  useEffect(() => {
    history.pushState({ sosLock: true }, "");
    const onPop = () => {
      const leave = window.confirm("SOS is active — are you sure you want to leave?");
      if (!leave) {
        history.pushState({ sosLock: true }, "");
      } else {
        history.back();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ----- 2-second press-and-hold to cancel -----
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRafRef = useRef<number | null>(null);
  const holdStartRef = useRef(0);

  const endHold = useCallback(() => {
    if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current);
    holdRafRef.current = null;
    setHoldProgress(0);
  }, []);

  const doCancel = useCallback(async () => {
    endHold();
    stopAlarm();
    stopVibration();
    (screen.orientation as any)?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => undefined);
    await onCancel();
  }, [endHold, stopAlarm, stopVibration, onCancel]);

  const startHold = useCallback(() => {
    holdStartRef.current = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - holdStartRef.current) / CANCEL_HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        doCancel();
        return;
      }
      holdRafRef.current = requestAnimationFrame(tick);
    };
    holdRafRef.current = requestAnimationFrame(tick);
  }, [doCancel]);

  const R = 54;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-between overflow-hidden bg-[oklch(0.32_0.18_25)] px-6 pb-10 pt-12 text-white">
      <div className="absolute inset-0 -z-10 animate-pulse bg-[oklch(0.45_0.24_25)]" />

      {/* Mute / unmute toggle (small, corner) */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur"
        aria-label={muted ? "Unmute alarm" : "Mute alarm"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Header */}
      <div className="mt-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
          <Shield className="h-10 w-10 animate-pulse" />
        </div>
        <h1 className="mt-5 animate-pulse font-display text-5xl font-black tracking-tight drop-shadow-lg">
          SOS ACTIVE
        </h1>
        <p className="mt-3 font-display text-4xl font-bold tabular-nums">{formatElapsed(elapsed)}</p>
      </div>

      {/* Live data */}
      <div className="w-full max-w-xs space-y-3 text-center">
        <div className="rounded-2xl bg-black/25 px-4 py-3 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Live coordinates</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        </div>
        <div className="rounded-2xl bg-black/25 px-4 py-3 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Guardians notified</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{guardianCount}</p>
        </div>
      </div>

      {/* Press-and-hold cancel */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-36 w-36">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="white"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - holdProgress)}
            />
          </svg>
          <button
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            className="absolute inset-2 flex select-none flex-col items-center justify-center rounded-full bg-white text-[oklch(0.45_0.22_25)] shadow-lg transition active:scale-95"
          >
            <X className="h-7 w-7" />
            <span className="mt-1 text-xs font-bold uppercase tracking-wide">Cancel SOS</span>
          </button>
        </div>
        <p className="text-xs text-white/70">Press &amp; hold 2s to cancel</p>
      </div>
    </div>
  );
}
