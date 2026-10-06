alter table public.trainings add column if not exists status text not null default 'scheduled'
  check (status in ('scheduled','completed','cancelled'));
alter table public.trainings add column if not exists completed_at timestamptz;
alter table public.trainings add column if not exists completed_by text references public.staff(id) on delete set null;

create or replace function public.telegram_complete_training(p_chat_id bigint,p_training_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_staff text; v_team text; v_today date := (now() at time zone 'Asia/Bahrain')::date;
begin
 select i.staff_id into v_staff from internal.telegram_identity(p_chat_id) i where i.role='coach';
 if v_staff is null then raise exception 'coach_not_authorized'; end if;
 select t.team_id into v_team from public.trainings t where t.id=p_training_id and t.session_date=v_today for update;
 if v_team is null then raise exception 'training_not_today'; end if;
 if not exists(select 1 from public.teams tm where tm.id=v_team and tm.coach_id=v_staff) then raise exception 'not_coach_team'; end if;
 if exists(
   select 1 from public.players p where p.team_id=v_team and p.status='active'
   and not exists(select 1 from public.attendance a where a.training_id=p_training_id and a.player_id=p.id)
 ) then raise exception 'attendance_incomplete'; end if;
 update public.trainings set status='completed',completed_at=now(),completed_by=v_staff,row_version=row_version+1 where id=p_training_id;
 return true;
end $$;
revoke all on function public.telegram_complete_training(bigint,text) from public,anon,authenticated;
grant execute on function public.telegram_complete_training(bigint,text) to service_role;

create or replace function public.telegram_quick_player_note(p_chat_id bigint,p_player_id text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_staff text; v_team text; v_id uuid;
begin
 if length(trim(coalesce(p_note,'')))<2 or length(p_note)>1000 then raise exception 'invalid_note'; end if;
 select i.staff_id into v_staff from internal.telegram_identity(p_chat_id) i where i.role='coach';
 if v_staff is null then raise exception 'coach_not_authorized'; end if;
 select p.team_id into v_team from public.players p where p.id=p_player_id and p.status='active';
 if v_team is null or not exists(select 1 from public.teams t where t.id=v_team and t.coach_id=v_staff) then raise exception 'player_not_in_coach_team'; end if;
 insert into public.player_evaluations(player_id,team_id,coach_id,evaluation_date,period_type,coach_notes,status)
 values(p_player_id,v_team,v_staff,(now() at time zone 'Asia/Bahrain')::date,'custom',trim(p_note),'draft')
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.telegram_quick_player_note(bigint,text,text) from public,anon,authenticated;
grant execute on function public.telegram_quick_player_note(bigint,text,text) to service_role;
