create or replace function internal.validate_transaction_subscription_link()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $function$
declare
  v_sub public.subscriptions%rowtype;
begin
  if new.subscription_id is not null then
    select * into v_sub
    from public.subscriptions s
    where s.id = new.subscription_id;

    if not found then
      raise exception 'Referenced subscription does not exist';
    end if;

    if new.type <> 'revenue' or lower(new.category) <> 'subscription' then
      raise exception 'A transaction linked to a subscription must be revenue/subscription';
    end if;

    if v_sub.status <> 'paid' then
      raise exception 'A transaction linked to a subscription requires a paid subscription';
    end if;

    if new.amount <> v_sub.amount then
      raise exception 'Transaction amount must match the linked subscription amount';
    end if;

    if new.player_id is not null and new.player_id is distinct from v_sub.player_id then
      raise exception 'Transaction player_id must match the linked subscription player_id';
    end if;
  end if;
  return new;
end;
$function$;

revoke execute on function internal.validate_transaction_subscription_link() from public, anon, authenticated, service_role;
grant execute on function internal.validate_transaction_subscription_link() to postgres;
