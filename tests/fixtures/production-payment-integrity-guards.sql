-- Preserve existing production accounting guard semantics.
-- Live: trg_require_payment_transaction is a DEFERRABLE INITIALLY DEFERRED
-- constraint trigger on subscriptions; transaction subscription-link guard
-- is an immediate BEFORE INSERT/UPDATE trigger.
-- These definitions are installed only if absent (e.g. disposable local DB).
-- Do not weaken or replace production's existing guard functions.
do $setup$
begin
 if to_regprocedure('internal.require_payment_transaction()') is null then
  execute $create$
  create function internal.require_payment_transaction() returns trigger
  language plpgsql security definer set search_path='' as $body$
  declare s public.subscriptions%rowtype;
  begin
   if tg_op='UPDATE' and
     (new.status,new.amount,new.player_id,new.payment_method,new.paid_at)
     is not distinct from
     (old.status,old.amount,old.player_id,old.payment_method,old.paid_at)
   then return null; end if;
   select * into s from public.subscriptions where id=new.id;
   if found and s.status='paid' and not exists (
    select 1 from public.transactions t
    where t.subscription_id=s.id and t.player_id=s.player_id
      and t.amount=s.amount and t.type='revenue' and t.category='subscription'
   ) then raise exception 'A paid subscription requires its linked payment transaction'; end if;
   return null;
  end
  $body$;
  $create$;
 end if;
 if to_regprocedure('internal.validate_transaction_subscription_link()') is null then
  execute $create$
  create function internal.validate_transaction_subscription_link() returns trigger
  language plpgsql security definer set search_path='' as $body$
  declare v_sub public.subscriptions%rowtype;
  begin
   if new.subscription_id is not null then
    select * into v_sub from public.subscriptions where id=new.subscription_id;
    if not found then raise exception 'Referenced subscription does not exist'; end if;
    if new.type <> 'revenue' or lower(new.category) <> 'subscription'
      then raise exception 'A transaction linked to a subscription must be revenue/subscription'; end if;
    if v_sub.status <> 'paid'
      then raise exception 'A transaction linked to a subscription requires a paid subscription'; end if;
    if new.amount <> v_sub.amount
      then raise exception 'Transaction amount must match the linked subscription amount'; end if;
    if new.player_id is not null and new.player_id is distinct from v_sub.player_id
      then raise exception 'Transaction player_id must match the linked subscription player_id'; end if;
   end if;
   return new;
  end
  $body$;
  $create$;
 end if;
 if not exists (
   select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where t.tgname='trg_require_payment_transaction' and c.oid='public.subscriptions'::regclass
 ) then
   create constraint trigger trg_require_payment_transaction
   after insert or update on public.subscriptions
   deferrable initially deferred for each row
   execute function internal.require_payment_transaction();
 end if;
 if not exists (
   select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where t.tgname='trg_validate_transaction_subscription_link' and c.oid='public.transactions'::regclass
 ) then
   create trigger trg_validate_transaction_subscription_link
   before insert or update on public.transactions
   for each row execute function internal.validate_transaction_subscription_link();
 end if;
end
$setup$;
