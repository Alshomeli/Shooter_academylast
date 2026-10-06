/*
# Add INSERT policy for managers to create staff records

1. Problem
   The only INSERT policy on `staff` is `self_register_staff`, which requires
   `id = auth.uid()::text`, `status = 'pending'`, `role != 'manager'`,
   `salary = 0`, and `email = own email`. A manager cannot add a new coach,
   accountant, or receptionist through the app. When `syncStaff` does a batch
   upsert and one new row fails this policy, the entire batch fails — including
   updates to existing staff — so the user sees edits revert.

2. Change
   - Add `insert_staff_manager` policy allowing managers to INSERT any staff
     record.
   - Set `user_id` default to `NULL` instead of `auth.uid()` so new records
     created by a manager are not linked to the manager's own auth account.
     The `claim_staff_record` trigger will link the record to the correct
     account when that person registers.
   - Update `self_register_staff` to explicitly require `user_id = auth.uid()`
     (unchanged behavior, just explicit since the default changed).

3. Security
   - Only managers can INSERT new staff.
   - Self-registration still works (user_id must be auth.uid()).
   - New staff created by managers have user_id = NULL until the real person
     registers and the trigger claims the record.
*/

-- 1. Change column default from auth.uid() to NULL
ALTER TABLE public.staff ALTER COLUMN user_id SET DEFAULT NULL;

-- 2. Add INSERT policy for managers
DROP POLICY IF EXISTS "insert_staff_manager" ON public.staff;
CREATE POLICY "insert_staff_manager"
ON public.staff FOR INSERT
TO authenticated
WITH CHECK (internal.has_role(ARRAY['manager']));

-- 3. Re-create self_register_staff to be explicit about user_id (default is now NULL)
DROP POLICY IF EXISTS "self_register_staff" ON public.staff;
CREATE POLICY "self_register_staff"
ON public.staff FOR INSERT
TO authenticated
WITH CHECK (
  id = ((SELECT auth.uid() AS uid))::text
  AND status = 'pending'
  AND role = ANY (ARRAY['coach','receptionist','accountant','parent'])
  AND COALESCE(salary, 0::numeric) = 0::numeric
  AND lower(email) = lower((SELECT auth.jwt() ->> 'email'))
  AND user_id = (SELECT auth.uid())
);
