import { useCallback, useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "./push.functions";

// Publishable VAPID application server public key (same value the server uses).
const VAPID_PUBLIC_KEY =
  "BJjlqJAJYU8QP9J4PZBRdw3vbYtEBz3bgjheWtVHuxpOhgFmvh-xwv4njunSjOBH1yb7QHZcojtE1C-zXP-d-uw";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Requests notification permission, creates a Web Push subscription, and
 * saves it to the backend. Returns true on success. No-ops gracefully where
 * push isn't available (e.g. the Lovable preview iframe).
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission === "denied") return false;
  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
  }

  const reg = await getRegistration();
  if (!reg) return false;

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    await savePushSubscription({
      data: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Removes the current device's push subscription locally and on the backend. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => undefined);
      await removePushSubscription({ data: { endpoint } });
    }
  } catch {
    // best-effort
  }
}

/** Convenience hook exposing support + subscribe/unsubscribe for components. */
export function usePushSubscription() {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(pushSupported()), []);
  const subscribe = useCallback(() => subscribeToPush(), []);
  const unsubscribe = useCallback(() => unsubscribeFromPush(), []);
  return { supported, subscribe, unsubscribe };
}
