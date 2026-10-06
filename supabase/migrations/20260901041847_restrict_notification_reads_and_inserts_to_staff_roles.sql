/*
# Restrict internal notifications to staff roles

1. Problem
   Reading and creating notifications was allowed to any active member, which
   includes `parent` accounts. The update and delete policies on the same table
   were already limited to the four staff roles.

2. Change
   - `select_notifications_authenticated` and `insert_notifications_active` now
     require one of manager, coach, receptionist or accountant.

3. Security
   - Parent accounts can no longer read the internal notification feed or inject
     notifications that staff would see.
*/

DROP POLICY IF EXISTS "select_notifications_authenticated" ON public.notifications;
CREATE POLICY "select_notifications_authenticated"
ON public.notifications FOR SELECT
TO authenticated
USING (internal.has_role(ARRAY['manager','coach','receptionist','accountant']));

DROP POLICY IF EXISTS "insert_notifications_active" ON public.notifications;
CREATE POLICY "insert_notifications_active"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (internal.has_role(ARRAY['manager','coach','receptionist','accountant']));
