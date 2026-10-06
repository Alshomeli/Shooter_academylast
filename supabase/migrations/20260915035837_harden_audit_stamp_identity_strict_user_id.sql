CREATE OR REPLACE FUNCTION internal.stamp_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (select auth.uid());
  caller_email text := lower(auth.jwt() ->> 'email');
  caller_name text;
  caller_role text;
BEGIN
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.name, s.role
    INTO caller_name, caller_role
  FROM public.staff s
  WHERE s.user_id = caller_id
    AND s.status = 'active'
  LIMIT 1;

  IF caller_name IS NULL THEN
    SELECT p.name, 'parent'
      INTO caller_name, caller_role
    FROM public.parents p
    WHERE p.user_id = caller_id
      AND p.status = 'active'
    LIMIT 1;
  END IF;

  NEW.user_name := coalesce(caller_name, caller_email, 'unknown');
  NEW.user_role := coalesce(caller_role, 'unknown');
  NEW."timestamp" := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION internal.stamp_login_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (select auth.uid());
  caller_email text := lower(auth.jwt() ->> 'email');
  caller_name text;
  caller_role text;
BEGIN
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.name, s.role
    INTO caller_name, caller_role
  FROM public.staff s
  WHERE s.user_id = caller_id
    AND s.status = 'active'
  LIMIT 1;

  IF caller_name IS NULL THEN
    SELECT p.name, 'parent'
      INTO caller_name, caller_role
    FROM public.parents p
    WHERE p.user_id = caller_id
      AND p.status = 'active'
    LIMIT 1;
  END IF;

  NEW.user_name := coalesce(caller_name, caller_email, 'unknown');
  NEW.user_role := coalesce(caller_role, 'unknown');
  NEW."timestamp" := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION internal.stamp_audit_log() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internal.stamp_login_audit_log() FROM public, anon, authenticated;
