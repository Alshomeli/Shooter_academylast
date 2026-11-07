-- Allow linked users to recognize their own disabled account.
-- Active-role helpers and all write policies remain unchanged.
create policy select_staff_own_profile on public.staff
  for select to authenticated using (user_id = (select auth.uid()));
create policy select_parents_own_profile on public.parents
  for select to authenticated using (user_id = (select auth.uid()));
