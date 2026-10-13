-- Manage goalkeeper-coach coverage from the staff profile.
-- "All teams" is persisted so future age groups are covered automatically.
begin;

alter table public.staff
  add column goalkeeper_all_teams boolean not null default false;

grant select(goalkeeper_all_teams) on public.staff to authenticated;

create or replace function internal.validate_coach_specialty() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.role <> 'coach' and (new.coach_kind <> 'team' or new.supervising_coach_id is not null or new.goalkeeper_all_teams) then
  raise exception 'Only coaches can have a coaching specialty';
 end if;
 if new.coach_kind <> 'assistant' and new.supervising_coach_id is not null then
  raise exception 'Only assistants can be linked to a supervising coach';
 end if;
 if new.coach_kind <> 'goalkeeper' and new.goalkeeper_all_teams then
  raise exception 'Only goalkeeper coaches can cover all teams';
 end if;
 if new.supervising_coach_id is not null then
  if new.supervising_coach_id=new.id or not exists(select 1 from public.staff s
    where s.id=new.supervising_coach_id and s.role='coach' and s.status='active' and s.coach_kind in ('team','goalkeeper')) then
   raise exception 'Choose an active team or goalkeeper coach';
  end if;
 end if;
 if new.coach_kind <> 'team' and exists(select 1 from public.teams where coach_id=new.id) then
  raise exception 'Reassign existing teams before changing this coach specialty';
 end if;
 if (new.role <> 'coach' or new.coach_kind <> 'goalkeeper') and exists(select 1 from public.teams where goalkeeper_coach_id=new.id) then
  raise exception 'Reassign goalkeeper teams before changing this coach specialty';
 end if;
 if new.coach_kind='assistant' and exists(select 1 from public.staff where supervising_coach_id=new.id) then
  raise exception 'Reassign assistants before changing their supervisor to assistant';
 end if;
 return new;
end $$;

create or replace function internal.coach_has_player(p_staff_id text,p_player_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff actor
 join public.staff supervisor on supervisor.id=case when actor.coach_kind='assistant' then actor.supervising_coach_id else actor.id end
 join public.players p on p.id=p_player_id
 where actor.id=p_staff_id and actor.role='coach' and actor.status='active'
 and supervisor.role='coach' and supervisor.status='active'
 and ((supervisor.coach_kind='goalkeeper'
       and (supervisor.goalkeeper_all_teams or exists(select 1 from public.teams gt where gt.id=p.team_id and gt.goalkeeper_coach_id=supervisor.id))
       and lower(trim(p.position)) in ('حارس مرمى','حارس','goalkeeper','gk'))
 or (supervisor.coach_kind='team' and exists(select 1 from public.teams t where t.id=p.team_id and t.coach_id=supervisor.id))));
$$;

create or replace function public.set_goalkeeper_coach_scope(
  p_staff_id text,
  p_all_teams boolean,
  p_team_ids text[] default array[]::text[]
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_team_ids text[] := coalesce((select array_agg(distinct id) from unnest(coalesce(p_team_ids,array[]::text[])) as id where nullif(trim(id),'') is not null),array[]::text[]);
  v_requested boolean := coalesce(p_all_teams,false) or cardinality(v_team_ids)>0;
begin
  if not internal.has_role(array['manager'::text]) then
    raise exception 'Only managers can assign goalkeeper coach scope' using errcode='42501';
  end if;
  if not exists(select 1 from public.staff where id=p_staff_id) then
    raise exception 'Staff member not found';
  end if;
  if v_requested and not exists(select 1 from public.staff
    where id=p_staff_id and role='coach' and status='active' and coach_kind='goalkeeper') then
    raise exception 'Select an active goalkeeper coach';
  end if;
  if not coalesce(p_all_teams,false) and exists(
    select 1 from unnest(v_team_ids) requested(id)
    left join public.teams t on t.id=requested.id where t.id is null
  ) then
    raise exception 'One or more selected teams do not exist';
  end if;

  if coalesce(p_all_teams,false) then
    -- A global assignment is the single source of truth and covers future teams.
    update public.staff set goalkeeper_all_teams=false
      where id<>p_staff_id and goalkeeper_all_teams;
    update public.staff set goalkeeper_all_teams=true where id=p_staff_id;
    update public.teams set goalkeeper_coach_id=null where goalkeeper_coach_id is not null;
  else
    if cardinality(v_team_ids)>0 and exists(select 1 from public.staff
      where id<>p_staff_id and role='coach' and status='active' and coach_kind='goalkeeper' and goalkeeper_all_teams) then
      raise exception 'Change the all-teams goalkeeper coach before assigning selected teams';
    end if;
    update public.staff set goalkeeper_all_teams=false
      where id=p_staff_id and goalkeeper_all_teams is distinct from false;
    update public.teams set goalkeeper_coach_id=null
      where goalkeeper_coach_id=p_staff_id and not (id=any(v_team_ids));
    update public.teams set goalkeeper_coach_id=p_staff_id
      where id=any(v_team_ids) and goalkeeper_coach_id is distinct from p_staff_id;
  end if;

  return jsonb_build_object(
    'staffId',p_staff_id,
    'allTeams',coalesce(p_all_teams,false),
    'teamIds',case when coalesce(p_all_teams,false) then '[]'::jsonb else to_jsonb(v_team_ids) end
  );
end $$;

revoke all on function public.set_goalkeeper_coach_scope(text,boolean,text[]) from public,anon;
grant execute on function public.set_goalkeeper_coach_scope(text,boolean,text[]) to authenticated;

notify pgrst, 'reload schema';
commit;
