/*
# Bind self-registration to the signed-in email address

1. Problem
   The self-registration policy on `staff` constrained the id, status, role and
   salary of a new record but not its `email`, even though the email address is
   the key the whole permission model resolves on. A signed-in user could
   therefore create a pending record under somebody else's address, blocking
   that person from ever registering.

2. Change
   - `self_register_staff` now additionally requires the row's email to equal
     the signed-in account's email (case-insensitive).

3. Security
   - Registration records can only be created for the registrant's own address.
   - No change for the normal sign-up flow, which already submits that address.
*/

DROP POLICY IF EXISTS "self_register_staff" ON public.staff;

CREATE POLICY "self_register_staff"
ON public.staff FOR INSERT
TO authenticated
WITH CHECK (
  id = (auth.uid())::text
  AND status = 'pending'
  AND role = ANY (ARRAY['coach','receptionist','accountant','parent'])
  AND COALESCE(salary, 0::numeric) = 0::numeric
  AND lower(email) = lower(auth.jwt() ->> 'email')
);
