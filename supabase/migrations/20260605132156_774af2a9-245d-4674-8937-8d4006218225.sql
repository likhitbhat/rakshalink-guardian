ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS alert_sounds boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vibration boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_volume integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS quiet_hours_start text NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end text NOT NULL DEFAULT '07:00';