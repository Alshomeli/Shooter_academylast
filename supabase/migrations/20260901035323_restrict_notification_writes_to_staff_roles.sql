/*
  # Restrict notification writes to staff roles

  1. Problem
     - UPDATE and DELETE on `notifications` used `is_active_member()` with no role
       or ownership test, so any approved account (including a `parent` account)
       could edit or erase academy-wide reminders.

  2. Change
     - UPDATE and DELETE now require manager, coach, receptionist or accountant.
     - SELECT is unchanged; INSERT keeps the same role list so the reminder
       generator continues to work for staff sessions.
*/

DROP POLICY IF EXISTS "update_notifications_active" ON public.notifications;

CREATE POLICY "update_notifications_staff_roles"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach', 'receptionist', 'accountant']))
  WITH CHECK (has_role(ARRAY['manager', 'coach', 'receptionist', 'accountant']));

DROP POLICY IF EXISTS "delete_notifications_active" ON public.notifications;

CREATE POLICY "delete_notifications_staff_roles"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach', 'receptionist', 'accountant']));
