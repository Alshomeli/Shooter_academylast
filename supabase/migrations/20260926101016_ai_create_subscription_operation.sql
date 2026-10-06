alter table public.ai_action_requests
  drop constraint if exists ai_action_requests_operation_check



alter table public.ai_action_requests
  add constraint ai_action_requests_operation_check
  check (operation = any (array[
    'approve_registration'::text,
    'review_registration'::text,
    'record_subscription_payment'::text,
    'record_attendance'::text,
    'publish_player_evaluation'::text,
    'create_subscription'::text
  ]))



create or replace function internal.create_subscription_entry_impl(
  p_player_id text,
  p_plan_type text,
  p_start_date date
)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_player public.players%rowtype;
  v_settings public.academy_settings%rowtype;
  v_sub public.subscriptions%rowtype;
  v_amount numeric;
  v_end_date date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_role := internal.current_user_role();
  if v_role is null or v_role not in ('manager', 'accountant', 'receptionist') then
    raise exception 'Not authorized to create subscriptions' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_player_id, '')), '') is null then
    raise exception 'Player is required';
  end if;
  if p_plan_type not in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    raise exception 'Invalid plan type';
  end if;
  if p_start_date is null then
    raise exception 'Start date is required';
  end if;

  select * into v_player
  from public.players
  where id = p_player_id;

  if not found then
    raise exception 'Player not found';
  end if;
  if v_player.status <> 'active' then
    raise exception 'Subscription can only be created for an active player';
  end if;

  select * into v_settings
  from public.academy_settings
  order by id
  limit 1;

  if not found then
    raise exception 'Academy settings not found';
  end if;

  v_amount := case p_plan_type
    when 'monthly' then v_settings.subscription_fee_monthly
    when 'quarterly' then v_settings.subscription_fee_quarterly
    when 'semi_annual' then v_settings.subscription_fee_semi_annual
    when 'annual' then v_settings.subscription_fee_yearly
  end;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Subscription fee is not configured for this plan';
  end if;

  v_end_date := case p_plan_type
    when 'monthly' then (p_start_date + interval '1 month')::date
    when 'quarterly' then (p_start_date + interval '3 months')::date
    when 'semi_annual' then (p_start_date + interval '6 months')::date
    when 'annual' then (p_start_date + interval '12 months')::date
  end;

  select * into v_sub
  from public.subscriptions
  where player_id = p_player_id
    and plan_type = p_plan_type
    and start_date = p_start_date
  order by created_at desc
  limit 1;

  if found then
    if v_sub.status = 'unpaid' then
      return v_sub;
    end if;
    raise exception 'A subscription already exists for this player, plan and start date';
  end if;

  insert into public.subscriptions (
    id, player_id, plan_type, amount, start_date, end_date, status, payment_method, paid_at
  )
  values (
    'sub-' || gen_random_uuid()::text,
    p_player_id,
    p_plan_type,
    v_amount,
    p_start_date,
    v_end_date,
    'unpaid',
    null,
    null
  )
  returning * into v_sub;

  return v_sub;
end;
$$



create or replace function public.create_subscription_entry(
  p_player_id text,
  p_plan_type text,
  p_start_date date
)
returns public.subscriptions
language sql
set search_path = ''
as $$
  select internal.create_subscription_entry_impl($1,$2,$3);
$$



revoke all on function public.create_subscription_entry(text,text,date) from public, anon


grant execute on function public.create_subscription_entry(text,text,date) to authenticated
