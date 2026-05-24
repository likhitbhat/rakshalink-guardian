CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL PRIMARY KEY,
  theme text NOT NULL DEFAULT 'dark',
  language text NOT NULL DEFAULT 'en',
  notifications boolean NOT NULL DEFAULT true,
  quiet_hours boolean NOT NULL DEFAULT false,
  share_location boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own prefs" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own prefs" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own prefs" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own prefs" ON public.user_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();