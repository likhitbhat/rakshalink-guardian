# Web Push Notifications (no Firebase)

Push notifications built entirely on Lovable Cloud using the browser-native **Web Push API + VAPID**. No Firebase project, no SDK, no external credentials. Because RakshaLink already has a service worker (`public/sw.js`) and an installable manifest, these notifications **also pop on the device when the app is installed** as a PWA (Android/Chrome/Edge/Firefox, and iOS 16.4+ when added to Home Screen).

## How it works

```text
Guardian's browser ──subscribe──▶ saved to push_subscriptions table
                                          │
Wearer SOS / fall / zone / low battery    │
   writes row to existing tables          ▼
        ──▶ DB trigger ──▶ pg_net call ──▶ /api/public/push-dispatch
                                          │ looks up guardians' subscriptions
                                          │ signs VAPID JWT (Web Crypto)
                                          ▼ sends Web Push to each endpoint
                              Service worker 'push' event ──▶ showNotification()
                                          │ tap ──▶ opens /guardian/alerts (highlighted)
```

## 1. Database (one migration)

- New table `push_subscriptions`: `id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `created_at`. RLS so users manage only their own rows; guardians' tokens are read server-side via service role. Includes GRANTs (authenticated + service_role).
- Reuse existing `user_preferences` for notification on/off; add per-type toggle columns (`notify_sos`, `notify_fall`, `notify_zone`, `notify_battery`, all default true).
- Triggers on `emergency_alerts` (insert → SOS/fall by `type`), `zone_events` (insert), and a low-battery condition on `live_locations`/`devices` update. Each trigger calls the dispatch endpoint via `pg_net` with the alert id + type.

## 2. Subscribe flow

- New `src/lib/web-push.ts`: `subscribeToPush()` (registers SW if needed, calls `pushManager.subscribe` with the public VAPID key, saves subscription to Supabase) and `unsubscribeFromPush()`.
- Hook the permission request into **onboarding Step 1** and keep the existing toggle in `/app/settings` working — it will now create/remove a real push subscription instead of only a local Notification check.
- Add per-type notification toggles in `/app/settings` (SOS, fall, zone, low battery), persisted to `user_preferences`.

## 3. Service worker

- Extend `public/sw.js` with `push` and `notificationclick` handlers. On `push`, show the notification (title/body/icon/data). On click, focus or open `/guardian/alerts?focus=<alertId>` so the specific new alert is highlighted.
- `/guardian/alerts` reads the `focus` param and scrolls to / highlights that alert.

## 4. Server dispatch endpoint

- New `src/routes/api/public/push-dispatch.ts` (public route, shared-secret header check). It:
  - Validates input with Zod (alert id, type).
  - Loads the wearer's linked active guardians and their `push_subscriptions`, respecting each guardian's per-type toggle.
  - Sends a Web Push to each endpoint.

## 5. Secrets

- Generate a VAPID key pair once. Store `VAPID_PRIVATE_KEY` and a `PUSH_DISPATCH_SECRET` as Lovable Cloud secrets; the public VAPID key is publishable and lives in code/env. I'll request these via the secure secret form during build.

## Technical notes / caveats

- **Worker runtime:** the popular `web-push` npm package is Node-only and will not run on the Cloudflare Worker backend. The dispatch endpoint will sign the VAPID JWT (ECDSA P-256) and build the request using **Web Crypto**, which is fully supported. To stay simple and Worker-safe, pushes will be sent **without an encrypted payload** (a "tickle"); the service worker shows a notification from the small `data` we pass and/or fetches the latest alert. This avoids the heavy aes128gcm payload-encryption path while still delivering real, instant notifications.
- **iOS:** web push only works on iOS 16.4+ and only after the user installs the PWA to the Home Screen — expected platform behavior, not a bug.
- **Preview:** push/SW features only run in the published app, not inside the Lovable editor preview iframe (registration is already guarded in `src/lib/pwa.ts`).
- No existing UI design, unrelated features, or current schema columns are changed — only additive tables/columns.
