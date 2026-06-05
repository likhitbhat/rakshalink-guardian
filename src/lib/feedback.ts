import { getPreferences } from "@/lib/preferences";

/**
 * Audio + haptic feedback for RakshaLink, built entirely on the Web Audio API
 * (no external audio files). Respects the user's "Alert Sounds", "Vibration",
 * "Volume" and "Quiet Hours" preferences.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Parse "HH:MM" into minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = (hhmm ?? "").split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** True when the current local time falls inside the configured quiet hours. */
export function isQuietHours(now: Date = new Date()): boolean {
  const { quietHoursStart, quietHoursEnd } = getPreferences();
  const start = toMinutes(quietHoursStart);
  const end = toMinutes(quietHoursEnd);
  if (start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  // Wrapping range (e.g. 22:00 -> 07:00)
  if (start > end) return cur >= start || cur < end;
  return cur >= start && cur < end;
}

type BeepOptions = {
  /** Suppress the sound during quiet hours (used for alert tones). */
  respectQuietHours?: boolean;
  /** Override volume (0..1). Defaults to the user's volume preference. */
  gain?: number;
  type?: OscillatorType;
  /** Bypass the "Alert Sounds" toggle (used by the settings preview). */
  force?: boolean;
};

/** Play a single tone of `freq` Hz for `durationMs` ms. Returns when scheduled. */
export function playTone(freq: number, durationMs: number, opts: BeepOptions = {}): boolean {
  const prefs = getPreferences();
  if (!opts.force && !prefs.alertSounds) return false;
  if (opts.respectQuietHours && isQuietHours()) return false;
  const audio = getCtx();
  if (!audio) return false;

  const volume = opts.gain ?? Math.max(0, Math.min(1, prefs.alertVolume / 100));
  if (volume <= 0) return false;

  const osc = audio.createOscillator();
  const gainNode = audio.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.value = freq;

  const now = audio.currentTime;
  const dur = durationMs / 1000;
  // Short attack/release envelope to avoid clicks.
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.setValueAtTime(volume, now + Math.max(0.01, dur - 0.03));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(gainNode).connect(audio.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
  return true;
}

/** Play a sequence of identical beeps with gaps. */
function playSequence(freq: number, beepMs: number, gapMs: number, count: number, opts: BeepOptions = {}) {
  for (let i = 0; i < count; i++) {
    window.setTimeout(() => playTone(freq, beepMs, opts), i * (beepMs + gapMs));
  }
}

/** Fire a vibration pattern, respecting the user's "Vibration" preference. */
export function vibrate(pattern: number | number[], opts: { force?: boolean } = {}): boolean {
  const prefs = getPreferences();
  if (!opts.force && !prefs.vibration) return false;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

// ---- Specific feedback presets ---------------------------------------------

/** Short confirmation beep when an SOS is successfully sent (200ms, 880Hz). */
export function sosConfirmBeep() {
  playTone(880, 200, { type: "square" });
}

/** 50ms haptic pulse on the SOS button press. */
export function sosButtonTap() {
  vibrate(50);
}

/** Urgent guardian alert: 3 beeps at 1000Hz + vibration. Respects quiet hours. */
export function guardianAlert() {
  playSequence(1000, 180, 120, 3, { respectQuietHours: true, type: "square" });
  if (!isQuietHours()) vibrate([300, 100, 300, 100, 300]);
}

/** Low warning tone when leaving a safe zone (400Hz, 500ms). */
export function zoneExitTone() {
  playTone(400, 500, { type: "sine" });
}

/** Pleasant confirmation tone when entering a safe zone (600Hz, 300ms). */
export function zoneEntryTone() {
  playTone(600, 300, { type: "sine" });
}

/** Single short vibration for success actions (100ms). */
export function successFeedback() {
  vibrate(100);
}

/** Double vibration for error actions ([100, 50, 100]). */
export function errorFeedback() {
  vibrate([100, 50, 100]);
}

/** Preview current sound settings (ignores the alert-sounds toggle so the
 *  preview always plays, but still honours the volume slider). */
export function previewSettings() {
  playTone(880, 200, { force: true, type: "square" });
  window.setTimeout(() => playTone(600, 300, { force: true }), 280);
  vibrate([100, 50, 100], { force: true });
}
