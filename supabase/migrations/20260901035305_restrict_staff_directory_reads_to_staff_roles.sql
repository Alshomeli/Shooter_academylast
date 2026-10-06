/*
  # Restrict staff directory reads to staff roles

  1. Problem
     - `select_staff_authenticated` ended in `OR is_active_member()`, which has no
       role test, so any approved account (including a `parent` account) could read
       every employee row.

  2. Change
     - Self-access is preserved (needed by the sign-in flow and by pending accounts
       reading their own row); the broad member clause is replaced with an explicit
       role list.

  3. Notes
     - `salary` and `national_id` already have column-level SELECT revoked.
*/

DROP POLICY IF EXISTS "select_staff_authenticated" ON public.staff;

CREATE POLICY "select_staff_self_or_staff_roles"
  ON public.staff FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
    OR id = (auth.uid())::text
    OR has_role(ARRAY['manager', 'coach', 'receptionist', 'accountant'])
  );
