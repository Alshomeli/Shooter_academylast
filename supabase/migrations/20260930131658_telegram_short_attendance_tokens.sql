create table if not exists internal.telegram_attendance_tokens(token text primary key,chat_id bigint not null,training_id text not null references public.trainings(id) on delete cascade,player_id text not null references public.players(id) on delete cascade,expires_at timestamptz not null default (now()+interval '18 hours'),created_at timestamptz not null default now());
revoke all on internal.telegram_attendance_tokens from public,anon,authenticated;
create or replace function public.telegram_attendance_token(p_chat_id bigint,p_training_id text,p_player_id text) returns text language plpgsql security definer set search_path='' as $$
declare v_staff text; v_token text;
begin
 select i.staff_id into v_staff from internal.telegram_identity(p_chat_id) i where i.role='coach';
 if v_staff is null then raise exception 'coach_not_authorized'; end if;
 if not exists(select 1 from public.trainings tr join public.teams tm on tm.id=tr.team_id join public.players p on p.team_id=tm.id where tr.id=p_training_id and p.id=p_player_id and p.status='active' and tm.coach_id=v_staff and tr.session_date=(now() at time zone 'Asia/Bahrain')::date) then raise exception 'attendance_target_not_allowed'; end if;
 delete from internal.telegram_attendance_tokens t where t.expires_at<=now();
 select t.token into v_token from internal.telegram_attendance_tokens t where t.chat_id=p_chat_id and t.training_id=p_training_id and t.player_id=p_player_id and t.expires_at>now() limit 1;
 if v_token is null then v_token:=substr(replace(gen_random_uuid()::text,'-',''),1,16); insert into internal.telegram_attendance_tokens(token,chat_id,training_id,player_id) values(v_token,p_chat_id,p_training_id,p_player_id); end if;
 return v_token;
end $$;
revoke all on function public.telegram_attendance_token(bigint,text,text) from public,anon,authenticated;
grant execute on function public.telegram_attendance_token(bigint,text,text) to service_role;
create or replace function public.telegram_set_training_attendance_token(p_chat_id bigint,p_token text,p_status text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_training text; v_player text;
begin
 select t.training_id,t.player_id into v_training,v_player from internal.telegram_attendance_tokens t where t.token=p_token and t.chat_id=p_chat_id and t.expires_at>now();
 if v_training is null then raise exception 'attendance_token_invalid'; end if;
 return public.telegram_set_training_attendance(p_chat_id,v_training,v_player,p_status);
end $$;
revoke all on function public.telegram_set_training_attendance_token(bigint,text,text) from public,anon,authenticated;
grant execute on function public.telegram_set_training_attendance_token(bigint,text,text) to service_role;