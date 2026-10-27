-- Separate cancellation from payment status; preserve original payment evidence.
alter table public.subscription_support add column purpose text not null default 'exemption' check(purpose in ('exemption','withdrawal'));
create table public.subscription_cancellations (
 subscription_id text primary key references public.subscriptions(id),
 request_id uuid not null unique,
 refund_due numeric(12,3) not null check(refund_due>=0),
 reason text not null check(length(trim(reason)) between 3 and 1000),
 cancelled_by text not null references public.staff(id),
 created_at timestamptz not null default now()
);
alter table public.subscription_cancellations enable row level security;
revoke all on public.subscription_cancellations from public,anon,authenticated;
grant select on public.subscription_cancellations to authenticated;
create policy cancellation_read on public.subscription_cancellations for select to authenticated using (
 exists(select 1 from public.staff s where s.user_id=(select auth.uid()) and s.status='active' and s.role in ('manager','accountant'))
);
create function internal.guard_cancellation_record() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Cancellation records are immutable'; end $$;
revoke all on function internal.guard_cancellation_record() from public,anon,authenticated;
create trigger cancellation_immutable before update or delete on public.subscription_cancellations for each row execute function internal.guard_cancellation_record();
alter table public.subscriptions drop constraint chk_subscriptions_status;
alter table public.subscriptions add constraint chk_subscriptions_status check(status in ('paid','unpaid','exempt','cancelled'));
alter table public.subscriptions drop constraint chk_subscriptions_paid_consistency;
alter table public.subscriptions add constraint chk_subscriptions_paid_consistency check(
 (status='paid' and paid_at is not null and coalesce(payment_method,'')<>'') or
 (status='unpaid' and paid_at is null) or (status='exempt' and paid_at is null and payment_method is null) or
 (status='cancelled' and ((paid_at is null and payment_method is null) or (paid_at is not null and coalesce(payment_method,'')<>'')))
);
-- Keep existing accounting guards intact, allowing only the audited cancellation transition.
create or replace function internal.guard_paid_subscription() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.status='cancelled' or exists(select 1 from public.transactions where subscription_id=old.id) then raise exception 'Posted or cancelled subscriptions cannot be deleted'; end if;
  return old;
 end if;
 if old.status='cancelled' then raise exception 'Cancelled subscriptions are immutable'; end if;
 if exists(select 1 from public.transactions where subscription_id=old.id) and
  (new.id,new.player_id,new.amount,new.payment_method,new.paid_at,new.plan_type,new.start_date,new.end_date)
  is distinct from (old.id,old.player_id,old.amount,old.payment_method,old.paid_at,old.plan_type,old.start_date,old.end_date)
 then raise exception 'Posted subscription payment cannot be changed'; end if;
 if new.status='cancelled' then
  if (new.id,new.player_id,new.amount,new.payment_method,new.paid_at,new.plan_type,new.start_date,new.end_date) is distinct from (old.id,old.player_id,old.amount,old.payment_method,old.paid_at,old.plan_type,old.start_date,old.end_date) then raise exception 'Cancellation must preserve original subscription'; end if;
  if not exists(select 1 from public.subscription_cancellations where subscription_id=old.id) then raise exception 'Use the cancellation operation'; end if;
 elsif exists(select 1 from public.transactions where subscription_id=old.id) and new.status is distinct from old.status then
  raise exception 'Posted subscription payment cannot be changed';
 end if;
 return new;
