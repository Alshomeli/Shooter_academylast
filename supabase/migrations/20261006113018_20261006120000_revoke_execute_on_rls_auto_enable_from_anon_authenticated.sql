-- Security audit remediation: revoke EXECUTE on public.rls_auto_enable()
-- from anon, authenticated, and PUBLIC. This SECURITY DEFINER event-trigger
-- function was callable by unauthenticated users via /rest/v1/rpc/rls_auto_enable.
-- It should only be invoked by the Postgres event-trigger system, never by
-- API clients. The function itself only enables RLS on new public-schema tables
-- (defensive, not destructive), but exposing any SECURITY DEFINER function
-- to anon is an unnecessary privilege-escalation surface.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
