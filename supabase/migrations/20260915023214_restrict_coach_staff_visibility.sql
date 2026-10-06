drop policy if exists select_staff_self_or_staff_roles on public.staff;
create policy select_staff_role_scoped
on public.staff
for select
to authenticated
using (
  id = (select internal.current_staff_id())
  or (select internal.has_role(array['manager','receptionist','accountant']))
);
