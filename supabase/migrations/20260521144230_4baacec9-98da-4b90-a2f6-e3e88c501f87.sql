-- Allow guardians to view and manage safe zones for users they are linked to as active guardian
CREATE POLICY "guardian views safe zones"
ON public.safe_zones
FOR SELECT
USING (public.is_guardian_of(auth.uid(), user_id));

CREATE POLICY "guardian inserts safe zones"
ON public.safe_zones
FOR INSERT
WITH CHECK (public.is_guardian_of(auth.uid(), user_id));

CREATE POLICY "guardian updates safe zones"
ON public.safe_zones
FOR UPDATE
USING (public.is_guardian_of(auth.uid(), user_id))
WITH CHECK (public.is_guardian_of(auth.uid(), user_id));

CREATE POLICY "guardian deletes safe zones"
ON public.safe_zones
FOR DELETE
USING (public.is_guardian_of(auth.uid(), user_id));