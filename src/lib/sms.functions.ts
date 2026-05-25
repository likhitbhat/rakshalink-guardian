import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  alertId: z.string().uuid(),
  alertType: z.enum(["sos", "fall", "voice", "deadman", "manual"]),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

type SmsResult = {
  sent: number;
  failed: number;
  total: number;
  details: Array<{ phone: string; name: string; status: "sent" | "failed"; error?: string }>;
};

export const sendEmergencySms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SmsResult> => {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) throw new Error("FAST2SMS_API_KEY is not configured");

    const { userId } = context;

    // Get wearer name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const wearerName = profile?.full_name ?? "A RakshaLink user";

    // Get contacts
    const { data: contacts, error: cErr } = await supabaseAdmin
      .from("emergency_contacts")
      .select("name, phone")
      .eq("user_id", userId);
    if (cErr) throw new Error(cErr.message);

    const timestamp = new Date().toLocaleString();
    const locUrl =
      data.lat != null && data.lng != null
        ? `https://maps.google.com/?q=${data.lat},${data.lng}`
        : "location unavailable";
    const message = `EMERGENCY ALERT: ${wearerName} needs help! Location: ${locUrl} Time: ${timestamp} - RakshaLink Safety System`;

    const details: SmsResult["details"] = [];
    let sent = 0;
    let failed = 0;

    for (const c of contacts ?? []) {
      const phone = (c.phone || "").replace(/\D/g, "").slice(-10);
      if (phone.length !== 10) {
        failed++;
        details.push({ phone: c.phone, name: c.name, status: "failed", error: "Invalid phone" });
        continue;
      }
      try {
        const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(apiKey)}&route=q&message=${encodeURIComponent(message)}&flash=0&numbers=${phone}`;
        const res = await fetch(url, { method: "GET" });
        const json: any = await res.json().catch(() => ({}));
        if (res.ok && json?.return === true) {
          sent++;
          details.push({ phone: c.phone, name: c.name, status: "sent" });
        } else {
          failed++;
          details.push({
            phone: c.phone,
            name: c.name,
            status: "failed",
            error: json?.message ? String(json.message) : `HTTP ${res.status}`,
          });
        }
      } catch (e: any) {
        failed++;
        details.push({ phone: c.phone, name: c.name, status: "failed", error: e?.message ?? "Network error" });
      }
    }

    const total = (contacts ?? []).length;
    const noteLines = [
      `[SMS ${new Date().toISOString()}] ${sent}/${total} delivered, ${failed} failed.`,
      ...details.map(
        (d) => `  - ${d.name} (${d.phone}): ${d.status}${d.error ? ` — ${d.error}` : ""}`,
      ),
    ];
    const noteAppend = noteLines.join("\n");

    // Append to alert notes
    const { data: existing } = await supabaseAdmin
      .from("emergency_alerts")
      .select("notes, user_id")
      .eq("id", data.alertId)
      .maybeSingle();
    if (existing && existing.user_id === userId) {
      const newNotes = existing.notes ? `${existing.notes}\n${noteAppend}` : noteAppend;
      await supabaseAdmin
        .from("emergency_alerts")
        .update({ notes: newNotes })
        .eq("id", data.alertId);
    }

    return { sent, failed, total, details };
  });
