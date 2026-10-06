/*
# Limit parent accounts to their own child's attendance

1. Problem
   The SELECT policy on `attendance` allowed any active member, including
   `parent` accounts, to read the attendance history of every child.

2. Change
   - `select_attendance_authenticated` now allows the four staff roles to read
     all rows, and a `parent` account to read only rows for a player whose
     `parent_email` matches the signed-in email address.

3. Security
   - Staff behaviour is unchanged.
   - Parent accounts can no longer read other children's attendance.
*/

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
        AND lower(p.parent_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);
