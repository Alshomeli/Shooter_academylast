alter table public.payment_proofs add column if not exists receipt_number bigint;
create sequence if not exists public.payment_receipt_seq start with 1001;
alter sequence public.payment_receipt_seq owned by public.payment_proofs.receipt_number;
create unique index if not exists uq_payment_proofs_receipt_number on public.payment_proofs(receipt_number) where receipt_number is not null;

create or replace function internal.approve_payment_proof_impl(p_proof_id uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare v_staff public.staff; v_proof public.payment_proofs; v_sub public.subscriptions; v_tx_id text; v_receipt bigint;
begin
 select * into v_staff from public.staff where user_id=auth.uid() and status='active' and role in ('manager','accountant') limit 1;
 if v_staff.id is null then raise exception 'not authorized'; end if;
 select * into v_proof from public.payment_proofs where id=p_proof_id for update;
 if v_proof.id is null then raise exception 'payment proof not found'; end if;
 if v_proof.status<>'pending' then raise exception 'payment proof already processed'; end if;
 select * into v_sub from public.subscriptions where id=v_proof.subscription_id for update;
 if v_sub.id is null or v_sub.player_id<>v_proof.player_id then raise exception 'invalid subscription'; end if;
 if v_sub.status<>'unpaid' then raise exception 'subscription already paid'; end if;
 if v_sub.amount<>v_proof.amount then raise exception 'amount mismatch'; end if;
 v_tx_id := 'txn-proof-' || p_proof_id::text;
 v_receipt := nextval('public.payment_receipt_seq');
 update public.subscriptions set status='paid',payment_method='benefit_transfer',paid_at=now(),row_version=row_version+1 where id=v_sub.id;
 insert into public.transactions(id,type,category,amount,transaction_date,description,recorded_by,subscription_id,player_id)
 values(v_tx_id,'revenue','subscription',v_proof.amount,(now() at time zone 'Asia/Bahrain')::date,'Benefit transfer approved from parent payment proof',v_staff.name,v_sub.id,v_sub.player_id);
 update public.payment_proofs set status='approved',receipt_number=v_receipt,reviewed_by=v_staff.id,reviewed_at=now(),updated_at=now(),row_version=row_version+1 where id=p_proof_id;
 insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
 values('notif-payment-'||p_proof_id::text,'تم اعتماد الدفعة','تم التحقق من تحويل الاشتراك واعتماد الدفعة. رقم الإيصال: SA-'||lpad(v_receipt::text,6,'0'),to_char(now() at time zone 'Asia/Bahrain','YYYY-MM-DD HH24:MI'),'success',false,v_proof.parent_user_id)
 on conflict(id) do nothing;
 return v_tx_id;
end $$;
