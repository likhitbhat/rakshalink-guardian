CREATE OR REPLACE FUNCTION public.guardian_add_alert_note(_alert_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _author text;
BEGIN
  SELECT coalesce(full_name, 'Guardian') INTO _author FROM public.profiles WHERE id = auth.uid();
  UPDATE public.emergency_alerts a
  SET notes = coalesce(a.notes, '') || E'\n' || '[Note ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' by ' || coalesce(_author, 'Guardian') || '] ' || _note
  WHERE a.id = _alert_id
    AND public.is_guardian_of(auth.uid(), a.user_id);
END;
$$;