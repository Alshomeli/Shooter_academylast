-- Staging only. Atomic manager approval and per-subscription ledger posting.
-- Run only after family receipt migrations in an isolated database first.
create or replace function public.approve_family_payment_receipt(
 p_receipt_id uuid, p_confirmed_amount numeric
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_staff public.staff;
 v_receipt public.family_payment_receipts;
 v_line record;
 v_sub public.subscriptions;
 v_sum numeric(12,3);
 v_count integer;
 v_parent uuid;
 v_receipt_no bigint;
begin
 select * into v_staff from public.staff
 where user_id = auth.uid() and status = 'active' and role = 'manager' limit 1;
 if v_staff.id is null then raise exception 'Manager authorization required'; end if;
 if p_confirmed_amount is null or p_confirmed_amount <= 0 or
    p_confirmed_amount <> round(p_confirmed_amount,3)
 then raise exception 'Invalid verified transfer amount'; end if;
 select * into v_receipt from public.family_payment_receipts
 where id = p_receipt_id for update;
 if v_receipt.id is null then raise exception 'Family receipt not found'; end if;
 if v_receipt.status <> 'pending' then raise exception 'Receipt not pending'; end if;

 -- Serialize other attempts for the same parent's subscriptions.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_receipt.parent_user_id::text, 0));
 select count(*),sum(amount) into v_count,v_sum
 from public.family_payment_receipt_items where receipt_id = p_receipt_id;
 if v_count < 2 or v_count > 20 or v_sum <> v_receipt.expected_amount or
    v_sum <> p_confirmed_amount
 then raise exception 'Verified bank amount or allocations mismatch'; end if;

 -- Lock each subscription and validate current ownership, status and amount.
 -- Any exception aborts the entire transaction including ledger entries.
 for v_line in select * from public.family_payment_receipt_items
   where receipt_id = p_receipt_id order by subscription_id
 loop
   select * into v_sub from public.subscriptions where id = v_line.subscription_id for update;
   if v_sub.id is null or v_sub.player_id is distinct from v_line.player_id
       or v_sub.status <> 'unpaid' or v_sub.amount <> v_line.amount
   then raise exception 'Subscription has changed since receipt submission'; end if;
   if not exists (
     select 1 from public.players pl join public.parents pa on pa.id=pl.parent_id
     where pl.id=v_line.player_id and pa.user_id=v_receipt.parent_user_id
   ) then raise exception 'Sibling ownership has changed'; end if;
   if exists (
      select 1 from public.payment_proofs pp where pp.subscription_id = v_line.subscription_id
      and pp.status in ('pending','needs_info','approved')
   ) then raise exception 'Conflicting individual proof'; end if;
   if exists (
      select 1 from public.transactions tx where tx.subscription_id = v_sub.id
      and tx.type='revenue' and tx.category='subscription'
   ) then raise exception 'Subscription revenue already recorded'; end if;
 end loop;

 for v_line in select * from public.family_payment_receipt_items
   where receipt_id=p_receipt_id order by subscription_id
 loop
   v_receipt_no := nextval('public.payment_receipt_seq');
   update public.family_payment_receipt_items
   set receipt_number=v_receipt_no
   where receipt_id=p_receipt_id and subscription_id=v_line.subscription_id;
   update public.subscriptions
   set status='paid',payment_method='benefit_transfer',paid_at=now(),row_version=row_version+1
   where id=v_line.subscription_id and status='unpaid';
   -- Activate a newly registered player on their first verified payment only.
   -- Existing players and manually disabled players with earlier paid history
   -- are excluded. A manager may later deactivate the player explicitly.
   update public.players pl
   set status='active',row_version=row_version+1
   where pl.id=v_line.player_id
     and pl.status='inactive'
     and exists (select 1 from public.registration_children rc
                 where rc.approved_player_id=pl.id)
     and not exists (
       select 1 from public.subscriptions prior
       where prior.player_id=pl.id and prior.id<>v_line.subscription_id
         and prior.status='paid'
     )
     and not exists (
       select 1 from public.transactions prior_tx
       where prior_tx.player_id=pl.id and prior_tx.subscription_id<>v_line.subscription_id
         and prior_tx.type='revenue' and prior_tx.category='subscription'
     );
   insert into public.transactions(id,type,category,amount,transaction_date,description,recorded_by,subscription_id,player_id)
   values('txn-family-'||p_receipt_id::text||'-'||v_line.subscription_id,
     'revenue','subscription',v_line.amount,(now() at time zone 'Asia/Bahrain')::date,
     'Family bank transfer verified by manager, receipt SA-'||pg_catalog.lpad(v_receipt_no::text,6,'0'),
     v_staff.name,v_line.subscription_id,v_line.player_id);
 end loop;
 update public.family_payment_receipts
 set status='approved',reviewed_by=v_staff.id,reviewed_at=now(),review_note='Verified bank amount by manager'
 where id=p_receipt_id and status='pending';
 insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
 values('notif-family-payment-'||p_receipt_id::text,
   'تم اعتماد الدفعة العائلية',
   'تم اعتماد التحويل العائلي وتوزيع المبلغ على اشتراكات الأبناء.',
   pg_catalog.to_char(now() at time zone 'Asia/Bahrain','YYYY-MM-DD HH24:MI'),
   'success',false,v_receipt.parent_user_id)
 on conflict(id) do nothing;
 return p_receipt_id;
end
$$;
revoke all on function public.approve_family_payment_receipt(uuid,numeric) from public,anon;
grant execute on function public.approve_family_payment_receipt(uuid,numeric) to authenticated;
