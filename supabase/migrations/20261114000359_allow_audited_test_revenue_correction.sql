-- Preserve posted payments while permitting an audited reversal of a test payment.
alter table public.transactions drop constraint chk_transactions_amount_positive;
alter table public.transactions add constraint chk_transactions_amount_positive check (
  amount >= 0 or (
    type = 'revenue' and category = 'test_payment_correction' and subscription_id is null
  )
);

create function internal.guard_test_payment_correction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' and old.category = 'test_payment_correction' then
    raise exception 'Test payment corrections are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.category <> 'test_payment_correction' then return new; end if;

  if tg_op <> 'INSERT' or current_user <> 'postgres' then
    raise exception 'Test payment correction requires database administration' using errcode = '42501';
  end if;
  if new.type <> 'revenue' or new.amount >= 0 or new.subscription_id is not null or not exists (
    select 1
    from public.transactions original
    join public.subscriptions subscription on subscription.id = original.subscription_id
    where new.id = 'test-payment-correction:' || original.id
      and original.type = 'revenue' and original.category = 'subscription'
      and original.amount = -new.amount and original.transaction_date = new.transaction_date
      and original.player_id = new.player_id and subscription.status = 'cancelled'
      and exists (
        select 1 from public.payment_proofs proof
        where proof.subscription_id = subscription.id and proof.player_id = new.player_id
          and proof.amount = original.amount and proof.status = 'approved'
      )
      and not exists (
        select 1 from public.subscription_support support where support.subscription_id = subscription.id
      )
      and not exists (
        select 1 from public.family_payment_receipt_items item where item.subscription_id = subscription.id
      )
  ) then
    raise exception 'Correction must reverse a matching cancelled test payment';
  end if;
  return new;
end;
$$;

create trigger guard_test_payment_correction
before insert or update or delete on public.transactions
for each row execute function internal.guard_test_payment_correction();

revoke all on function internal.guard_test_payment_correction() from public, anon, authenticated;
