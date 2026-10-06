/*
  # Trustworthy login audit trail

  1. Changes
    - Add a trigger that stamps the actor name, role and timestamp on every
      login_audit_logs row from the caller's own session instead of the request body.
    - Require an authenticated session to insert at all.
*/

CREATE OR REPLACE FUNCTION public.stamp_login_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text := lower(auth.jwt() ->> 'email');
  caller_name text;
  caller_role text;
BEGIN
  SELECT s.name, s.role INTO caller_name, caller_role
  FROM public.staff s
  WHERE lower(s.email) = caller_email
  LIMIT 1;

  NEW.user_name := coalesce(caller_name, caller_email, 'unknown');
  NEW.user_role := coalesce(caller_role, 'unknown');
  NEW.timestamp := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_login_audit_log_trigger ON public.login_audit_logs;
CREATE TRIGGER stamp_login_audit_log_trigger
  BEFORE INSERT ON public.login_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_login_audit_log();

DROP POLICY IF EXISTS insert_login_audit_logs_authenticated ON public.login_audit_logs;
CREATE POLICY insert_login_audit_logs_authenticated ON public.login_audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
