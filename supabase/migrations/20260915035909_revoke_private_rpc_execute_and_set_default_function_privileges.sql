REVOKE EXECUTE ON FUNCTION public.get_parent_private() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_player_private() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_staff_private() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_private() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_private() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_private() TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA internal REVOKE EXECUTE ON FUNCTIONS FROM public, anon, authenticated;
