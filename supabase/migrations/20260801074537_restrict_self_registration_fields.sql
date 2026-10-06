/*
  # Restrict what a self-registered account may claim

  1. Changes
    - Self registration can no longer request the manager role or set a salary;
      the row must belong to the caller and stay pending until a manager approves it.
*/

DROP POLICY IF EXISTS self_register_staff ON public.staff;
CREATE POLICY self_register_staff ON public.staff FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()::text
    AND status = 'pending'
    AND role IN ('coach','receptionist','accountant','parent')
    AND coalesce(salary, 0) = 0
  );
