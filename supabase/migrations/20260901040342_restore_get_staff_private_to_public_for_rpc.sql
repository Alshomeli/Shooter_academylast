/*
  # Restore get_staff_private to public schema for RPC access

  1. Problem
     - The client calls `supabase.rpc('get_staff_private')` which requires the
       function to be in the `public` schema (exposed by PostgREST).
     - The function was moved to `internal` in the previous migration, breaking
       the client call.

  2. Solution
     - Create a public SECURITY DEFINER wrapper that delegates to the internal
       version. The function is intentionally exposed via RPC because the client
       needs it — but it already gates access to managers only via
       `internal.is_academy_admin()`.
     - Revoke EXECUTE from `anon` as an extra precaution.

  3. Notes
     - The security linter will still flag this function, but the exposure is
       intentional and the function has its own authorization check.
*/

CREATE OR REPLACE FUNCTION public.get_staff_private()
RETURNS TABLE(id text, salary numeric, national_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT s.id, s.salary::numeric, s.national_id
FROM public.staff s
WHERE internal.is_academy_admin();
$$;

REVOKE EXECUTE ON FUNCTION public.get_staff_private() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_staff_private() TO authenticated, service_role;
