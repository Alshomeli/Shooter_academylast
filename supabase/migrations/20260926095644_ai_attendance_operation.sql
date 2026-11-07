-- Add attendance as a confirmed AI-assisted administrative action.
alter table public.ai_action_requests
  drop constraint if exists ai_action_requests_operation_check



alter table public.ai_action_requests
  add constraint ai_action_requests_operation_check
  check (operation = any (array[
    'approve_registration'::text,
    'review_registration'::text,
    'record_subscription_payment'::text,
    'record_attendance'::text
  ]))



create unique index if not exists attendance_unique_player_session
  on public.attendance (player_id, session_date, session_type, coalesce(training_id, ''))



create or replace function internal.record_attendance_entry_impl(
  p_player_id text,
  p_session_date date,
  p_session_type text default 'training',
  p_status text default 'present',
  p_notes text default null,
  p_training_id text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_player public.players%rowtype;
  v_attendance public.attendance%rowtype;
  v_training_id text := nullif(trim(coalesce(p_training_id, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_role := internal.current_user_role();
  if v_role is null or v_role not in ('manager', 'coach') then
    raise exception 'Only manager or coach can record attendance' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_player_id, '')), '') is null then
    raise exception 'Player is required';
  end if;
  if p_session_date is null then
    raise exception 'Session date is required';
  end if;
  if p_session_type not in ('training', 'match') then
    raise exception 'Invalid session type';
  end if;
  if p_status not in ('present', 'absent', 'excused') then
    raise exception 'Invalid attendance status';
  end if;

  select * into v_player
  from public.players
  where id = p_player_id;

  if not found then
    raise exception 'Player not found';
  end if;

  if v_role = 'coach' and not internal.is_coach_of_team(v_player.team_id) then
    raise exception 'Coach can only record attendance for own team' using errcode = '42501';
  end if;

  insert into public.attendance (
    id, player_id, session_date, session_type, status, notes, training_id
  )
  values (
    'att-' || gen_random_uuid()::text,
    p_player_id,
    p_session_date,
    p_session_type,
    p_status,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_training_id
  )
  on conflict (player_id, session_date, session_type, (coalesce(training_id, '')))
  do update set
    status = excluded.status,
    notes = excluded.notes
  returning * into v_attendance;

  return v_attendance;
end;
$$



create or replace function public.record_attendance_entry(
  p_player_id text,
  p_session_date date,
  p_session_type text default 'training',
  p_status text default 'present',
  p_notes text default null,
  p_training_id text default null
)
returns public.attendance
language sql
set search_path = ''
as $$
  select internal.record_attendance_entry_impl($1,$2,$3,$4,$5,$6);
$$



revoke all on function public.record_attendance_entry(text,date,text,text,text,text) from public, anon


grant execute on function public.record_attendance_entry(text,date,text,text,text,text) to authenticated
