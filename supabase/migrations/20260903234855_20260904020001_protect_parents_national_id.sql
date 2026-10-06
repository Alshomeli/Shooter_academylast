/*
  # Remediation 2: Protect parents.national_id

  ## Problem
     `authenticated` has table-level SELECT on `public.parents`, making
     `national_id` readable by ANY authenticated user (coach, receptionist,
     accountant, parent). Table-level SELECT overrides column-level REVOKE.

  ## Solution
     1. Create `public.get_parent_private()` — SECURITY DEFINER RPC that
        returns (id, national_id) only when caller is a manager
        (is_academy_admin check). Mirrors the staff pattern.
     2. Revoke table-level SELECT from `authenticated` on `public.parents`.
     3. Grant column-level SELECT on 14 non-sensitive columns only
        (national_id excluded).
     4. Revoke any residual column-level SELECT on national_id explicitly.

  ## Access policy after change
     anon            → DENIED (already no access)
     ordinary user   → DENIED (no column SELECT on national_id)
     coach           → DENIED
     receptionist    → DENIED
     accountant      → DENIED
     manager         → ALLOWED via get_parent_private() RPC only
     service_role    → ALLOWED (bypasses RLS, full table access)
     postgres        → ALLOWED (owner)

  ## What does NOT change
     - INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, MAINTAIN privileges
     - Column-level INSERT/UPDATE for all columns (including national_id)
     - RLS policies (4 existing policies unchanged)
     - Frontend (not modified in this phase)
     - Edge functions, storage, other functions
*/

-- ============================================================
-- 1. Create get_parent_private() RPC for manager-only access
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_parent_private()
RETURNS TABLE(id text, national_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'internal'
AS $function$
SELECT p.id::text, p.national_id
FROM public.parents p
WHERE internal.is_academy_admin();
$function$;

REVOKE EXECUTE ON FUNCTION public.get_parent_private() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_parent_private() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_parent_private() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_private() TO service_role;

-- ============================================================
-- 2. Revoke table-level SELECT from authenticated
-- ============================================================
REVOKE SELECT ON public.parents FROM authenticated;

-- ============================================================
-- 3. Grant column-level SELECT on 14 non-sensitive columns only
--    (national_id is intentionally excluded)
-- ============================================================
GRANT SELECT (
  id, name, nationality, phone, whatsapp_phone, email, address,
  occupation, workplace, avatar_url, status, notes, joined_date, created_at
) ON public.parents TO authenticated;

-- ============================================================
-- 4. Explicitly revoke any residual column-level SELECT on national_id
--    (defense-in-depth; should already be false after table-level revoke)
-- ============================================================
REVOKE SELECT (national_id) ON public.parents FROM authenticated;
