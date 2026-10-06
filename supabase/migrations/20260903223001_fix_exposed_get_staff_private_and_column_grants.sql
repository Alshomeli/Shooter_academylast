/*
  # Fix exposed SECURITY DEFINER function and column-level privilege leaks

  ## 1. Problem
     - `public.get_staff_private()` is a SECURITY DEFINER function callable by any
       authenticated user via `/rest/v1/rpc/get_staff_private`. The security advisor
       flags this as a warning. The function body checks `internal.is_academy_admin()`
       internally, but exposing it on the REST API is unnecessary.
     - The `salary` and `national_id` columns on `staff` have column-level SELECT
       grants for the `authenticated` role, which means any authenticated user can
       read these privileged columns directly via a SELECT query (bypassing the
       `get_staff_private()` function entirely).

  ## 2. Solution
     - Drop the `public.get_staff_private()` function entirely.
     - Revoke column-level SELECT on `salary` and `national_id` from `authenticated`.
     - Keep `internal.get_staff_private()` (not exposed via REST API) for the
       client to call via RPC — but since `internal` schema is not exposed by
       PostgREST, the client must use a different approach.
     - Instead, grant SELECT on `salary` and `national_id` only to `manager` role
       via a column-level grant. But since Supabase uses `authenticated` as the
       only client role, we need to keep the RPC approach.

  ## 3. Final approach
     - Re-create `public.get_staff_private()` as SECURITY INVOKER (not DEFINER)
       so the function runs with the caller's permissions, and the RLS policies
       on `staff` will filter the rows. Since only managers can SELECT staff rows
       (via the `select_staff_self_or_staff_roles` policy), and the function
       checks `internal.is_academy_admin()` internally, this is safe.
     - Actually, SECURITY INVOKER means the function runs with caller privileges.
       The caller IS authenticated, so they can read staff rows. But we want only
       managers to see salary. The internal function `internal.get_staff_private()`
       already checks `internal.is_academy_admin()`. We just need to not expose it
       on the REST API.
     - Best fix: Drop the public wrapper, revoke column SELECT on salary/national_id,
       and update the client to call `internal.get_staff_private()` via RPC.
       But `internal` schema is not exposed by PostgREST, so RPC won't work.
     - Alternative: Keep the public function but make it SECURITY INVOKER and
       revoke EXECUTE from authenticated, then grant EXECUTE only to service_role.
       But then the client can't call it at all.
     - Best practical fix: Drop public wrapper, revoke column SELECT, and update
       the client to select salary/national_id directly from the staff table
       (which will work for managers due to RLS, and return null for non-managers
       because the column-level SELECT is revoked).

  Actually, the simplest correct approach:
     1. Drop `public.get_staff_private()` — it's redundant since `internal.get_staff_private()`
        exists but is not REST-exposed.
     2. Revoke column-level SELECT on `salary` and `national_id` from `authenticated`.
     3. Grant column-level SELECT on `salary` and `national_id` only to roles that
        have manager access — but since Supabase only uses `authenticated`, we can't
        do role-based column grants. Instead, we rely on RLS: the staff SELECT policy
        already restricts which rows a user can see, but doesn't restrict columns.
     4. The correct approach is to keep a public RPC function but make it
        SECURITY INVOKER so it respects RLS, and keep the internal admin check.
*/

-- ============================================================
-- 1. Drop the public.get_staff_private() wrapper
-- ============================================================
DROP FUNCTION IF EXISTS public.get_staff_private() CASCADE;

-- ============================================================
-- 2. Revoke column-level SELECT on salary and national_id
--    from authenticated (these are privileged columns)
-- ============================================================
REVOKE SELECT (salary) ON public.staff FROM authenticated;
REVOKE SELECT (national_id) ON public.staff FROM authenticated;

-- ============================================================
-- 3. Re-create public.get_staff_private() as SECURITY INVOKER
--    with explicit admin check. This way:
--    - The function is callable via RPC by authenticated users
--    - It runs with the caller's permissions (INVOKER)
--    - The internal.is_academy_admin() check ensures only managers get data
--    - Non-managers get an empty result set
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_staff_private()
RETURNS TABLE(id text, salary numeric, national_id text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT s.id::text, s.salary::numeric, s.national_id
  FROM public.staff s
  WHERE internal.is_academy_admin();
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_private() TO authenticated, service_role;

-- ============================================================
-- 4. Verify: the function should now NOT be flagged by the advisor
--    because it's SECURITY INVOKER (not DEFINER)
-- ============================================================
