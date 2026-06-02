-- Push subscriptions for Web Push notifications
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Per-type notification toggles on existing user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notify_sos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_fall boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_zone boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_battery boolean NOT NULL DEFAULT true;