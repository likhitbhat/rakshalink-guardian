import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LanguagePref = "en" | "hi" | "es" | "fr";

export type Preferences = {
  language: LanguagePref;
  notifications: boolean;
  quietHours: boolean;
  shareLocation: boolean;
  notifySos: boolean;
  notifyFall: boolean;
  notifyZone: boolean;
  notifyBattery: boolean;
  alertSounds: boolean;
  vibration: boolean;
  alertVolume: number;
  quietHoursStart: string;
  quietHoursEnd: string;
};

const KEY = "raksha:prefs:v1";

const DEFAULTS: Preferences = {
  language: "en",
  notifications: true,
  quietHours: false,
  shareLocation: true,
  notifySos: true,
  notifyFall: true,
  notifyZone: true,
  notifyBattery: true,
  alertSounds: true,
  vibration: true,
  alertVolume: 80,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

export const LANGUAGES: { value: LanguagePref; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
];

function read(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function write(p: Preferences) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

const listeners = new Set<(p: Preferences) => void>();
const broadcast = (p: Preferences) => listeners.forEach((l) => l(p));

type Row = {
  language: string;
  notifications: boolean;
  quiet_hours: boolean;
  share_location: boolean;
  notify_sos?: boolean;
  notify_fall?: boolean;
  notify_zone?: boolean;
  notify_battery?: boolean;
  alert_sounds?: boolean;
  vibration?: boolean;
  alert_volume?: number;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  theme?: string | null;
};

function rowToPrefs(r: Row): Preferences {
  return {
    language: (r.language as LanguagePref) ?? "en",
    notifications: !!r.notifications,
    quietHours: !!r.quiet_hours,
    shareLocation: !!r.share_location,
    notifySos: r.notify_sos !== false,
    notifyFall: r.notify_fall !== false,
    notifyZone: r.notify_zone !== false,
    notifyBattery: r.notify_battery !== false,
    alertSounds: r.alert_sounds !== false,
    vibration: r.vibration !== false,
    alertVolume: typeof r.alert_volume === "number" ? r.alert_volume : 80,
    quietHoursStart: r.quiet_hours_start ?? "22:00",
    quietHoursEnd: r.quiet_hours_end ?? "07:00",
  };
}

let cloudSyncedUserId: string | null = null;

async function pullFromCloud(userId: string) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select(
      "language, notifications, quiet_hours, share_location, notify_sos, notify_fall, notify_zone, notify_battery, alert_sounds, vibration, alert_volume, quiet_hours_start, quiet_hours_end, theme",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return;
  if (data) {
    const next = { ...read(), ...rowToPrefs(data as Row) };
    write(next);
    if (typeof document !== "undefined") document.documentElement.lang = next.language;
    if ((data as Row).theme && typeof document !== "undefined") {
      const t = (data as Row).theme as "light" | "dark";
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(t);
      try { localStorage.setItem("rl-theme", t); } catch {}
    }
    broadcast(next);
  } else {
    // First time: push local defaults to cloud
    const cur = read();
    const theme = (typeof localStorage !== "undefined" && localStorage.getItem("rl-theme")) || "dark";
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      language: cur.language,
      notifications: cur.notifications,
      quiet_hours: cur.quietHours,
      share_location: cur.shareLocation,
      notify_sos: cur.notifySos,
      notify_fall: cur.notifyFall,
      notify_zone: cur.notifyZone,
      notify_battery: cur.notifyBattery,
      alert_sounds: cur.alertSounds,
      vibration: cur.vibration,
      alert_volume: cur.alertVolume,
      quiet_hours_start: cur.quietHoursStart,
      quiet_hours_end: cur.quietHoursEnd,
      theme,
    });
  }
}

async function pushField(userId: string, patch: Record<string, unknown>) {
  await supabase.from("user_preferences").upsert(
    { user_id: userId, ...patch },
    { onConflict: "user_id" },
  );
}

// Wire to auth: pull on sign-in
if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user?.id;
    if (uid) { cloudSyncedUserId = uid; pullFromCloud(uid); }
  });
  supabase.auth.onAuthStateChange((_e, s) => {
    const uid = s?.user?.id ?? null;
    cloudSyncedUserId = uid;
    if (uid) pullFromCloud(uid);
  });
}

export async function syncThemeToCloud(theme: "light" | "dark") {
  if (!cloudSyncedUserId) return;
  await pushField(cloudSyncedUserId, { theme });
}

/** Non-reactive snapshot of current preferences (safe outside React). */
export function getPreferences(): Preferences {
  return read();
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(() => read());

  useEffect(() => {
    const fn = (p: Preferences) => setPrefs(p);
    listeners.add(fn);
    setPrefs(read());
    if (typeof document !== "undefined") document.documentElement.lang = read().language;
    return () => { listeners.delete(fn); };
  }, []);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const next = { ...read(), [key]: value };
    write(next);
    if (key === "language" && typeof document !== "undefined") document.documentElement.lang = next.language;
    broadcast(next);
    if (cloudSyncedUserId) {
      const COLS: Partial<Record<keyof Preferences, string>> = {
        quietHours: "quiet_hours",
        shareLocation: "share_location",
        notifySos: "notify_sos",
        notifyFall: "notify_fall",
        notifyZone: "notify_zone",
        notifyBattery: "notify_battery",
        alertSounds: "alert_sounds",
        vibration: "vibration",
        alertVolume: "alert_volume",
        quietHoursStart: "quiet_hours_start",
        quietHoursEnd: "quiet_hours_end",
      };
      const col = COLS[key] ?? (key as string);
      pushField(cloudSyncedUserId, { [col]: value });
    }
  }, []);

  return { prefs, update };
}
