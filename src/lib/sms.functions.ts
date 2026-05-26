import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

/**
 * Normalize a raw phone string to E.164 (e.g. +919812345678).
 * Defaults to India ("IN") when no country code is present, preserving
 * backwards compatibility with existing 10-digit Indian numbers on file.
 */
function normalizePhone(raw: string): { e164: string; country: string | undefined } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const parsed = trimmed.startsWith("+")
    ? parsePhoneNumberFromString(trimmed)
    : parsePhoneNumberFromString(trimmed, "IN");
  if (!parsed || !parsed.isValid()) return null;
  return { e164: parsed.number, country: parsed.country };
}

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
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");
    const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
    if (!TWILIO_FROM_NUMBER) throw new Error("TWILIO_FROM_NUMBER is not configured");

    const { userId } = context;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const wearerName = profile?.full_name ?? "A RakshaLink user";

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
      const normalized = normalizePhone(c.phone || "");
      if (!normalized) {
        failed++;
        details.push({
          phone: c.phone,
          name: c.name,
          status: "failed",
          error: "Invalid phone number format",
        });
        continue;
      }

      try {
        const body = new URLSearchParams({
          To: normalized.e164,
          From: TWILIO_FROM_NUMBER,
          Body: message,
        });
        const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        });
        const json: any = await res.json().catch(() => ({}));
        if (res.ok && json?.sid) {
          sent++;
          details.push({ phone: normalized.e164, name: c.name, status: "sent" });
        } else {
          failed++;
          details.push({
            phone: normalized.e164,
            name: c.name,
            status: "failed",
            error: json?.message ? String(json.message) : `HTTP ${res.status}`,
          });
        }
      } catch (e: any) {
        failed++;
        details.push({
          phone: normalized.e164,
          name: c.name,
          status: "failed",
          error: e?.message ?? "Network error",
        });
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
