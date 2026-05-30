import { supabase } from "@/integrations/supabase/client";

export type PostAuthPath = "/onboarding" | "/app" | "/guardian";

/**
 * Decide where to send a user right after authentication.
 * - First-time users (no phone yet) go through onboarding.
 * - Guardians land on /guardian, wearers on /app.
 */
export async function resolvePostAuthPath(userId: string): Promise<PostAuthPath> {
  const { data } = await supabase
    .from("profiles")
    .select("role, full_name, phone")
    .eq("id", userId)
    .maybeSingle();

  if (!data || !data.full_name || !data.phone) return "/onboarding";
  return data.role === "guardian" ? "/guardian" : "/app";
}
