import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPush, type WebPushSubscription } from "./push.server";

const InputSchema = z.object({
  type: z.enum(["sos", "fall", "zone", "battery"]),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(300),
  alertId: z.string().uuid().optional(),
});

const PREF_COLUMN: Record<string, string> = {
  sos: "notify_sos",
  fall: "notify_fall",
  zone: "notify_zone",
  battery: "notify_battery",
};

type DispatchResult = { sent: number; failed: number; recipients: number };

// Sends a Web Push notification to all active guardians linked to the
// authenticated wearer, respecting each guardian's per-type preference.
export const notifyGuardians = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<DispatchResult> => {
    const { userId } = context;

    const { data: links } = await supabaseAdmin
      .from("guardian_links")
      .select("guardian_id")
      .eq("user_id", userId)
      .eq("status", "active");

    const guardianIds = (links ?? []).map((l) => l.guardian_id);
    if (guardianIds.length === 0) return { sent: 0, failed: 0, recipients: 0 };

    // Respect per-guardian preference for this notification type.
    const prefColumn = PREF_COLUMN[data.type];
    const { data: prefs } = await supabaseAdmin
      .from("user_preferences")
      .select(`user_id, notifications, ${prefColumn}`)
      .in("user_id", guardianIds);

    const allowed = new Set(
      (prefs ?? [])
        .filter((p: any) => p.notifications !== false && p[prefColumn] !== false)
        .map((p: any) => p.user_id as string),
    );
    // Guardians with no preferences row default to enabled.
    const prefUserIds = new Set((prefs ?? []).map((p: any) => p.user_id as string));
    const recipients = guardianIds.filter((id) => allowed.has(id) || !prefUserIds.has(id));
    if (recipients.length === 0) return { sent: 0, failed: 0, recipients: 0 };

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", recipients);

    if (!subs || subs.length === 0) return { sent: 0, failed: 0, recipients: recipients.length };

    const url = data.alertId ? `/guardian/alerts?focus=${data.alertId}` : "/guardian/alerts";
    let sent = 0;
    let failed = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        const sub: WebPushSubscription = { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth };
        try {
          const res = await sendWebPush(sub, {
            title: data.title,
            body: data.body,
            url,
            tag: data.type,
            alertId: data.alertId,
          });
          if (res.ok) sent++;
          else {
            failed++;
            if (res.gone) stale.push(s.id);
          }
        } catch {
          failed++;
        }
      }),
    );

    if (stale.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
    }

    return { sent, failed, recipients: recipients.length };
  });

const SaveInput = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(200),
  userAgent: z.string().max(500).optional(),
});

// Stores (or refreshes) the current device's push subscription for the user.
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
        },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RemoveInput = z.object({ endpoint: z.string().url().max(1000) });

// Removes the current device's push subscription (on disable / logout).
export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RemoveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });
