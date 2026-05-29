-- 1. Fix privilege escalation: only the wearer can create a guardian link for themselves.
DROP POLICY IF EXISTS "guardian inserts own links" ON public.guardian_links;
CREATE POLICY "wearer creates own guardian links"
ON public.guardian_links
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 2. Pin search_path on internal SECURITY DEFINER functions that lacked it.
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;

-- 3. Revoke EXECUTE on internal/trigger/RLS-helper functions from API roles.
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_guardian_of(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 4. Guardian RPCs: remove anonymous access, keep them callable by signed-in guardians.
REVOKE EXECUTE ON FUNCTION public.guardian_add_alert_note(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hide_alert_for_guardian(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hide_all_alerts_for_guardian(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardian_add_alert_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hide_alert_for_guardian(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hide_all_alerts_for_guardian(uuid) TO authenticated;

-- 5. Restrict guardian write access on safe_zones to read-only (drop write policies).
DROP POLICY IF EXISTS "guardian inserts safe zones" ON public.safe_zones;
DROP POLICY IF EXISTS "guardian updates safe zones" ON public.safe_zones;
DROP POLICY IF EXISTS "guardian deletes safe zones" ON public.safe_zones;