/*
# Wrap auth function calls in (select ...) for RLS performance

1. Problem
   Five RLS policies call `auth.uid()` or `auth.jwt()` directly in their
   predicate, causing the database to re-evaluate the function for every row
   scanned. The Supabase performance advisor flags these as
   `auth_rls_initplan`.

2. Change
   - Rewrites the five affected policies to wrap auth calls in a scalar
     subquery so the value is computed once per statement.
   - Affected policies: `select_staff_self_or_staff_roles`,
     `self_register_staff`, `select_players_authenticated`,
     `select_attendance_authenticated`,
     `insert_login_audit_logs_authenticated`.

3. Security
   - No access-control change. The predicates are logically identical.
*/

-- 1. staff SELECT
DROP POLICY IF EXISTS "select_staff_self_or_staff_roles" ON public.staff;
CREATE POLICY "select_staff_self_or_staff_roles"
ON public.staff FOR SELECT
TO authenticated
USING (
  lower(email) = lower((select auth.jwt() ->> 'email'))
  OR id = ((select auth.uid()))::text
  OR internal.has_role(ARRAY['manager','coach','receptionist','accountant'])
);

-- 2. staff INSERT (self-register)
DROP POLICY IF EXISTS "self_register_staff" ON public.staff;
CREATE POLICY "self_register_staff"
ON public.staff FOR INSERT
TO authenticated
WITH CHECK (
  id = ((select auth.uid()))::text
  AND status = 'pending'
  AND role = ANY (ARRAY['coach','receptionist','accountant','parent'])
  AND COALESCE(salary, 0::numeric) = 0::numeric
  AND lower(email) = lower((select auth.jwt() ->> 'email'))
  AND user_id = (select auth.uid())
);

-- 3. players SELECT
DROP POLICY IF EXISTS "select_players_authenticated" ON public.players;
CREATE POLICY "select_players_authenticated"
ON public.players FOR SELECT
TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','coach','receptionist'])
  OR (
    internal.has_role(ARRAY['parent'])
    AND coalesce(parent_email, '') <> ''
    AND lower(coalesce(parent_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

-- 4. attendance SELECT
DROP POLICY IF EXISTS "select_attendance_authenticated" ON public.attendance;
CREATE POLICY "select_attendance_authenticated"
ON public.attendance FOR SELECT
TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','coach','receptionist'])
  OR (
    internal.has_role(ARRAY['parent'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = attendance.player_id
        AND coalesce(p.parent_email, '') <> ''
        AND lower(p.parent_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    )
  )
);

-- 5. login_audit_logs INSERT
DROP POLICY IF EXISTS "insert_login_audit_logs_authenticated" ON public.login_audit_logs;
CREATE POLICY "insert_login_audit_logs_authenticated"
ON public.login_audit_logs FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);
