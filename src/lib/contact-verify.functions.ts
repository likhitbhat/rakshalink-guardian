import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2";

const InputSchema = z.object({
  contactId: z.string().uuid(),
});

type VerifySmsResult = {
  status: "sent" | "failed";
  error?: string;
};

/**
 * Sends a verification/test SMS to an emergency contact via Fast2SMS.
 * Records the delivery status on the contact's `last_sms_status`.
 */
export const sendContactVerificationSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<VerifySmsResult> => {
    const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
    if (!FAST2SMS_API_KEY) throw new Error("FAST2SMS_API_KEY is not configured");

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

    // Fast2SMS "q" route expects a 10-digit Indian number without the country code.
    const parsed = contact.phone.startsWith("+")
      ? parsePhoneNumberFromString(contact.phone)
      : parsePhoneNumberFromString(contact.phone, "IN");
    if (!parsed || !parsed.isValid()) {
      await supabaseAdmin
        .from("emergency_contacts")
        .update({ last_sms_status: "failed: invalid phone" })
        .eq("id", contact.id);
      return { status: "failed", error: "Invalid phone number format" };
    }
    const numbers = parsed.nationalNumber.toString();

    const message = `Hi ${contact.name}, ${wearerName} added you as an emergency contact on RakshaLink. Reply YES to confirm. You will be notified if they need help.`;

    try {
      const body = new URLSearchParams({
        route: "q",
        message,
        numbers,
        flash: "0",
      });
      const res = await fetch(FAST2SMS_URL, {
        method: "POST",
        headers: {
          authorization: FAST2SMS_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const json: any = await res.json().catch(() => ({}));
      const ok = res.ok && json?.return === true;
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
