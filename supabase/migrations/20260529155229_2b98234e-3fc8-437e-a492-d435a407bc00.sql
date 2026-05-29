DROP POLICY IF EXISTS "guardian updates own links" ON public.guardian_links;

CREATE POLICY "wearer updates own links"
ON public.guardian_links
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);