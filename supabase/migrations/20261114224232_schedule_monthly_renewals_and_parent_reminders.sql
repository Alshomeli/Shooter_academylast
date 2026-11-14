-- Add scheduled issuance without changing the manager authorization boundary.
create function internal.issue_player_monthly_renewal(
 p_player_id text, p_start_date date, p_notify_parent boolean
) returns text language plpgsql security invoker set search_path = ''
as $$
declare
 v_fee numeric(9,3);
 v_end date;
 v_existing text;
 v_id text;
 v_parent_user_id uuid;
begin
 if p_player_id is null or p_start_date is null or p_start_date < (now() at time zone 'Asia/Bahrain')::date - 31 or p_start_date > (now() at time zone 'Asia/Bahrain')::date + 31 then raise exception 'Invalid renewal date'; end if;
 -- One player per transaction, serializes simultaneous duplicate requests.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('renewal:'||p_player_id,0));
 if not exists(select 1 from public.players where id=p_player_id)
 then raise exception 'Player not found'; end if;
 -- Price is fixed when the renewal is created. Default 25 BHD.
 select coalesce((select monthly_amount from public.player_recurring_fees
   where player_id=p_player_id),25.000) into v_fee;
 if v_fee <= 0 then raise exception 'Zero-fee players require manager exemption flow'; end if;
 v_end := (p_start_date + interval '1 month')::date;
 -- Avoid existing date overlap, including a paid historical period.
 select id into v_existing from public.subscriptions
 where player_id=p_player_id and start_date=p_start_date and end_date=v_end
   and plan_type='monthly' limit 1;
 if v_existing is not null then return v_existing; end if;
 if exists(select 1 from public.subscriptions where player_id=p_player_id
   and start_date<=v_end and end_date>=p_start_date)
 then raise exception 'Renewal overlaps another subscription period' using errcode = '23P01'; end if;
 v_id:='sub-renew-'||pg_catalog.gen_random_uuid()::text;
 insert into public.subscriptions(id,player_id,plan_type,amount,start_date,end_date,status)
 values(v_id,p_player_id,'monthly',v_fee,p_start_date,v_end,'unpaid');
 select pa.user_id into v_parent_user_id from public.players pl
 join public.parents pa on pa.id=pl.parent_id where pl.id=p_player_id;
 if p_notify_parent and v_parent_user_id is not null then
   insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
   values('notif-renewal-'||v_id,'تجديد اشتراك مطلوب',
     'يرجى رفع إثبات تحويل تجديد الاشتراك بالمبلغ '||v_fee::text||' د.ب.',
     pg_catalog.to_char(now() at time zone 'Asia/Bahrain','YYYY-MM-DD HH24:MI'),
     'subscription',false,v_parent_user_id)
   on conflict(id) do nothing;
 end if;
 return v_id;
end
$$;
revoke all on function internal.issue_player_monthly_renewal(text,date,boolean) from public,anon,authenticated,service_role;

-- Preserve the manager API and keep the shared issuance code private.
create or replace function public.issue_player_monthly_renewal(p_player_id text, p_start_date date)
returns text language plpgsql security definer set search_path = '' as $$
begin
 if not exists (
  select 1 from public.staff where user_id=auth.uid() and status='active' and role='manager'
 ) then raise exception 'Manager authorization required'; end if;
 return internal.issue_player_monthly_renewal(p_player_id,p_start_date,true);
end
$$;

create function internal.issue_scheduled_monthly_renewals()
returns integer language plpgsql security invoker set search_path = '' as $$
declare
 v_day date := (now() at time zone 'Asia/Bahrain')::date;
 v_player record;
 v_count integer := 0;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('scheduled-monthly-renewals',0));
 for v_player in
  select distinct on (s.player_id) s.player_id
  from public.subscriptions s
  join public.players p on p.id=s.player_id
  left join public.player_recurring_fees fee on fee.player_id=s.player_id
  where s.plan_type='monthly' and s.status='paid'
   and p.status='active' and p.archived_at is null
   and coalesce(fee.monthly_amount,25.000)>0
   and s.end_date < v_day and s.end_date >= v_day - 31
   and not exists (
    select 1 from public.subscriptions later
    where later.player_id=s.player_id and later.end_date>s.end_date
   )
  order by s.player_id,s.end_date desc
 loop
  begin
   -- The due-reminder task sends the parent's first notice.
   perform internal.issue_player_monthly_renewal(v_player.player_id,v_day,false);
   v_count:=v_count+1;
  exception when exclusion_violation or unique_violation then
   -- Concurrent manual issuance or an existing overlapping period.
   continue;
  end;
 end loop;
 return v_count;
end
$$;
revoke all on function internal.issue_scheduled_monthly_renewals() from public,anon,authenticated,service_role;

create or replace function internal.queue_daily_subscription_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare v_day date:=(now() at time zone 'Asia/Bahrain')::date; v_row record; v_count integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('daily-subscription-reminders:'||v_day::text,0));
 for v_row in
  select s.id,s.amount,s.start_date,pa.user_id,pl.name
  from public.subscriptions s join public.players pl on pl.id=s.player_id
  join public.parents pa on pa.id=pl.parent_id
  where s.status='unpaid' and s.start_date<=v_day and pl.archived_at is null
   and pa.user_id is not null and pa.status='active'
 loop
  -- Keep parent notifications two Bahrain calendar days apart, including after a missed run.
  if not exists (
   select 1 from internal.subscription_reminder_days r
   where r.subscription_id=v_row.id and r.recipient_user_id=v_row.user_id
    and r.reminder_day > v_day - 2
  ) then
   insert into internal.subscription_reminder_days values(v_row.id,v_day,v_row.user_id)
   on conflict do nothing;
   if found then
    insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
    values('due-daily-'||v_row.id||'-'||v_day::text,'تذكير باستحقاق الاشتراك',
     'اشتراك اللاعب '||v_row.name||' مستحق منذ '||v_row.start_date::text||'. المبلغ: '||v_row.amount::text||' د.ب. يرجى رفع إثبات التحويل للمراجعة.',
     to_char(now() at time zone 'Asia/Bahrain','YYYY-MM-DD HH24:MI'),'subscription',false,v_row.user_id)
    on conflict(id) do nothing;
    v_count:=v_count+1;
   end if;
   insert into internal.subscription_telegram_reminders(subscription_id,reminder_day,chat_id,recipient_role)
    select v_row.id,v_day,l.chat_id,'parent' from public.telegram_user_links l
    where l.user_id=v_row.user_id and l.role='parent' and l.is_active
    on conflict do nothing;
  end if;
  insert into internal.subscription_telegram_reminders(subscription_id,reminder_day,chat_id,recipient_role)
   select v_row.id,v_day,b.telegram_chat_id,'manager' from internal.telegram_manager_bindings b
   join public.staff st on st.id=b.staff_id and st.status='active' and st.role='manager'
   where b.active and b.telegram_chat_id is not null on conflict do nothing;
 end loop;
 return v_count;
end $$;
revoke all on function internal.queue_daily_subscription_reminders() from public,anon,authenticated,service_role;

-- Run at 08:45 Bahrain time, ahead of the existing 09:00 reminder job (UTC cron).
-- Enable after staging verification. Keeping the job inactive also allows rollback by disabling it.
select cron.alter_job(
 cron.schedule('automatic-monthly-renewals','45 5 * * *','select internal.issue_scheduled_monthly_renewals();'),
 active := false
);
