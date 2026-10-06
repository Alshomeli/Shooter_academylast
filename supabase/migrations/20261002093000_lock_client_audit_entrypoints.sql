-- Client audit hardening.
-- Generic operational audit writes are not used by the current UI, so disable the
-- client-controlled operational audit endpoint. Login audit remains available
-- through its public wrapper because the login UI records a sign-in event there.
-- Authenticated clients must never call either internal implementation directly.

revoke all on function internal.record_client_audit_log(text,text) from public, anon, authenticated;
revoke all on function internal.record_client_login_audit(text,text) from public, anon, authenticated;

revoke all on function public.record_audit_log(text,text) from public, anon, authenticated;

revoke all on function public.record_login_audit_log(text,text) from public, anon;
grant execute on function public.record_login_audit_log(text,text) to authenticated;
