CREATE POLICY "guardian views linked wearer profile"
ON public.profiles
FOR SELECT
USING (public.is_guardian_of(auth.uid(), id));