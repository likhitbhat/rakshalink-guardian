import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { guardianAlert } from "@/lib/feedback";

/**
 * Plays an urgent alert sound + vibration whenever a wearer this guardian
 * watches triggers a new SOS or fall alert (via Supabase Realtime). Honours
 * the guardian's quiet-hours and sound/vibration preferences (handled inside
 * `guardianAlert`). Mount once in the guardian layout.
 */
export function GuardianAlertSound() {
  const { user } = useAuth();
  const wearerIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let active = true;

    supabase
      .from("guardian_links")
      .select("user_id")
      .eq("guardian_id", user.id)
      .eq("status", "active")
      .then(({ data }) => {
        if (!active) return;
        wearerIds.current = new Set((data ?? []).map((l) => l.user_id));
      });

    const ch = supabase
      .channel("guardian-alert-sound")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergency_alerts" },
        (payload) => {
          const row = payload.new as { user_id?: string; type?: string };
          if (!row?.user_id || !wearerIds.current.has(row.user_id)) return;
          if (row.type === "sos" || row.type === "fall") guardianAlert();
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return null;
}
