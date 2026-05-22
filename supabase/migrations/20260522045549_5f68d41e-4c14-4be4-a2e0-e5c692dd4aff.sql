
REVOKE EXECUTE ON FUNCTION public.is_guardian_of(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_guardian_of(uuid, uuid) TO authenticated;
