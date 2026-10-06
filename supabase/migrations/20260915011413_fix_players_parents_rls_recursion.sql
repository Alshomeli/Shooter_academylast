create or replace function internal.is_parent_of_player(p_player_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, internal
as $$
begin
  if p_player_id is null or nullif(trim(p_player_id),'') is null then
    return false;
  end if;
  return exists (
    select 1
    from public.players p
    join public.parents pa on pa.id = p.parent_id
    where p.id = p_player_id
      and pa.user_id = (select auth.uid())
  );
end;
$$;

create or replace function internal.is_coach_of_parent(p_parent_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, internal
as $$
begin
  if p_parent_id is null or nullif(trim(p_parent_id),'') is null then
    return false;
  end if;
  return exists (
    select 1
    from public.players p
    where p.parent_id = p_parent_id
      and internal.is_coach_of_team(p.team_id)
  );
end;
$$;

revoke all on function internal.is_parent_of_player(text) from public, anon, authenticated, service_role;
revoke all on function internal.is_coach_of_parent(text) from public, anon, authenticated, service_role;
grant execute on function internal.is_parent_of_player(text) to authenticated;
grant execute on function internal.is_coach_of_parent(text) to authenticated;

alter policy select_players_authenticated on public.players
using (
  internal.has_role(array['manager','accountant','receptionist'])
  or (internal.has_role(array['coach']) and internal.is_coach_of_team(team_id))
  or (internal.has_role(array['parent']) and internal.is_parent_of_player(id))
);

drop policy if exists select_parents_authenticated on public.parents;
create policy select_parents_authenticated
on public.parents
for select
to authenticated
using (
  internal.has_role(array['manager','accountant','receptionist'])
  or (internal.has_role(array['coach']) and internal.is_coach_of_parent(id))
  or (internal.has_role(array['parent']) and user_id = (select auth.uid()))
);

drop policy if exists select_parents_own on public.parents;

