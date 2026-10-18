-- Development only; do not apply to production until reviewed and tested in isolation.
-- Requires 20261018032000_family_payment_receipt_batches.sql.
-- One receipt may cover multiple unpaid siblings for exactly one billing period.
-- This RPC never approves a receipt, marks a subscription paid, or writes transactions.
create or replace function public.submit_family_payment_receipt(
  p_subscription_ids text[], p_proof_path text, p_transfer_date date
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_players integer;
  v_periods integer;
  v_total numeric(12,3);
  v_id uuid;
  v_path_owner text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_subscription_ids is null or array_length(p_subscription_ids, 1) is null
     or array_length(p_subscription_ids, 1) < 2 or array_length(p_subscription_ids, 1) > 20
     or exists (select 1 from unnest(p_subscription_ids) t(x) where x is null or length(x) > 200)
     or (select count(distinct x) from unnest(p_subscription_ids) t(x)) <> array_length(p_subscription_ids, 1)
  then raise exception 'Invalid subscription selection'; end if;
  if p_transfer_date is null or p_transfer_date > current_date then
    raise exception 'Invalid transfer date';
  end if;
  if p_proof_path is null or length(p_proof_path) > 1024
    or p_proof_path !~ ('^' || v_uid::text || '/family/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$')
  then raise exception 'Invalid private receipt path'; end if;

  -- Lock existing subscriptions deterministically before verifying ownership and totals.
  perform 1 from public.subscriptions s where s.id = any(p_subscription_ids)
    order by s.id for update;
  select count(*), count(distinct s.player_id),
      count(distinct (s.start_date, s.end_date)), sum(s.amount)
    into v_count, v_players, v_periods, v_total
  from public.subscriptions s
  join public.players pl on pl.id = s.player_id
  join public.parents pa on pa.id = pl.parent_id
  where s.id = any(p_subscription_ids)
    and pa.user_id = v_uid and s.status = 'unpaid'
    and s.amount > 0
    and s.amount = round(s.amount, 3);
  if v_count <> array_length(p_subscription_ids,1)
    or v_players <> v_count or v_periods <> 1 or v_total <= 0
  then raise exception 'Subscriptions are not eligible for family receipt'; end if;

  -- Verify the uploaded file exists in private storage. Parent has no permission
  -- to attach another user's object; upload permission is separately RLS controlled.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'payment-proofs'
      and o.name = p_proof_path
      and o.owner_id = v_uid::text
  ) then raise exception 'Receipt upload not found or not owned by parent'; end if;

  -- Existing individual proofs cannot be silently replaced.
  if exists (select 1 from public.payment_proofs pr
             where pr.subscription_id = any(p_subscription_ids)
               and pr.status in ('pending','needs_info','approved'))
     or exists (select 1 from public.family_payment_receipt_items fi
                where fi.subscription_id = any(p_subscription_ids))
  then raise exception 'Payment proof already exists for selected subscription'; end if;

  insert into public.family_payment_receipts(parent_user_id,proof_path,transfer_date,expected_amount,status)
  values(v_uid,p_proof_path,p_transfer_date,v_total,'pending') returning id into v_id;
  insert into public.family_payment_receipt_items(receipt_id,subscription_id,player_id,amount)
  select v_id,s.id,s.player_id,s.amount from public.subscriptions s
  where s.id = any(p_subscription_ids);
  return v_id;
end
$$;
revoke all on function public.submit_family_payment_receipt(text[],text,date) from public, anon;
grant execute on function public.submit_family_payment_receipt(text[],text,date) to authenticated;
