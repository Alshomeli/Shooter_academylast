-- Shared approval: identity is resolved at each entry point, never impersonated.
create or replace function internal.approve_payment_proof_as_staff(p_proof_id uuid,p_staff_id text)
returns text language plpgsql security definer set search_path=''
as $$
declare v_staff public.staff; v_proof public.payment_proofs; v_sub public.subscriptions; v_tx_id text; v_receipt bigint;
begin
 select * into v_staff from public.staff where id=p_staff_id and status='active' and role in ('manager','accountant') limit 1;
 if v_staff.id is null then raise exception 'not authorized'; end if;
 select * into v_proof from public.payment_proofs where id=p_proof_id for update;
 if v_proof.id is null then raise exception 'payment proof not found'; end if;
 if v_proof.status='approved' then return 'txn-proof-'||p_proof_id::text; end if;
 if v_proof.status<>'pending' then raise exception 'payment proof already processed'; end if;
 select * into v_sub from public.subscriptions where id=v_proof.subscription_id for update;
 if v_sub.id is null or v_sub.player_id<>v_proof.player_id then raise exception 'invalid subscription'; end if;
 if v_sub.status='paid' then return null; end if;
 if v_sub.status<>'unpaid' then raise exception 'subscription is not payable'; end if;
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

revoke all on function internal.approve_payment_proof_as_staff(uuid,text) from public,anon,authenticated,service_role;

create or replace function internal.approve_payment_proof_impl(p_proof_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_staff text; v_result text;
begin
 select id into v_staff from public.staff where user_id=auth.uid()
 and status='active' and role in ('manager','accountant') limit 1;
 if v_staff is null then raise exception 'not authorized' using errcode='42501'; end if;
 v_result:=internal.approve_payment_proof_as_staff(p_proof_id,v_staff);
 if v_result is null then raise exception 'subscription already paid'; end if;
 return v_result;
end $$;

create or replace function public.telegram_approve_payment_proof(p_proof_id uuid,p_chat_id_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff text; v_proof public.payment_proofs; v_status text; v_tx text;
begin
 select s.id into v_staff from internal.telegram_manager_bindings b
 join public.staff s on s.id=b.staff_id
 where b.chat_id_hash=p_chat_id_hash and b.active and s.role='manager' and s.status='active';
 if v_staff is null then raise exception 'Telegram manager binding not authorized' using errcode='42501'; end if;
 select * into v_proof from public.payment_proofs where id=p_proof_id for update;
 if not found then raise exception 'payment proof not found'; end if;
 select status into v_status from public.subscriptions where id=v_proof.subscription_id for update;
 if v_proof.status<>'pending' or v_status is distinct from 'unpaid' then
  return jsonb_build_object('success',false,'alreadyProcessed',true,'status',v_proof.status,'receiptNumber',v_proof.receipt_number);
 end if;
 v_tx:=internal.approve_payment_proof_as_staff(p_proof_id,v_staff);
 insert into internal.telegram_admin_actions(chat_id_hash,staff_id,action,entity_type,entity_id)
 values(p_chat_id_hash,v_staff,'approve','payment_proof',p_proof_id);
 select * into v_proof from public.payment_proofs where id=p_proof_id;
 return jsonb_build_object('success',true,'transactionId',v_tx,'receiptNumber',v_proof.receipt_number);
end $$;
revoke all on function public.telegram_approve_payment_proof(uuid,text) from public,anon,authenticated;
grant execute on function public.telegram_approve_payment_proof(uuid,text) to service_role;
notify pgrst,'reload schema';
