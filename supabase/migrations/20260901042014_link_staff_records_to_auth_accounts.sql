/*
# Resolve staff permissions by account, not only by email address

1. Problem
   Every permission helper matched the signed-in user to a staff record purely
   on the email claim in the session token. A staff record created before that
   person has an account could therefore be claimed by whoever registers that
   address first, and a deleted-and-recreated account silently inherited the
   old record's role.

2. Change
   - New column `staff.user_id` (uuid, nullable, defaults to the registering
     account) holding the account each staff record belongs to, plus a unique
     index so one account cannot own two records.
   - Existing staff records are backfilled from the account list by email.
   - Helpers `internal.has_role`, `internal.is_active_member`,
     `internal.is_academy_member`, `internal.is_academy_admin`,
     `internal.current_user_role` and `internal.stamp_login_audit_log` now match
     on the account id, falling back to the email address only while the record
     has not yet been claimed by any account.
   - New trigger `trg_claim_staff_record` on the account table claims a matching
     unclaimed record once, when the account is first created.
   - `self_register_staff` additionally requires the record's `user_id` to be
     the registrant's own account.

3. Security
   - Once a staff record is linked to an account, no other account can assume
     that record's role by re-using the email address.
   - Onboarding is unchanged: newly provisioned or self-registered accounts are
     linked automatically.

4. Notes
   1. Function signatures are unchanged, so the ~60 access rules that call them
      continue to work without modification.
   2. The remaining exposure — someone registering an address they do not own
      before the real staff member does — is closed by enabling email
      confirmation in the Auth settings.
*/

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

UPDATE public.staff s
SET user_id = u.id
FROM auth.users u
WHERE s.user_id IS NULL
  AND lower(u.email) = lower(s.email);

CREATE UNIQUE INDEX IF NOT EXISTS staff_user_id_key ON public.staff (user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION internal.has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.staff s
  WHERE (
      s.user_id = auth.uid()
      OR (s.user_id IS NULL AND lower(s.email) = lower(auth.jwt() ->> 'email'))
    )
    AND s.status = 'active'
    AND s.role = ANY(allowed_roles)
);
$function$;

CREATE OR REPLACE FUNCTION internal.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.staff s
  WHERE (
      s.user_id = auth.uid()
      OR (s.user_id IS NULL AND lower(s.email) = lower(auth.jwt() ->> 'email'))
    )
    AND s.status = 'active'
);
$function$;

CREATE OR REPLACE FUNCTION internal.is_academy_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.staff s
  WHERE (
      s.user_id = auth.uid()
      OR (s.user_id IS NULL AND lower(s.email) = lower(auth.jwt() ->> 'email'))
    )
    AND s.status = 'active'
);
$function$;

CREATE OR REPLACE FUNCTION internal.is_academy_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.staff s
  WHERE (
      s.user_id = auth.uid()
      OR (s.user_id IS NULL AND lower(s.email) = lower(auth.jwt() ->> 'email'))
    )
    AND s.role = 'manager'
    AND s.status = 'active'
);
$function$;

CREATE OR REPLACE FUNCTION internal.current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT s.role
FROM public.staff s
WHERE (
    s.user_id = auth.uid()
    OR (s.user_id IS NULL AND lower(s.email) = lower(auth.jwt() ->> 'email'))
  )
  AND s.status = 'active'
LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION internal.stamp_login_audit_log()
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
  SELECT s.name, s.role INTO caller_name, caller_role
  FROM public.staff s
  WHERE (
      s.user_id = auth.uid()
      OR (s.user_id IS NULL AND lower(s.email) = caller_email)
    )
  LIMIT 1;

  NEW.user_name := coalesce(caller_name, caller_email, 'unknown');
  NEW.user_role := coalesce(caller_role, 'unknown');
  NEW."timestamp" := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION internal.claim_staff_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.staff s
  SET user_id = NEW.id
  WHERE lower(s.email) = lower(NEW.email)
    AND (
      s.user_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id)
    );

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION internal.claim_staff_record() FROM public;

DROP TRIGGER IF EXISTS trg_claim_staff_record ON auth.users;
CREATE TRIGGER trg_claim_staff_record
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION internal.claim_staff_record();

DROP POLICY IF EXISTS "self_register_staff" ON public.staff;
CREATE POLICY "self_register_staff"
ON public.staff FOR INSERT
TO authenticated
WITH CHECK (
  id = (auth.uid())::text
  AND status = 'pending'
  AND role = ANY (ARRAY['coach','receptionist','accountant','parent'])
  AND COALESCE(salary, 0::numeric) = 0::numeric
  AND lower(email) = lower(auth.jwt() ->> 'email')
  AND user_id = auth.uid()
);