end $$;
revoke all on function internal.guard_paid_subscription() from public,anon,authenticated;
drop trigger trg_guard_paid_subscription on public.subscriptions;
create trigger trg_guard_paid_subscription before update or delete on public.subscriptions for each row execute function internal.guard_paid_subscription();
create function internal.guard_cancelled_insert() returns trigger language plpgsql set search_path='' as $$
begin if new.status='cancelled' then raise exception 'Use the cancellation operation'; end if; return new; end $$;
revoke all on function internal.guard_cancelled_insert() from public,anon,authenticated;
create trigger cancelled_insert_guard before insert on public.subscriptions for each row execute function internal.guard_cancelled_insert();
create function internal.record_subscription_refund(p_request_id uuid,p_subscription_id text,p_amount numeric,p_reason text,p_method text,p_purpose text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_staff public.staff; v_sub public.subscriptions; v_payment public.transactions;
 v_existing public.subscription_support; v_total numeric; v_tx text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_staff from public.staff where user_id=auth.uid() and status='active' and role='manager' limit 1;
 if v_staff.id is null then raise exception 'Active manager required' using errcode='42501'; end if;
 if p_request_id is null or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,3) then raise exception 'Invalid support amount'; end if;
 if p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'Support reason required'; end if;
 if p_method is null or p_method not in ('cash','transfer','benefit','card') then raise exception 'Invalid refund method'; end if;
 select * into v_sub from public.subscriptions where id=p_subscription_id for update;
 if not found then raise exception 'Subscription not found'; end if;
 if p_purpose is null or p_purpose not in ('exemption','withdrawal') then raise exception 'Invalid refund purpose'; end if;
 if (p_purpose='exemption' and v_sub.status<>'paid') or (p_purpose='withdrawal' and v_sub.status<>'cancelled') then raise exception 'Invalid subscription state for refund'; end if;
 select * into v_existing from public.subscription_support where id=p_request_id;
 if found then
  if (v_existing.subscription_id,v_existing.amount,v_existing.reason,v_existing.payment_method,v_existing.granted_by,v_existing.purpose)
     is distinct from (p_subscription_id,p_amount,trim(p_reason),p_method,v_staff.id,p_purpose) then raise exception 'Request already used with different details'; end if;
  return v_existing.id;
 end if;
 select * into v_payment from public.transactions where subscription_id=v_sub.id and type='revenue' and category='subscription' for update;
 if not found or v_payment.player_id is distinct from v_sub.player_id then raise exception 'Original payment not found'; end if;
 select coalesce(sum(amount),0) into v_total from public.subscription_support where original_payment_id=v_payment.id;
 if v_total+p_amount>v_payment.amount then raise exception 'Support exceeds remaining paid amount'; end if;
 if p_purpose='withdrawal' and p_amount + (select coalesce(sum(amount),0) from public.subscription_support where subscription_id=v_sub.id and purpose='withdrawal') > (select refund_due from public.subscription_cancellations where subscription_id=v_sub.id) then raise exception 'Refund exceeds approved cancellation amount'; end if;
 v_tx:='support-'||p_request_id::text;
 insert into public.subscription_support(id,subscription_id,original_payment_id,transaction_id,player_id,amount,reason,payment_method,granted_by,purpose)
 values(p_request_id,v_sub.id,v_payment.id,v_tx,v_sub.player_id,p_amount,trim(p_reason),p_method,v_staff.id,p_purpose);
 insert into public.transactions(id,type,category,amount,transaction_date,description,recorded_by,player_id)
 values(v_tx,'expense','subscription_support',p_amount,(now() at time zone 'Asia/Bahrain')::date,
 case when p_purpose='withdrawal' then 'استرداد بسبب الانسحاب / Withdrawal refund: ' else 'رد رسوم بسبب الإعفاء / Exemption refund: ' end||trim(p_reason)||' ['||v_payment.id||']',v_staff.name,v_sub.player_id);
 insert into public.audit_logs(id,action,timestamp,user_role,user_name,details)
 values('audit-'||gen_random_uuid()::text,'subscription_support_granted',now()::text,'manager',v_staff.name,
 jsonb_build_object('support_id',p_request_id,'subscription_id',v_sub.id,'original_payment_id',v_payment.id,'amount',p_amount,'reason',trim(p_reason),'method',p_method,'purpose',p_purpose)::text);
 return p_request_id;
end $$;

create or replace function internal.grant_subscription_support(p_request_id uuid,p_subscription_id text,p_amount numeric,p_reason text,p_method text)
returns uuid language sql security invoker set search_path='' as $$
 select internal.record_subscription_refund(p_request_id,p_subscription_id,p_amount,p_reason,p_method,'exemption')
$$;
create function public.record_withdrawal_refund(p_request_id uuid,p_subscription_id text,p_amount numeric,p_reason text,p_method text)
returns uuid language sql security invoker set search_path='' as $$
 select internal.record_subscription_refund(p_request_id,p_subscription_id,p_amount,p_reason,p_method,'withdrawal')
