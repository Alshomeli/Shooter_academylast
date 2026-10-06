create or replace function public.finalize_registered_player(
  p_player_id text,
  p_team_id text,
  p_position text,
  p_jersey_number integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_player public.players%rowtype;
  v_team public.teams%rowtype;
  v_applicant_user_id uuid;
begin
  if not (select internal.is_academy_admin()) then
    raise exception 'Manager authorization required' using errcode='42501';
  end if;

  if nullif(trim(coalesce(p_team_id,'')),'') is null then raise exception 'Team is required'; end if;
  if nullif(trim(coalesce(p_position,'')),'') is null then raise exception 'Player position is required'; end if;
  if p_jersey_number is null or p_jersey_number <= 0 then raise exception 'Jersey number must be greater than zero'; end if;

  select * into v_player from public.players p where p.id=p_player_id for update;
  if not found then raise exception 'Player not found'; end if;

  if nullif(trim(coalesce(v_player.national_id,'')),'') is null then
    raise exception 'Player CPR is required before activation';
  end if;

  if not exists (
    select 1 from public.registration_children c
    join public.registration_applications a on a.id=c.application_id
    where c.approved_player_id=p_player_id and a.status='approved'
  ) then
    raise exception 'Player is not linked to an approved registration application';
  end if;

  if not (
    exists (
      select 1 from public.registration_documents d
      where d.approved_player_id=p_player_id and d.file_category='photo'
    )
    or exists (
      select 1 from public.player_documents d
      where d.player_id=p_player_id and d.file_category='photo'
    )
  ) then
    raise exception 'Player profile photo is required before activation';
  end if;

  select * into v_team from public.teams t where t.id=p_team_id;
  if not found then raise exception 'Selected team does not exist'; end if;

  if exists (
    select 1 from public.players p
    where p.team_id=p_team_id
      and p.jersey_number=p_jersey_number
      and p.id<>p_player_id
  ) then
    raise exception 'Jersey number is already used in the selected team';
  end if;

  update public.players
  set team_id=p_team_id,
      position=trim(p_position),
      jersey_number=p_jersey_number,
      status='active'
  where id=p_player_id
  returning * into v_player;

  select a.applicant_user_id into v_applicant_user_id
  from public.registration_children c
  join public.registration_applications a on a.id=c.application_id
  where c.approved_player_id=p_player_id
  limit 1;

  if v_applicant_user_id is not null then
    insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
    values (
      'notif-' || gen_random_uuid()::text,
      'تم استكمال تسجيل اللاعب',
      'تم استكمال التوزيع الداخلي وتفعيل اللاعب في الأكاديمية.',
      now()::text,
      'registration',false,v_applicant_user_id
    );
  end if;

  return jsonb_build_object(
    'success',true,
    'playerId',v_player.id,
    'teamId',v_player.team_id,
    'position',v_player.position,
    'jerseyNumber',v_player.jersey_number,
    'status',v_player.status,
    'pitchNumber',v_team.pitch_number
  );
end;
$$;
revoke execute on function public.finalize_registered_player(text,text,text,integer) from public, anon;
grant execute on function public.finalize_registered_player(text,text,text,integer) to authenticated;

