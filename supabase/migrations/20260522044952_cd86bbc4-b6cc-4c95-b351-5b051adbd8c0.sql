
CREATE TYPE public.zone_event_type AS ENUM ('enter', 'exit');

CREATE TABLE public.zone_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  zone_id uuid,
  zone_name text NOT NULL,
  event public.zone_event_type NOT NULL,
  lat double precision,
  lng double precision,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_zone_events_user_created ON public.zone_events (user_id, created_at DESC);

ALTER TABLE public.zone_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages zone events"
  ON public.zone_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guardian views zone events"
  ON public.zone_events FOR SELECT
  USING (public.is_guardian_of(auth.uid(), user_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.zone_events;
ALTER TABLE public.zone_events REPLICA IDENTITY FULL;
