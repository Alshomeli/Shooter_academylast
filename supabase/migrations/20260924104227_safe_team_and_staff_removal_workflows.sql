-- Safe staff/team removal workflows.
-- Reconstructed from the live Supabase definitions.

create or replace function internal.delete_staff_member_safely(
  p_staff_id text,
  p_reassign_coach_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_current_staff_id text := internal.current_staff_id();
  v_target public.staff%rowtype;
  v_replacement public.staff%rowtype;
  v_team_count integer;
begin
  if (select internal.has_role(array['manager'::text])) is not true then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  select *
  into v_target
  from public.staff
  where id = p_staff_id
  for update;

  if not found then
    raise exception 'Staff member not found';
  end if;

  if p_staff_id = v_current_staff_id then
    raise exception 'You cannot delete your own active staff account';
  end if;

  select count(*)
  into v_team_count
  from public.teams
  where coach_id = p_staff_id;

  if v_team_count > 0 then
    if nullif(trim(coalesce(p_reassign_coach_id,'')),'') is null then
      raise exception 'Staff member is assigned to teams; reassign those teams first';
    end if;

    if p_reassign_coach_id = p_staff_id then
      raise exception 'Replacement coach must be different';
    end if;

    select *
    into v_replacement
    from public.staff
    where id = p_reassign_coach_id
      and role = 'coach'
      and status = 'active';

    if not found then
      raise exception 'Replacement coach must be an active coach';
    end if;

    update public.teams
    set coach_id = p_reassign_coach_id,
        row_version = row_version + 1
    where coach_id = p_staff_id;
  end if;

  delete from public.staff
  where id = p_staff_id;

  return jsonb_build_object(
    'success', true,
    'staffId', p_staff_id,
    'reassignedTeams', v_team_count,
    'replacementCoachId', p_reassign_coach_id
  );
end
$function$;

create or replace function internal.delete_team_safely(p_team_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_player_count integer;
begin
  if (select internal.has_role(array['manager'::text])) is not true then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.teams
    where id = p_team_id
  ) then
    raise exception 'Team not found';
  end if;

  select count(*)
  into v_player_count
  from public.players
  where team_id = p_team_id;

  update public.players
  set team_id = null,
      row_version = row_version + 1
  where team_id = p_team_id;

  delete from public.teams
  where id = p_team_id;

  return jsonb_build_object(
    'success', true,
    'teamId', p_team_id,
    'unassignedPlayers', v_player_count
  );
end
$function$;

create or replace function public.delete_staff_member_safely(
  p_staff_id text,
  p_reassign_coach_id text default null
)
returns jsonb
language sql
set search_path to ''
as $function$
  select internal.delete_staff_member_safely(p_staff_id, p_reassign_coach_id)
$function$;

create or replace function public.delete_team_safely(p_team_id text)
returns jsonb
language sql
set search_path to ''
as $function$
  select internal.delete_team_safely(p_team_id)
$function$;
