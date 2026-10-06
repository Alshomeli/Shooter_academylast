create or replace function internal.record_subscription_payment(
  p_subscription_id text,
  p_amount numeric,
  p_payment_method text,
  p_transaction_date text default null,
  p_description text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_txn public.transactions%rowtype;
  v_role text;
  v_now_text text;
begin
  if (auth.uid() is null) then
    raise exception 'Authentication required';
  end if;

  v_role := internal.current_user_role();
  if v_role not in ('manager','accountant') then
    raise exception 'Only manager or accountant can record payments';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if nullif(trim(coalesce(p_payment_method,'')), '') is null then
    raise exception 'Payment method is required';
  end if;

  select * into v_sub
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    raise exception 'Subscription not found';
  end if;

  if v_sub.status = 'paid' then
    raise exception 'Subscription is already paid';
  end if;

  if p_amount <> v_sub.amount then
    raise exception 'Payment amount must equal subscription amount';
  end if;

  v_now_text := coalesce(nullif(trim(coalesce(p_transaction_date,'')), ''), to_char(current_date, 'YYYY-MM-DD'));

  update public.subscriptions
  set status = 'paid',
      payment_method = trim(p_payment_method),
      paid_at = to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
  where id = v_sub.id;

  insert into public.transactions (
    id, type, category, amount, transaction_date, description, recorded_by,
    subscription_id, player_id
  ) values (
    'txn-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '-' || substr(md5(random()::text),1,8),
    'revenue',
    'subscription',
    p_amount,
    v_now_text,
    coalesce(nullif(trim(coalesce(p_description,'')), ''), 'سداد اشتراك ' || v_sub.id),
    coalesce((select name from public.staff where user_id = auth.uid() limit 1), coalesce(auth.jwt() ->> 'email','')),
    v_sub.id,
    v_sub.player_id
  ) returning * into v_txn;

  return v_txn;
end;
$$;

revoke all on function internal.record_subscription_payment(text,numeric,text,text,text) from public;
grant execute on function internal.record_subscription_payment(text,numeric,text,text,text) to authenticated;

create or replace function public.record_subscription_payment(
  p_subscription_id text,
  p_amount numeric,
  p_payment_method text,
  p_transaction_date text default null,
  p_description text default null
)
returns public.transactions
language sql
security invoker
set search_path = public, internal
as $$
  select internal.record_subscription_payment($1,$2,$3,$4,$5);
$$;

revoke all on function public.record_subscription_payment(text,numeric,text,text,text) from public;
grant execute on function public.record_subscription_payment(text,numeric,text,text,text) to authenticated;

create or replace function internal.audit_subscription_payment()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
begin
  insert into public.audit_logs (action, entity_type, entity_id, details)
  values (
    'subscription_payment_recorded',
    'subscription',
    new.subscription_id,
    jsonb_build_object(
      'transaction_id', new.id,
      'amount', new.amount,
      'payment_method', (select s.payment_method from public.subscriptions s where s.id = new.subscription_id),
      'player_id', new.player_id
    )
  );
  return new;
end;
$$;

revoke all on function internal.audit_subscription_payment() from public;

drop trigger if exists trg_audit_subscription_payment on public.transactions;
create trigger trg_audit_subscription_payment
after insert on public.transactions
for each row
when (new.category = 'subscription' and new.type = 'revenue' and new.subscription_id is not null)
execute function internal.audit_subscription_payment();
