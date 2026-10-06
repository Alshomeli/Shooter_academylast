create or replace function public.telegram_ensure_today_trainings(p_chat_id bigint)
returns integer language plpgsql security definer set search_path='' as $$
declare v_staff text; v_today date := (now() at time zone 'Asia/Bahrain')::date; v_day text; v_count integer := 0; r record; v_id text;
begin
 select i.staff_id into v_staff from internal.telegram_identity(p_chat_id) i where i.role='coach';
 if v_staff is null then raise exception 'coach_not_authorized'; end if;
 v_day := case extract(dow from v_today)
  when 0 then 'الأحد' when 1 then 'الإثنين' when 2 then 'الثلاثاء'
  when 3 then 'الأربعاء' when 4 then 'الخميس' when 5 then 'الجمعة' when 6 then 'السبت' end;
 for r in select t.id,t.name from public.teams t where t.coach_id=v_staff and v_day=any(coalesce(t.training_days,array[]::text[]))
 loop
   if not exists(select 1 from public.trainings tr where tr.team_id=r.id and tr.session_date=v_today) then
     v_id := 'tg-'||substr(md5(r.id||':'||v_today::text),1,16);
     insert into public.trainings(id,team_id,title,session_date,duration_minutes,objectives,row_version)
     values(v_id,r.id,'تدريب '||r.name,v_today,90,'حصة مجدولة من الجدول الأسبوعي',1)
     on conflict(id) do nothing;
     v_count := v_count + 1;
   end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.telegram_ensure_today_trainings(bigint) from public,anon,authenticated;
grant execute on function public.telegram_ensure_today_trainings(bigint) to service_role;
