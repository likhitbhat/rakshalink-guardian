import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** localStorage keys for offline-cached data. */
const KEYS = {
  contacts: "rakshalink_contacts",
  links: "rakshalink_guardian_links",
  location: "rakshalink_last_location",
  queue: "rakshalink_sos_queue",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode errors */
  }
}

/** Reactive online/offline state synced with browser events. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

// ---- Emergency contacts & guardian links cache ----

export function cacheContacts(contacts: unknown[]) {
  write(KEYS.contacts, contacts);
}
export function getCachedContacts<T = any>(): T[] {
  return read<T[]>(KEYS.contacts, []);
}

export function cacheGuardianLinks(links: unknown[]) {
  write(KEYS.links, links);
}
export function getCachedGuardianLinks<T = any>(): T[] {
  return read<T[]>(KEYS.links, []);
}

// ---- Last known GPS ----

export function cacheLastLocation(loc: { lat: number; lng: number }) {
  write(KEYS.location, { lat: loc.lat, lng: loc.lng });
}
export function getCachedLastLocation(): { lat: number; lng: number } | null {
  return read<{ lat: number; lng: number } | null>(KEYS.location, null);
}

/**
 * Refreshes the offline cache from Supabase while online so the data is
 * available the next time the device goes offline.
 */
export async function refreshOfflineCache(userId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    const [{ data: contacts }, { data: links }] = await Promise.all([
      supabase.from("emergency_contacts").select("*").eq("user_id", userId),
      supabase.from("guardian_links").select("*").eq("user_id", userId),
    ]);
    if (contacts) cacheContacts(contacts);
    if (links) cacheGuardianLinks(links);
  } catch {
    /* offline or transient error — keep existing cache */
  }
}

// ---- Offline SOS queue ----

export type QueuedAlert = {
  localId: string;
  type: "sos" | "fall" | "voice" | "deadman" | "manual";
  lat: number;
  lng: number;
  queuedAt: string;
};

export function queueOfflineAlert(alert: Omit<QueuedAlert, "localId" | "queuedAt">) {
  const queue = read<QueuedAlert[]>(KEYS.queue, []);
  queue.push({ ...alert, localId: crypto.randomUUID(), queuedAt: new Date().toISOString() });
  write(KEYS.queue, queue);
}

export function getQueuedAlerts(): QueuedAlert[] {
  return read<QueuedAlert[]>(KEYS.queue, []);
}

function clearQueue() {
  write(KEYS.queue, []);
}

/**
 * Flushes any queued offline SOS alerts to Supabase. Returns the number of
 * alerts successfully synced. Safe to call repeatedly.
 */
export async function syncQueuedAlerts(userId: string): Promise<number> {
  const queue = getQueuedAlerts();
  if (queue.length === 0) return 0;
  const remaining: QueuedAlert[] = [];
  let synced = 0;
  for (const a of queue) {
    const { error } = await supabase
      .from("emergency_alerts")
      .insert({ user_id: userId, type: a.type, status: "active", lat: a.lat, lng: a.lng });
    if (error) remaining.push(a);
    else synced += 1;
  }
  if (remaining.length === 0) clearQueue();
  else write(KEYS.queue, remaining);
  return synced;
}
