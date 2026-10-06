drop index if exists public.idx_staff_email_lower;

drop policy if exists select_staff_self_or_staff_roles on public.staff;
create policy select_staff_self_or_staff_roles on public.staff
for select to authenticated
using (
  lower(email) = lower((select auth.jwt() ->> 'email'))
  or id = ((select auth.uid())::text)
  or internal.has_role(array['manager','coach','receptionist','accountant'])
);

drop policy if exists insert_staff_manager on public.staff;
drop policy if exists self_register_staff on public.staff;
create policy insert_staff_authorized on public.staff
for insert to authenticated
with check (
  internal.has_role(array['manager'])
  or (
    id = ((select auth.uid())::text)
    and status = 'pending'
    and role = any(array['coach','receptionist','accountant','parent'])
    and coalesce(salary,0) = 0
    and lower(email) = lower((select auth.jwt() ->> 'email'))
    and user_id = (select auth.uid())
  )
);

drop policy if exists insert_players_authorized on public.players;
create policy insert_players_authorized on public.players
for insert to authenticated
with check (
  internal.has_role(array['manager','coach','receptionist'])
  or (
    internal.has_role(array['parent'])
    and lower(coalesce(parent_email,'')) = lower(coalesce((select auth.jwt() ->> 'email'),''))
    and coalesce(parent_email,'') <> ''
  )
);

drop policy if exists select_players_authenticated on public.players;
create policy select_players_authenticated on public.players
for select to authenticated
using (
  internal.has_role(array['manager','accountant','coach','receptionist'])
  or (
    internal.has_role(array['parent'])
    and coalesce(parent_email,'') <> ''
    and lower(coalesce(parent_email,'')) = lower(coalesce((select auth.jwt() ->> 'email'),''))
  )
);

drop policy if exists select_attendance_authenticated on public.attendance;
create policy select_attendance_authenticated on public.attendance
for select to authenticated
using (
  internal.has_role(array['manager','accountant','coach','receptionist'])
  or (
    internal.has_role(array['parent'])
    and exists (
      select 1 from public.players p
      where p.id = attendance.player_id
        and coalesce(p.parent_email,'') <> ''
        and lower(p.parent_email) = lower(coalesce((select auth.jwt() ->> 'email'),''))
    )
  )
);
