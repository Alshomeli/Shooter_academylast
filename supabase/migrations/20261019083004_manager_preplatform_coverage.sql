-- Opening entitlement only: no cash transaction, payment receipt, or exemption.
create table public.preplatform_coverage (
 player_id text primary key references public.players(id),
 covered_from date not null,
 next_due_date date not null check(next_due_date>covered_from),
 monthly_amount numeric(12,3) not null check(monthly_amount>0),
 reason text not null check(length(trim(reason)) between 3 and 1000),
 approved_by text not null references public.staff(id),
 future_subscription_id text not null unique references public.subscriptions(id) deferrable initially deferred,
 created_at timestamptz not null default now()
);
alter table public.preplatform_coverage enable row level security;
revoke all on public.preplatform_coverage from public,anon,authenticated;
grant select on public.preplatform_coverage to authenticated;
create policy preplatform_coverage_read on public.preplatform_coverage for select to authenticated using (
 exists(select 1 from public.staff where user_id=(select auth.uid()) and status='active' and role in ('manager','accountant','receptionist'))
 or exists(select 1 from public.players p join public.parents pp on pp.id=p.parent_id where p.id=player_id and pp.user_id=(select auth.uid()))
);
create function internal.guard_preplatform_coverage() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='preplatform_coverage' then raise exception 'Opening coverage records are immutable'; end if;
 if exists(select 1 from public.preplatform_coverage c where c.player_id=new.player_id
   and new.start_date<c.next_due_date and new.end_date>=c.covered_from) then
  raise exception 'Subscription overlaps approved pre-platform coverage';
 end if;
 if new.status='paid' and new.start_date>(now() at time zone 'Asia/Bahrain')::date
 and exists(select 1 from public.preplatform_coverage c where c.future_subscription_id=new.id) then
  raise exception 'The next payment is not due yet';
 end if;
 return new;
end $$;
revoke all on function internal.guard_preplatform_coverage() from public,anon,authenticated;
create trigger opening_coverage_immutable before update or delete on public.preplatform_coverage for each row execute function internal.guard_preplatform_coverage();
create trigger opening_coverage_subscription_guard before insert or update on public.subscriptions for each row execute function internal.guard_preplatform_coverage();

create function internal.approve_preplatform_coverage(p_player_id text,p_covered_from date,p_next_due_date date,p_monthly_amount numeric,p_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare v_staff public.staff; v_player public.players; v_existing public.preplatform_coverage;
 v_sub text; v_removed jsonb; v_today date:=(now() at time zone 'Asia/Bahrain')::date;
begin
 select * into v_staff from public.staff where user_id=auth.uid() and status='active' and role='manager' limit 1;
 if v_staff.id is null then raise exception 'Active manager required' using errcode='42501'; end if;
 if p_covered_from is null or p_covered_from>v_today or p_next_due_date is null or p_next_due_date<=v_today or p_next_due_date>v_today+366 or p_next_due_date<=p_covered_from then raise exception 'Invalid coverage dates'; end if;
 if p_monthly_amount is null or p_monthly_amount::text in ('NaN','Infinity','-Infinity') or p_monthly_amount<=0 or p_monthly_amount<>round(p_monthly_amount,3) then raise exception 'Invalid monthly fee'; end if;
 if p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'Previous payment reference or reason required'; end if;
 select * into v_player from public.players where id=p_player_id for update;
 if not found then raise exception 'Player not found'; end if;
 select * into v_existing from public.preplatform_coverage where player_id=p_player_id;
 if found then
  if (v_existing.covered_from,v_existing.next_due_date,v_existing.monthly_amount,v_existing.reason) is distinct from (p_covered_from,p_next_due_date,p_monthly_amount,trim(p_reason)) then raise exception 'Previous payment already approved'; end if;
  return v_existing.future_subscription_id;
 end if;
 perform 1 from public.subscriptions where player_id=p_player_id for update;
 if exists(select 1 from public.transactions where player_id=p_player_id)
 or exists(select 1 from public.payment_proofs where player_id=p_player_id)
 or exists(select 1 from public.family_payment_receipt_items where player_id=p_player_id)
 or exists(select 1 from public.subscriptions where player_id=p_player_id and
   (status<>'unpaid' or start_date<p_covered_from or end_date>=p_next_due_date)) then
  raise exception 'Existing billing or payment evidence requires review before opening coverage';
 end if;
 select coalesce(jsonb_agg(id),'[]'::jsonb) into v_removed from public.subscriptions where player_id=p_player_id;
 delete from public.subscriptions where player_id=p_player_id;
 v_sub:='opening-renewal-'||gen_random_uuid()::text;
 insert into public.preplatform_coverage(player_id,covered_from,next_due_date,monthly_amount,reason,approved_by,future_subscription_id)
 values(p_player_id,p_covered_from,p_next_due_date,p_monthly_amount,trim(p_reason),v_staff.id,v_sub);
 insert into public.subscriptions(id,player_id,plan_type,amount,start_date,end_date,status)
 values(v_sub,p_player_id,'monthly',p_monthly_amount,p_next_due_date,(p_next_due_date+interval '1 month')::date,'unpaid');
 insert into public.player_recurring_fees(player_id,monthly_amount,updated_by,updated_at)
 values(p_player_id,p_monthly_amount,auth.uid(),now()) on conflict(player_id) do update
 set monthly_amount=excluded.monthly_amount,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 update public.players set status='active' where id=p_player_id;
 insert into public.audit_logs(id,action,timestamp,user_role,user_name,details)
 values('audit-'||gen_random_uuid()::text,'preplatform_coverage_approved',now()::text,'manager',v_staff.name,
 jsonb_build_object('player_id',p_player_id,'covered_from',p_covered_from,'next_due_date',p_next_due_date,'monthly_amount',p_monthly_amount,'reason',trim(p_reason),'superseded_unpaid_subscriptions',v_removed)::text);
 return v_sub;
end $$;
create function public.approve_preplatform_coverage(p_player_id text,p_covered_from date,p_next_due_date date,p_monthly_amount numeric,p_reason text)
returns text language sql security invoker set search_path='' as $$
 select internal.approve_preplatform_coverage(p_player_id,p_covered_from,p_next_due_date,p_monthly_amount,p_reason)
$$;
revoke all on function internal.approve_preplatform_coverage(text,date,date,numeric,text),public.approve_preplatform_coverage(text,date,date,numeric,text) from public,anon;
grant execute on function internal.approve_preplatform_coverage(text,date,date,numeric,text),public.approve_preplatform_coverage(text,date,date,numeric,text) to authenticated;
