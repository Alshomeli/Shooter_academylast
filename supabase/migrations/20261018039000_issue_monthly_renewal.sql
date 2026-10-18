-- Staging only: deterministic, manager-authorized monthly renewal issuance.
-- Calls are idempotent per player and billing period. Never posts revenue or
-- overwrites any existing subscription, payment proof, or transaction.
create or replace function public.issue_player_monthly_renewal(
 p_player_id text, p_start_date date
) returns text language plpgsql security definer set search_path = ''
as $$
declare
 v_staff public.staff;
 v_fee numeric(9,3);
 v_end date;
 v_existing text;
 v_id text;
 v_parent_user_id uuid;
begin
 select * into v_staff from public.staff where user_id=auth.uid()
  and status='active' and role='manager' limit 1;
 if v_staff.id is null then raise exception 'Manager authorization required'; end if;
 if p_player_id is null or p_start_date is null or p_start_date < current_date - 31 or p_start_date > current_date + 31 then raise exception 'Invalid renewal date'; end if;
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
 then raise exception 'Renewal overlaps another subscription period'; end if;
 v_id:='sub-renew-'||pg_catalog.gen_random_uuid()::text;
 insert into public.subscriptions(id,player_id,plan_type,amount,start_date,end_date,status)
 values(v_id,p_player_id,'monthly',v_fee,p_start_date,v_end,'unpaid');
 select pa.user_id into v_parent_user_id from public.players pl
 join public.parents pa on pa.id=pl.parent_id where pl.id=p_player_id;
 if v_parent_user_id is not null then
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
revoke all on function public.issue_player_monthly_renewal(text,date) from public,anon;
grant execute on function public.issue_player_monthly_renewal(text,date) to authenticated;
