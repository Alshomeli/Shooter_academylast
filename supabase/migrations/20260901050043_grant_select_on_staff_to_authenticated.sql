/*
# Grant SELECT on staff table to authenticated role

1. Problem
   The `authenticated` role has INSERT, UPDATE, and DELETE privileges on the
   `staff` table, but NOT SELECT. Without SELECT, no RLS SELECT policy can
   function — the database rejects the query at the privilege level before
   RLS is even evaluated. This causes:
   - `syncTable('staff', ...)` to fail when it does `select('id')` to find
     existing rows, silently breaking all staff edits and additions.
   - `fetchStaffRows()` to fail, returning empty data.
   - The entire staff sync to fail, reverting any edits.

2. Fix
   GRANT SELECT ON public.staff TO authenticated;
*/

GRANT SELECT ON public.staff TO authenticated;
