-- Preserve identity separately: no financial row, amount, status or receipt is rewritten.
create table public.financial_record_identity (
 record_kind text not null check(record_kind in ('subscription','transaction','refund')),
 record_id text not null,
 player_id text not null,
 player_name text not null,
 parent_name text not null,
 parent_user_id uuid,
 captured_at timestamptz not null default now(),
 capture_source text not null check(capture_source in ('backfill','issued')),
 primary key(record_kind,record_id)
);
alter table public.financial_record_identity enable row level security;
revoke all on public.financial_record_identity from public,anon,authenticated;
grant select on public.financial_record_identity to authenticated;
create policy financial_identity_read on public.financial_record_identity for select to authenticated
 using (parent_user_id=(select auth.uid()) or exists(select 1 from public.staff s
 where s.user_id=(select auth.uid()) and s.status='active' and s.role in ('manager','accountant')));

-- Historical names are recovered from surviving records, never claimed as original names.
insert into public.financial_record_identity(record_kind,record_id,player_id,player_name,parent_name,parent_user_id,capture_source)
 select 'subscription',s.id,s.player_id,coalesce(pl.name,''),coalesce(pa.name,pl.parent_name,''),pa.user_id,'backfill'
 from public.subscriptions s left join public.players pl on pl.id=s.player_id left join public.parents pa on pa.id=pl.parent_id;
insert into public.financial_record_identity(record_kind,record_id,player_id,player_name,parent_name,parent_user_id,capture_source)
 select 'transaction',t.id,t.player_id,coalesce(i.player_name,pl.name,''),coalesce(i.parent_name,pa.name,pl.parent_name,''),coalesce(i.parent_user_id,pa.user_id),'backfill'
 from public.transactions t left join public.financial_record_identity i on i.record_kind='subscription' and i.record_id=t.subscription_id
 left join public.players pl on pl.id=t.player_id left join public.parents pa on pa.id=pl.parent_id where t.player_id is not null;
insert into public.financial_record_identity(record_kind,record_id,player_id,player_name,parent_name,parent_user_id,capture_source)
 select 'refund',r.id::text,r.player_id,coalesce(i.player_name,pl.name,''),coalesce(i.parent_name,pa.name,pl.parent_name,''),coalesce(i.parent_user_id,pa.user_id),'backfill'
 from public.subscription_support r left join public.financial_record_identity i on i.record_kind='transaction' and i.record_id=r.original_payment_id
 left join public.players pl on pl.id=r.player_id left join public.parents pa on pa.id=pl.parent_id;

create function internal.capture_financial_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_kind text; v_ref text; v_original text; v_parent text; v_name text; v_parent_name text; v_user uuid;
begin
 if new.player_id is null then return new; end if;
 v_kind:=case tg_table_name when 'subscriptions' then 'subscription' when 'transactions' then 'transaction' else 'refund' end;
 if tg_op='UPDATE' and new.player_id is not distinct from old.player_id then return new; end if;
 select pl.name,coalesce(pa.name,pl.parent_name,''),pa.user_id into v_name,v_parent_name,v_user
 from public.players pl left join public.parents pa on pa.id=pl.parent_id where pl.id=new.player_id;
 if v_kind='transaction' then
  v_ref:=new.subscription_id;
  -- Refund transactions retain the identity at the original payment.
  select r.original_payment_id into v_original from public.subscription_support r where r.transaction_id=new.id;
 elsif v_kind='refund' then v_original:=new.original_payment_id;
 end if;
 if v_original is not null then
  select i.player_name,i.parent_name,i.parent_user_id into v_name,v_parent_name,v_user
  from public.financial_record_identity i where i.record_kind='transaction' and i.record_id=v_original;
 elsif v_ref is not null then
  select i.player_name,i.parent_name,i.parent_user_id into v_name,v_parent_name,v_user
  from public.financial_record_identity i where i.record_kind='subscription' and i.record_id=v_ref;
 end if;
 insert into public.financial_record_identity(record_kind,record_id,player_id,player_name,parent_name,parent_user_id,capture_source)
 values(v_kind,new.id::text,new.player_id,coalesce(v_name,''),coalesce(v_parent_name,''),v_user,'issued')
 on conflict(record_kind,record_id) do update set player_id=excluded.player_id,player_name=excluded.player_name,
 parent_name=excluded.parent_name,parent_user_id=excluded.parent_user_id,captured_at=now(),capture_source='issued';
 return new;
end $$;
revoke all on function internal.capture_financial_identity() from public,anon,authenticated,service_role;
create trigger capture_financial_identity after insert or update of player_id on public.subscriptions
 for each row execute function internal.capture_financial_identity();
create trigger capture_financial_identity after insert on public.transactions
 for each row execute function internal.capture_financial_identity();
create trigger capture_financial_identity after insert on public.subscription_support
 for each row execute function internal.capture_financial_identity();

notify pgrst,'reload schema';
