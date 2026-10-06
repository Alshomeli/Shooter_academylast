/*
  # Keep privileged helper functions off the public API

  1. Changes
    - Revoke the default PUBLIC execute grant on every SECURITY DEFINER helper so
      unauthenticated callers cannot invoke them, and grant execute to signed-in
      users only.
*/

REVOKE EXECUTE ON FUNCTION public.has_role(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_member() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_academy_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_academy_member() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_staff_private() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stamp_login_audit_log() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_academy_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_academy_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_private() TO authenticated;
