// RakshaLink Service Worker — offline support
// NOTE: registration is guarded in src/lib/pwa.ts so this never runs inside
// the Lovable editor preview iframe. It only activates in the deployed app.

const CACHE = "rakshalink-v1";
const APP_SHELL = ["/", "/app", "/app/sos", "/app/map", "/guardian", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isSupabaseRequest(url) {
  return url.hostname.includes("supabase.co") || url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Network-first for Supabase / API calls, fall back to cache when offline.
  if (isSupabaseRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Navigations: network-first, fall back to cached page, then cached /app shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/app")) || Response.error()),
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        }),
    ),
  );
});

// ---- Web Push notifications ----
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "RakshaLink", body: event.data ? event.data.text() : "New alert" };
  }
  const title = payload.title || "RakshaLink";
  const options = {
    body: payload.body || "You have a new alert.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "rakshalink-alert",
    data: { url: payload.url || "/guardian/alerts", alertId: payload.alertId },
    requireInteraction: payload.tag === "sos" || payload.tag === "fall",
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/guardian/alerts";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(target).catch(() => undefined);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
