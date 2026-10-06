/*
  # Store the stamped login timestamp in ISO format
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
  NEW."timestamp" := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  RETURN NEW;
END;
$$;
