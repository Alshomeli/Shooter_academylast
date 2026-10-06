create or replace function public.telegram_consume_link_code(p_code text,p_chat_id bigint)
returns table(user_id uuid, role text)
language sql security definer set search_path='' as $$
  select * from internal.consume_telegram_link_code(p_code,p_chat_id);
$$;
revoke all on function public.telegram_consume_link_code(text,bigint) from public,anon,authenticated;
grant execute on function public.telegram_consume_link_code(text,bigint) to service_role;

create or replace function public.telegram_identity(p_chat_id bigint)
returns table(user_id uuid, role text, staff_id text, parent_id text, display_name text)
language sql security definer set search_path='' as $$
  select * from internal.telegram_identity(p_chat_id);
$$;
revoke all on function public.telegram_identity(bigint) from public,anon,authenticated;
grant execute on function public.telegram_identity(bigint) to service_role;

create or replace function public.telegram_set_training_attendance(
 p_chat_id bigint,p_training_id text,p_player_id text,p_status text
) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_staff text; v_team text; v_today date := (now() at time zone 'Asia/Bahrain')::date;
begin
 if p_status not in ('present','absent','excused') then raise exception 'invalid_attendance_status'; end if;
 select i.staff_id into v_staff from internal.telegram_identity(p_chat_id) i where i.role='coach';
 if v_staff is null then raise exception 'coach_not_authorized'; end if;
 select t.team_id into v_team from public.trainings t where t.id=p_training_id and t.session_date=v_today;
 if v_team is null then raise exception 'training_not_today'; end if;
 if not exists(select 1 from public.teams tm where tm.id=v_team and tm.coach_id=v_staff) then raise exception 'not_coach_team'; end if;
 if not exists(select 1 from public.players p where p.id=p_player_id and p.team_id=v_team and p.status='active') then raise exception 'player_not_in_team'; end if;
 insert into public.attendance(id,player_id,session_date,session_type,status,training_id,row_version)
 values('att-tg-'||p_training_id||'-'||p_player_id,p_player_id,v_today,'training',p_status,p_training_id,1)
 on conflict(id) do update set status=excluded.status,row_version=public.attendance.row_version+1;
 return true;
end $$;
revoke all on function public.telegram_set_training_attendance(bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.telegram_set_training_attendance(bigint,text,text,text) to service_role;
