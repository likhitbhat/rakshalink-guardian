ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS last_sos_at timestamp with time zone;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS false_alarm_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.sos_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL,
  alert_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sos_attempts TO authenticated;
GRANT ALL ON public.sos_attempts TO service_role;

ALTER TABLE public.sos_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages sos attempts"
ON public.sos_attempts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guardian views sos attempts"
ON public.sos_attempts
FOR SELECT
USING (public.is_guardian_of(auth.uid(), user_id));

CREATE INDEX IF NOT EXISTS idx_sos_attempts_user_created
  ON public.sos_attempts (user_id, created_at DESC);
