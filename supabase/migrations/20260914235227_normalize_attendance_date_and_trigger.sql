drop trigger if exists trg_validate_attendance_training_link on public.attendance;
alter table public.attendance alter column session_date drop default;
alter table public.attendance alter column session_date type date using session_date::date;
create or replace function internal.validate_attendance_training_link()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_training public.trainings%rowtype;
  v_player_team text;
begin
  if new.training_id is null then
    return new;
  end if;

  select * into v_training
  from public.trainings
  where id = new.training_id;

  if not found then
    raise exception 'Attendance training_id does not reference a valid training';
  end if;

  if new.session_date is not null and v_training.session_date is not null
     and new.session_date <> v_training.session_date then
    raise exception 'Attendance session_date must match the linked training session_date';
  end if;

  if new.player_id is not null then
    select team_id into v_player_team from public.players where id = new.player_id;
    if not found then
      raise exception 'Attendance player_id does not reference a valid player';
    end if;

    if nullif(v_training.team_id, '') is not null
       and nullif(v_player_team, '') is not null
       and v_player_team <> v_training.team_id then
      raise exception 'Attendance player must belong to the training team';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function internal.validate_attendance_training_link() from public;
create trigger trg_validate_attendance_training_link
before insert or update of training_id, player_id, session_date on public.attendance
for each row execute function internal.validate_attendance_training_link();
