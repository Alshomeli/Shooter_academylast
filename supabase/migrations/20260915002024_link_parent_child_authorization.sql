create index if not exists idx_players_parent_id on public.players(parent_id);

create policy "select_parents_own" on public.parents
for select to authenticated
using ((select internal.has_role(array['parent'])) and user_id = (select auth.uid()));

drop policy if exists "select_players_authenticated" on public.players;
create policy "select_players_authenticated" on public.players
for select to authenticated
using (
  (select internal.has_role(array['manager','accountant','coach','receptionist']))
  or (
    (select internal.has_role(array['parent']))
    and exists (
      select 1 from public.parents pa
      where pa.id = players.parent_id
        and pa.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "insert_players_authorized" on public.players;
create policy "insert_players_authorized" on public.players
for insert to authenticated
with check (
  (select internal.has_role(array['manager','coach','receptionist']))
  or (
    (select internal.has_role(array['parent']))
    and exists (
      select 1 from public.parents pa
      where pa.id = players.parent_id
        and pa.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "select_subscriptions_parent_own_children" on public.subscriptions;
create policy "select_subscriptions_parent_own_children" on public.subscriptions
for select to authenticated
using (
  (select internal.has_role(array['parent']))
  and exists (
    select 1 from public.players p
    join public.parents pa on pa.id = p.parent_id
    where p.id = subscriptions.player_id
      and pa.user_id = (select auth.uid())
  )
);

drop policy if exists "select_attendance_authenticated" on public.attendance;
create policy "select_attendance_authenticated" on public.attendance
for select to authenticated
using (
  (select internal.has_role(array['manager','accountant','coach','receptionist']))
  or (
    (select internal.has_role(array['parent']))
    and exists (
      select 1 from public.players p
      join public.parents pa on pa.id = p.parent_id
      where p.id = attendance.player_id
        and pa.user_id = (select auth.uid())
    )
  )
);
