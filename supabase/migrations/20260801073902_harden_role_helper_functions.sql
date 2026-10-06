/*
  # Harden permission helper functions

  1. Changes
    - Make has_role, is_active_member, is_academy_admin, is_academy_member and
      current_user_role SECURITY DEFINER with a fixed search_path so they keep
      working once staff row-level read policies are narrowed.
    - Normalise every email comparison with lower() so the same account resolves
      identically in all five helpers.
  2. Security
    - Fixed search_path removes the mutable search_path lint.
*/

CREATE OR REPLACE FUNCTION public.has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
      AND staff.status = 'active'
      AND staff.role = ANY(allowed_roles)
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
      AND staff.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_academy_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
      AND staff.role = 'manager'
      AND staff.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_academy_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
      AND staff.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT staff.role
  FROM public.staff
  WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
    AND staff.status = 'active'
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_member() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_academy_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_academy_member() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
