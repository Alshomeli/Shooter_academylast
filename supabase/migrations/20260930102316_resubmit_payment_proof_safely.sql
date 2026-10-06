create or replace function internal.resubmit_payment_proof_impl(
 p_proof_id uuid,p_proof_path text,p_transfer_date date,p_parent_note text default ''
) returns void
language plpgsql security definer set search_path=''
as $$
declare v public.payment_proofs;
begin
 select * into v from public.payment_proofs where id=p_proof_id for update;
 if v.id is null then raise exception 'payment proof not found'; end if;
 if v.parent_user_id<>auth.uid() then raise exception 'not authorized'; end if;
 if v.status<>'needs_info' then raise exception 'payment proof is not awaiting more information'; end if;
 if p_proof_path not like (auth.uid()::text || '/%') then raise exception 'invalid proof path'; end if;
 if not exists(select 1 from public.subscriptions s where s.id=v.subscription_id and s.status='unpaid' and s.amount=v.amount) then
   raise exception 'subscription is no longer payable';
 end if;
 update public.payment_proofs set proof_path=p_proof_path,transfer_date=p_transfer_date,parent_note=coalesce(trim(p_parent_note),''),
 status='pending',review_note='',reviewed_by=null,reviewed_at=null,updated_at=now(),row_version=row_version+1
 where id=p_proof_id;
end $$;
create or replace function public.resubmit_payment_proof(p_proof_id uuid,p_proof_path text,p_transfer_date date,p_parent_note text default '')
returns void language sql security invoker set search_path=''
as $$ select internal.resubmit_payment_proof_impl(p_proof_id,p_proof_path,p_transfer_date,p_parent_note); $$;
revoke all on function internal.resubmit_payment_proof_impl(uuid,text,date,text) from public,anon;
grant execute on function internal.resubmit_payment_proof_impl(uuid,text,date,text) to authenticated;
revoke all on function public.resubmit_payment_proof(uuid,text,date,text) from public,anon;
grant execute on function public.resubmit_payment_proof(uuid,text,date,text) to authenticated;
