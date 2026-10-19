-- Manager support is a separate, immutable refund. Original receipts stay unchanged.
create table public.subscription_support (
 id uuid primary key,
 subscription_id text not null references public.subscriptions(id),
 original_payment_id text not null references public.transactions(id),
 transaction_id text not null unique references public.transactions(id) deferrable initially deferred,
 player_id text not null references public.players(id),
 amount numeric(12,3) not null check(amount>0),
 reason text not null check(length(trim(reason)) between 3 and 1000),
 payment_method text not null check(payment_method in ('cash','transfer','benefit','card')),
 granted_by text not null references public.staff(id),
 created_at timestamptz not null default now()
);
alter table public.subscription_support enable row level security;
revoke all on public.subscription_support from public,anon,authenticated;
grant select on public.subscription_support to authenticated;
create policy support_finance_read on public.subscription_support for select to authenticated
using (exists(select 1 from public.staff s where s.user_id=(select auth.uid()) and s.status='active' and s.role in ('manager','accountant')));
create index subscription_support_payment_idx on public.subscription_support(original_payment_id);
create index subscription_support_subscription_idx on public.subscription_support(subscription_id);

create function internal.guard_subscription_support() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='subscription_support' then raise exception 'Support records are immutable'; end if;
 if tg_op<>'INSERT' and exists(select 1 from public.subscription_support where transaction_id=old.id) then
  raise exception 'Support refund transactions are immutable';
 end if;
 if tg_op='DELETE' then return old; end if;
 if new.category='subscription_support' and not exists(
  select 1 from public.subscription_support a where a.transaction_id=new.id
   and a.amount=new.amount and a.player_id=new.player_id and new.type='expense' and new.subscription_id is null
 ) then raise exception 'Use the manager support operation'; end if;
 return new;
end $$;
revoke all on function internal.guard_subscription_support() from public,anon,authenticated;
create trigger support_immutable before update or delete on public.subscription_support
for each row execute function internal.guard_subscription_support();
create trigger support_transaction_guard before insert or update or delete on public.transactions
for each row execute function internal.guard_subscription_support();

create function internal.grant_subscription_support(p_request_id uuid,p_subscription_id text,p_amount numeric,p_reason text,p_method text)
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
 if not found or v_sub.status<>'paid' then raise exception 'A paid subscription is required'; end if;
 select * into v_existing from public.subscription_support where id=p_request_id;
 if found then
  if (v_existing.subscription_id,v_existing.amount,v_existing.reason,v_existing.payment_method,v_existing.granted_by)
     is distinct from (p_subscription_id,p_amount,trim(p_reason),p_method,v_staff.id) then raise exception 'Request already used with different details'; end if;
  return v_existing.id;
 end if;
 select * into v_payment from public.transactions where subscription_id=v_sub.id and type='revenue' and category='subscription' for update;
 if not found or v_payment.player_id is distinct from v_sub.player_id then raise exception 'Original payment not found'; end if;
 select coalesce(sum(amount),0) into v_total from public.subscription_support where original_payment_id=v_payment.id;
 if v_total+p_amount>v_payment.amount then raise exception 'Support exceeds remaining paid amount'; end if;
 v_tx:='support-'||p_request_id::text;
 insert into public.subscription_support(id,subscription_id,original_payment_id,transaction_id,player_id,amount,reason,payment_method,granted_by)
 values(p_request_id,v_sub.id,v_payment.id,v_tx,v_sub.player_id,p_amount,trim(p_reason),p_method,v_staff.id);
 insert into public.transactions(id,type,category,amount,transaction_date,description,recorded_by,player_id)
 values(v_tx,'expense','subscription_support',p_amount,(now() at time zone 'Asia/Bahrain')::date,
 'دعم بعد الدفع / Post-payment support: '||trim(p_reason)||' ['||v_payment.id||']',v_staff.name,v_sub.player_id);
 insert into public.audit_logs(id,action,timestamp,user_role,user_name,details)
 values('audit-'||gen_random_uuid()::text,'subscription_support_granted',now()::text,'manager',v_staff.name,
 jsonb_build_object('support_id',p_request_id,'subscription_id',v_sub.id,'original_payment_id',v_payment.id,'amount',p_amount,'reason',trim(p_reason),'method',p_method)::text);
 return p_request_id;
end $$;
create function public.grant_subscription_support(p_request_id uuid,p_subscription_id text,p_amount numeric,p_reason text,p_method text)
returns uuid language sql security invoker set search_path='' as $$
 select internal.grant_subscription_support(p_request_id,p_subscription_id,p_amount,p_reason,p_method)
$$;
revoke all on function internal.grant_subscription_support(uuid,text,numeric,text,text),public.grant_subscription_support(uuid,text,numeric,text,text) from public,anon;
grant execute on function internal.grant_subscription_support(uuid,text,numeric,text,text),public.grant_subscription_support(uuid,text,numeric,text,text) to authenticated;

-- An exemption never represents a cash receipt or payout.
create function internal.guard_exempt_subscription() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='exempt' and (new.amount<>0 or new.paid_at is not null or nullif(trim(new.payment_method),'') is not null) then
  raise exception 'Exempt subscriptions must have zero amount and no payment metadata';
 end if;
 return new;
end $$;
revoke all on function internal.guard_exempt_subscription() from public,anon,authenticated;
create trigger exempt_subscription_guard before insert or update on public.subscriptions
for each row execute function internal.guard_exempt_subscription();
