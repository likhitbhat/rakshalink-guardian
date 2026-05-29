ALTER TABLE public.emergency_alerts
  ADD COLUMN IF NOT EXISTS hidden_by_owner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_by_guardian boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.hide_alert_for_guardian(_alert_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.emergency_alerts a
  SET hidden_by_guardian = true
  WHERE a.id = _alert_id
    AND public.is_guardian_of(auth.uid(), a.user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.hide_all_alerts_for_guardian(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.emergency_alerts a
  SET hidden_by_guardian = true
  WHERE a.user_id = _user_id
    AND public.is_guardian_of(auth.uid(), a.user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hide_alert_for_guardian(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hide_all_alerts_for_guardian(uuid) TO authenticated;