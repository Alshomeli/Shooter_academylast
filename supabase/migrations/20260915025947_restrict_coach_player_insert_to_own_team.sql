drop policy if exists insert_players_authorized on public.players;
create policy insert_players_authorized
on public.players
for insert
to authenticated
with check (
  internal.has_role(array['manager','receptionist'])
  or (
    internal.has_role(array['coach'])
    and internal.is_coach_of_team(team_id)
  )
  or (
    internal.has_role(array['parent'])
    and exists (
      select 1
      from public.parents pa
      where pa.id = players.parent_id
        and pa.user_id = (select auth.uid())
    )
  )
);
