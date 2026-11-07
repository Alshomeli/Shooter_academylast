-- Once per Bahrain calendar day and obligation, independent of browser sessions.
create table internal.subscription_reminder_days (
 subscription_id text not null references public.subscriptions(id),
 reminder_day date not null,
 recipient_user_id uuid not null,
 primary key(subscription_id,reminder_day,recipient_user_id)
);
create table internal.subscription_telegram_reminders (
 id uuid primary key default gen_random_uuid(),
 subscription_id text not null references public.subscriptions(id),
 reminder_day date not null,
 chat_id bigint not null,
 recipient_role text not null check(recipient_role in ('parent','manager')),
 status text not null default 'queued' check(status in ('queued','attempted','sent','failed','cancelled')),
 attempted_at timestamptz,
 unique(subscription_id,reminder_day,chat_id)
);
alter table internal.subscription_reminder_days enable row level security;
alter table internal.subscription_telegram_reminders enable row level security;
revoke all on internal.subscription_reminder_days,internal.subscription_telegram_reminders from public,anon,authenticated,service_role;

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
  insert into internal.subscription_telegram_reminders(subscription_id,reminder_day,chat_id,recipient_role)
   select v_row.id,v_day,b.telegram_chat_id,'manager' from internal.telegram_manager_bindings b
   join public.staff st on st.id=b.staff_id and st.status='active' and st.role='manager'
   where b.active and b.telegram_chat_id is not null on conflict do nothing;
 end loop;
 return v_count;
end $$;
revoke all on function internal.queue_daily_subscription_reminders() from public,anon,authenticated,service_role;

create or replace function public.telegram_claim_subscription_reminders(p_limit integer default 50)
returns table(id uuid,chat_id bigint,recipient_role text,player_name text,amount numeric,due_date date,proof_id uuid)
language plpgsql security definer set search_path='' as $$
begin
 update internal.subscription_telegram_reminders o set status='cancelled'
 where o.status='queued' and (o.reminder_day<>(now() at time zone 'Asia/Bahrain')::date
 or not exists(select 1 from public.subscriptions s join public.players pl on pl.id=s.player_id
 join public.parents pa on pa.id=pl.parent_id
 where s.id=o.subscription_id and s.status='unpaid' and pl.archived_at is null and pa.status='active'
 and ((o.recipient_role='parent' and exists(select 1 from public.telegram_user_links l where l.user_id=pa.user_id and l.chat_id=o.chat_id and l.role='parent' and l.is_active))
 or (o.recipient_role='manager' and exists(select 1 from internal.telegram_manager_bindings b join public.staff st on st.id=b.staff_id where b.telegram_chat_id=o.chat_id and b.active and st.status='active' and st.role='manager')))));
 return query
 with candidates as (
  select o.id from internal.subscription_telegram_reminders o where o.status='queued'
  order by o.id for update skip locked limit greatest(1,least(p_limit,100))
 ), claimed as (
  update internal.subscription_telegram_reminders o set status='attempted',attempted_at=now()
  from candidates c where o.id=c.id returning o.*
 ) select c.id,c.chat_id,c.recipient_role,pl.name,s.amount,s.start_date,
 (select pp.id from public.payment_proofs pp where pp.subscription_id=s.id and pp.status='pending' order by pp.created_at desc limit 1)
 from claimed c join public.subscriptions s on s.id=c.subscription_id
 join public.players pl on pl.id=s.player_id;
end $$;
revoke all on function public.telegram_claim_subscription_reminders(integer) from public,anon,authenticated;
grant execute on function public.telegram_claim_subscription_reminders(integer) to service_role;
create or replace function public.telegram_finish_subscription_reminder(p_id uuid,p_success boolean)
returns void language sql security definer set search_path='' as $$
 update internal.subscription_telegram_reminders set status=case when p_success then 'sent' else 'failed' end
 where id=p_id and status='attempted';
$$;
revoke all on function public.telegram_finish_subscription_reminder(uuid,boolean) from public,anon,authenticated;
grant execute on function public.telegram_finish_subscription_reminder(uuid,boolean) to service_role;

create or replace function internal.close_paid_subscription_reminders()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'unpaid' then
  update internal.subscription_telegram_reminders set status='cancelled'
  where subscription_id=new.id and status='queued';
  update public.notifications set read=true where left(id,length('due-daily-'||new.id||'-'))='due-daily-'||new.id||'-';
 end if;
 return new;
end $$;
revoke all on function internal.close_paid_subscription_reminders() from public,anon,authenticated,service_role;
create trigger close_paid_subscription_reminders after update of status on public.subscriptions
for each row execute function internal.close_paid_subscription_reminders();

