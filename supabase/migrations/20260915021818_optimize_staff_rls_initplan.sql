drop policy if exists insert_staff_authorized on public.staff;
create policy insert_staff_authorized on public.staff
for insert to authenticated
with check (
  (select internal.has_role(ARRAY['manager'::text]))
  OR (
    id = ((select auth.uid())::text)
    AND status = 'pending'
    AND role = ANY (ARRAY['coach'::text,'receptionist'::text,'accountant'::text,'parent'::text])
    AND coalesce(salary,0) = 0
    AND lower(email) = lower((select auth.jwt()->>'email'))
    AND user_id = (select auth.uid())
  )
);

drop policy if exists select_staff_self_or_staff_roles on public.staff;
create policy select_staff_self_or_staff_roles on public.staff
for select to authenticated
using (
  lower(email) = lower((select auth.jwt()->>'email'))
  OR id = ((select auth.uid())::text)
  OR (select internal.has_role(ARRAY['manager'::text,'coach'::text,'receptionist'::text,'accountant'::text]))
);
