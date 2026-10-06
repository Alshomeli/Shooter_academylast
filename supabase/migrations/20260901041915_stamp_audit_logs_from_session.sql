/*
# Stamp activity log entries from the signed-in session

1. Problem
   Rows inserted into `audit_logs` carried a client-supplied `user_name`,
   `user_role` and `timestamp`, so any active member could write entries
   attributed to somebody else at a time of their choosing. The login audit
   table already had a stamping trigger; this table did not.

2. Change
   - New function `internal.stamp_audit_log()` (SECURITY DEFINER, fixed
     search_path) that overwrites `user_name`, `user_role` and `timestamp` from
     the caller's session on INSERT and UPDATE.
   - New trigger `trg_stamp_audit_log` on `public.audit_logs`.
   - When there is no end-user session (service-role seeding), the supplied
     values are left untouched so seeding keeps working.

3. Security
   - Activity log entries can no longer be forged or back-dated by an
     authenticated user.
*/

CREATE OR REPLACE FUNCTION internal.stamp_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_email text := lower(auth.jwt() ->> 'email');
  caller_name text;
  caller_role text;
BEGIN
  -- No end-user session (e.g. service-role seeding): leave the row as provided.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.name, s.role INTO caller_name, caller_role
  FROM public.staff s
  WHERE lower(s.email) = caller_email
  LIMIT 1;

  NEW.user_name := coalesce(caller_name, caller_email, 'unknown');
  NEW.user_role := coalesce(caller_role, 'unknown');
  NEW."timestamp" := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION internal.stamp_audit_log() FROM public;
GRANT EXECUTE ON FUNCTION internal.stamp_audit_log() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_stamp_audit_log ON public.audit_logs;
CREATE TRIGGER trg_stamp_audit_log
BEFORE INSERT OR UPDATE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION internal.stamp_audit_log();
