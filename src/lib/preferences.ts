import { useEffect, useState, useCallback } from "react";

export type ThemePref = "dark" | "light";
export type LanguagePref = "en" | "hi" | "es" | "fr";

export type Preferences = {
  theme: ThemePref;
  language: LanguagePref;
  notifications: boolean;
  quietHours: boolean;
  shareLocation: boolean;
};

const KEY = "raksha:prefs:v1";

const DEFAULTS: Preferences = {
  theme: "dark",
  language: "en",
  notifications: true,
  quietHours: false,
  shareLocation: true,
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

export function applyTheme(theme: ThemePref) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export function initPreferences() {
  const p = read();
  applyTheme(p.theme);
  if (typeof document !== "undefined") {
    document.documentElement.lang = p.language;
  }
}

const listeners = new Set<(p: Preferences) => void>();

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(() => read());

  useEffect(() => {
    const fn = (p: Preferences) => setPrefs(p);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const next = { ...read(), [key]: value };
    localStorage.setItem(KEY, JSON.stringify(next));
    if (key === "theme") applyTheme(next.theme);
    if (key === "language" && typeof document !== "undefined") document.documentElement.lang = next.language;
    listeners.forEach((l) => l(next));
  }, []);

  return { prefs, update };
}
