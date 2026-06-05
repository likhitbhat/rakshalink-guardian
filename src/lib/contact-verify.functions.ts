import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const InputSchema = z.object({
  contactId: z.string().uuid(),
});

type VerifySmsResult = {
  status: "sent" | "failed";
  error?: string;
};

function normalizePhone(raw: string): { e164: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const parsed = trimmed.startsWith("+")
    ? parsePhoneNumberFromString(trimmed)
    : parsePhoneNumberFromString(trimmed, "IN");
  if (!parsed || !parsed.isValid()) return null;
  return { e164: parsed.number };
}

/**
 * Sends a verification/test SMS to an emergency contact via Twilio.
 * Records the delivery status on the contact's `last_sms_status`.
 */
export const sendContactVerificationSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<VerifySmsResult> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");
    const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
    if (!TWILIO_FROM_NUMBER) throw new Error("TWILIO_FROM_NUMBER is not configured");

    const { userId } = context;

    const { data: contact, error: cErr } = await supabaseAdmin
      .from("emergency_contacts")
      .select("id, name, phone, user_id")
      .eq("id", data.contactId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contact || contact.user_id !== userId) throw new Error("Contact not found");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const wearerName = profile?.full_name ?? "A RakshaLink user";

    const normalized = normalizePhone(contact.phone || "");
    if (!normalized) {
      await supabaseAdmin
        .from("emergency_contacts")
        .update({ last_sms_status: "failed: invalid phone" })
        .eq("id", contact.id);
      return { status: "failed", error: "Invalid phone number format" };
    }

    const message = `Hi ${contact.name}, ${wearerName} added you as an emergency contact on RakshaLink. Reply YES to confirm. You will be notified if they need help.`;

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
      const ok = res.ok && json?.sid;
      const statusText = ok
        ? `sent ${new Date().toISOString()}`
        : `failed: ${json?.message ? String(json.message) : `HTTP ${res.status}`}`;

      await supabaseAdmin
        .from("emergency_contacts")
        .update({ last_sms_status: statusText })
        .eq("id", contact.id);

      if (ok) return { status: "sent" };
      return { status: "failed", error: statusText };
    } catch (e: any) {
      const statusText = `failed: ${e?.message ?? "network error"}`;
      await supabaseAdmin
        .from("emergency_contacts")
        .update({ last_sms_status: statusText })
        .eq("id", contact.id);
      return { status: "failed", error: statusText };
    }
  });
