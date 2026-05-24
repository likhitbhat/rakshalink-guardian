import { useCallback, useEffect, useState } from "react";

export type PushPermission = "granted" | "denied" | "default" | "unsupported";

function read(): PushPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission as PushPermission;
}

const listeners = new Set<(p: PushPermission) => void>();

export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission>(() => read());

  useEffect(() => {
    const fn = (p: PushPermission) => setPermission(p);
    listeners.add(fn);
    setPermission(read());
    const onVisible = () => setPermission(read());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      listeners.delete(fn);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const request = useCallback(async (): Promise<PushPermission> => {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      const p = Notification.permission as PushPermission;
      listeners.forEach((l) => l(p));
      return p;
    }
    try {
      const result = await Notification.requestPermission();
      const p = result as PushPermission;
      listeners.forEach((l) => l(p));
      return p;
    } catch {
      return read();
    }
  }, []);

  const sendTest = useCallback(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    try {
      new Notification("RakshaLink notifications enabled", {
        body: "You'll be alerted for SOS, safe-zone events, and device updates.",
        icon: "/favicon.ico",
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  return { permission, request, sendTest, supported: permission !== "unsupported" };
}

export function describePermission(p: PushPermission): { label: string; tone: "safe" | "warn" | "danger" | "muted" } {
  switch (p) {
    case "granted": return { label: "Allowed", tone: "safe" };
    case "denied": return { label: "Blocked", tone: "danger" };
    case "default": return { label: "Not enabled", tone: "warn" };
    default: return { label: "Unsupported", tone: "muted" };
  }
}