alter table public.telegram_user_links drop constraint telegram_user_links_role_check;
alter table public.telegram_user_links add constraint telegram_user_links_role_check check(role in ('manager','coach','parent'));
alter table public.telegram_link_codes drop constraint telegram_link_codes_role_check;
alter table public.telegram_link_codes add constraint telegram_link_codes_role_check check(role in ('manager','coach','parent'));
create or replace function public.my_telegram_staff_role() returns text language sql stable security invoker set search_path='' as $$
 select role from (
 select s.role,0 priority from public.staff s where s.user_id=auth.uid() and s.status='active' and s.role in ('manager','coach')
 union all select 'parent',1 from public.parents p where p.user_id=auth.uid() and p.status='active'
 ) r order by priority limit 1;
$$;
drop policy telegram_link_codes_insert_own_staff_role on public.telegram_link_codes;
create policy telegram_link_codes_insert_own_staff_role on public.telegram_link_codes for insert to authenticated
with check(user_id=(select auth.uid()) and role=public.my_telegram_staff_role() and role in ('manager','coach','parent')
and consumed_at is null and expires_at>now() and expires_at<=now()+interval '11 minutes');
create or replace function internal.telegram_role_for_user(p_user_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select role from (
 select s.role,0 priority from public.staff s where s.user_id=p_user_id and s.status='active' and s.role in ('manager','coach')
 union all select 'parent',1 from public.parents p where p.user_id=p_user_id and p.status='active'
 ) r order by priority limit 1;
$$;
create or replace function internal.consume_telegram_link_code(p_code text,p_chat_id bigint)
returns table(user_id uuid, role text)
language plpgsql security definer set search_path='' as $$
declare v_row public.telegram_link_codes%rowtype;
begin
  if p_chat_id is null or p_code is null or length(trim(p_code)) < 6 then return; end if;
  select * into v_row from public.telegram_link_codes
  where code_hash=encode(extensions.digest(upper(trim(p_code)),'sha256'),'hex')
    and consumed_at is null and expires_at>now()
  order by created_at desc limit 1 for update;
  if not found or v_row.role not in ('manager','coach','parent') then return; end if;
  if internal.telegram_role_for_user(v_row.user_id) is distinct from v_row.role then return; end if;
  update public.telegram_user_links set is_active=false where chat_id=p_chat_id and user_id<>v_row.user_id;
  insert into public.telegram_user_links(user_id,chat_id,role,telegram_user_code,linked_at,last_seen_at,is_active)
  values(v_row.user_id,p_chat_id,v_row.role,'TG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),now(),now(),true)
  on conflict(user_id) do update set chat_id=excluded.chat_id,role=excluded.role,linked_at=now(),last_seen_at=now(),is_active=true;
  update public.telegram_link_codes set consumed_at=now() where id=v_row.id;
  return query select v_row.user_id,v_row.role;
end $$;
revoke all on function internal.consume_telegram_link_code(text,bigint) from public,anon,authenticated;


create or replace function internal.telegram_identity(p_chat_id bigint)
returns table(user_id uuid,role text,staff_id text,parent_id text,display_name text)
language plpgsql security definer set search_path='' as $$
begin
 return query
 select l.user_id,l.role,s.id,null::text,s.name from public.telegram_user_links l
 join public.staff s on s.user_id=l.user_id and s.status='active' and s.role=l.role
 where l.chat_id=p_chat_id and l.is_active and l.role in ('manager','coach')
 union all
 select l.user_id,l.role,null::text,p.id,p.name from public.telegram_user_links l
 join public.parents p on p.user_id=l.user_id and p.status='active'
 where l.chat_id=p_chat_id and l.is_active and l.role='parent';
 update public.telegram_user_links set last_seen_at=now() where chat_id=p_chat_id and is_active;
end $$;
CREATE OR REPLACE FUNCTION internal.dispatch_telegram_registration_outbox()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_secret text; v_request_id bigint;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM internal.telegram_registration_outbox WHERE status IN ('pending','failed') AND attempts < 5)
     AND NOT EXISTS(SELECT 1 FROM internal.telegram_staff_application_outbox WHERE status IN ('pending','failed') AND attempts < 5)
     AND NOT EXISTS(SELECT 1 FROM internal.telegram_login_outbox WHERE status IN ('pending','failed') AND attempts < 5)
  AND NOT EXISTS(SELECT 1 FROM internal.subscription_telegram_reminders WHERE status='queued')
  THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_dispatch_secret' LIMIT 1;
  IF v_secret IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(
    url := 'https://jgvfruijtixguavspyer.supabase.co/functions/v1/telegram-reply',
    headers := jsonb_build_object('Content-Type','application/json','X-Shooter-Dispatch-Secret', v_secret),
    body := jsonb_build_object('action','flush_registration_notifications'),
    timeout_milliseconds := 5000
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$function$;
-- 09:00 Bahrain. Queue creation is idempotent; existing five-minute dispatcher sends it.
select cron.schedule('daily-subscription-reminders','0 6 * * *','select internal.queue_daily_subscription_reminders();');
notify pgrst,'reload schema';
