/*
  # Harden staff sensitive columns and secure get_staff_private()

  ## Problem
     - `authenticated` has table-level SELECT on `public.staff` (granted in
       migration 20260901050043). This overrides the column-level revokes on
       `salary` and `national_id` from migration 20260903223001, making them
       readable by ANY authenticated user via direct SELECT.
     - `public.get_staff_private()` is SECURITY INVOKER (changed in
       migration 20260903223001), so it cannot read salary/national_id if
       column SELECT is revoked.
     - `public.get_staff_private()` has EXECUTE granted to anon and PUBLIC
       (the function was dropped/recreated in 20260903223001 without revoking
       default PUBLIC EXECUTE).

  ## Solution
     1. Revoke table-level SELECT from `authenticated` on `public.staff`.
     2. Grant column-level SELECT on 16 non-sensitive columns only.
     3. Change `public.get_staff_private()` to SECURITY DEFINER so it can
        read salary/national_id as the postgres owner.
     4. Set search_path to `public, internal` (no pg_temp, no attacker-writable
        schemas).
     5. Revoke EXECUTE from `anon` and `PUBLIC`.
     6. Grant EXECUTE to `authenticated` and `service_role` only.

  ## What does NOT change
     - INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, MAINTAIN privileges
     - Column-level INSERT/UPDATE for all columns
     - RLS policies (5 existing policies unchanged)
     - service_role and postgres privileges
     - No data, no auth users, no frontend files
*/

-- ============================================================
-- 1. Revoke table-level SELECT from authenticated
-- ============================================================
REVOKE SELECT ON public.staff FROM authenticated;

-- ============================================================
-- 2. Grant column-level SELECT on 16 non-sensitive columns only
--    (salary and national_id are intentionally excluded)
-- ============================================================
GRANT SELECT (
  id, name, email, phone, role, specialization, status,
  joined_date, avatar_url, licenses, experience_years, rating,
  tactical_style, notes, user_id, created_at
) ON public.staff TO authenticated;

-- ============================================================
-- 3. Make public.get_staff_private() SECURITY DEFINER
--    so it can read salary/national_id as the postgres owner
-- ============================================================
ALTER FUNCTION public.get_staff_private() SECURITY DEFINER;

-- ============================================================
-- 4. Set search_path to public, internal (no pg_temp)
-- ============================================================
ALTER FUNCTION public.get_staff_private() SET search_path TO 'public', 'internal';

-- ============================================================
-- 5. Revoke EXECUTE from anon and PUBLIC
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_staff_private() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_staff_private() FROM PUBLIC;

-- ============================================================
-- 6. Grant EXECUTE to authenticated and service_role only
--    (postgres retains EXECUTE as owner)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_staff_private() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_private() TO service_role;