$$;
revoke all on function internal.record_subscription_refund(uuid,text,numeric,text,text,text), public.record_withdrawal_refund(uuid,text,numeric,text,text) from public,anon;
grant execute on function internal.record_subscription_refund(uuid,text,numeric,text,text,text), public.record_withdrawal_refund(uuid,text,numeric,text,text) to authenticated;
create function internal.cancel_subscription(p_request_id uuid,p_subscription_id text,p_refund_due numeric,p_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare v_staff public.staff; v_sub public.subscriptions; v_old public.subscription_cancellations; v_available numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_staff from public.staff where user_id=auth.uid() and status='active' and role='manager' limit 1;
 if v_staff.id is null then raise exception 'Active manager required' using errcode='42501'; end if;
 if p_request_id is null or p_reason is null or length(trim(p_reason)) not between 3 and 1000 or p_refund_due is null or p_refund_due::text in ('NaN','Infinity','-Infinity') or p_refund_due<0 or p_refund_due<>round(p_refund_due,3) then raise exception 'Invalid cancellation details'; end if;
 select * into v_sub from public.subscriptions where id=p_subscription_id for update;
 if not found then raise exception 'Subscription not found'; end if;
 select * into v_old from public.subscription_cancellations where subscription_id=p_subscription_id;
 if found then
  if (v_old.request_id,v_old.refund_due,v_old.reason,v_old.cancelled_by) is distinct from (p_request_id,p_refund_due,trim(p_reason),v_staff.id) then raise exception 'Subscription already cancelled'; end if;
  return p_subscription_id;
 end if;
 if v_sub.status not in ('paid','unpaid') then raise exception 'Only paid or unpaid subscriptions can be cancelled'; end if;
 perform 1 from public.transactions where subscription_id=v_sub.id for update;
 select coalesce(sum(amount),0) into v_available from public.transactions where subscription_id=v_sub.id and type='revenue' and category='subscription';
 v_available:=v_available-(select coalesce(sum(amount),0) from public.subscription_support where subscription_id=v_sub.id);
 if p_refund_due>v_available then raise exception 'Refund exceeds remaining paid amount'; end if;
 insert into public.subscription_cancellations(subscription_id,request_id,refund_due,reason,cancelled_by) values(v_sub.id,p_request_id,p_refund_due,trim(p_reason),v_staff.id);
 update public.subscriptions set status='cancelled' where id=v_sub.id;
 -- Serialize coverage decisions across this player's subscriptions.
 perform 1 from public.players where id=v_sub.player_id for update;
 -- Stop participation only when this player has no other current coverage.
 update public.players set status='inactive' where id=v_sub.player_id and status='active'
 and not exists(select 1 from public.subscriptions s where s.player_id=v_sub.player_id and s.id<>v_sub.id and s.status in ('paid','exempt')
  and (s.start_date is null or s.start_date<=(now() at time zone 'Asia/Bahrain')::date)
  and (s.end_date is null or s.end_date>=(now() at time zone 'Asia/Bahrain')::date));
 insert into public.audit_logs(id,action,timestamp,user_role,user_name,details) values('audit-'||gen_random_uuid()::text,'subscription_cancelled',now()::text,'manager',v_staff.name,jsonb_build_object('subscription_id',v_sub.id,'refund_due',p_refund_due,'reason',trim(p_reason))::text);
 return v_sub.id;
end $$;
create function public.cancel_subscription(p_request_id uuid,p_subscription_id text,p_refund_due numeric,p_reason text)
returns text language sql security invoker set search_path='' as $$ select internal.cancel_subscription(p_request_id,p_subscription_id,p_refund_due,p_reason) $$;
revoke all on function internal.cancel_subscription(uuid,text,numeric,text), public.cancel_subscription(uuid,text,numeric,text) from public,anon;
grant execute on function internal.cancel_subscription(uuid,text,numeric,text), public.cancel_subscription(uuid,text,numeric,text) to authenticated;
notify pgrst, 'reload schema';

-- New exemptions have an explicit period and reason; preserve legacy records.
alter table public.subscriptions add column exemption_reason text;
create or replace function internal.guard_exempt_subscription() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='exempt' then
  if new.amount<>0 or new.paid_at is not null or nullif(trim(new.payment_method),'') is not null then raise exception 'Exempt subscriptions must have zero amount and no payment metadata'; end if;
  if tg_op='INSERT' or old.status<>'exempt' then
   if new.start_date is null or new.end_date is null or new.end_date<new.start_date or new.exemption_reason is null or length(trim(new.exemption_reason)) not between 3 and 1000 then raise exception 'Exemption period and reason required'; end if;
  end if;
 end if;
 return new;
end $$;
