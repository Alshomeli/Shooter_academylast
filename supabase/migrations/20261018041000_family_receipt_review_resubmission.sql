-- Staging only: review + audited correction of a family receipt.
-- Do not delete original evidence or its history.
create table if not exists public.family_receipt_review_events (
 id uuid primary key default gen_random_uuid(),
 receipt_id uuid not null references public.family_payment_receipts(id),
 actor_user_id uuid not null references auth.users(id),
 action text not null check(action in ('needs_info','rejected','resubmitted')),
 note text,
 prior_proof_path text,
 new_proof_path text,
 created_at timestamptz not null default now()
);
alter table public.family_receipt_review_events enable row level security;
revoke all on public.family_receipt_review_events from anon,authenticated;
grant select on public.family_receipt_review_events to authenticated;
create policy "Read own family receipt events" on public.family_receipt_review_events
 for select to authenticated using (exists (
 select 1 from public.family_payment_receipts r where r.id=receipt_id
 ));
create or replace function public.review_family_payment_receipt(
 p_receipt_id uuid,p_decision text,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_manager text;v_old public.family_payment_receipts%rowtype;
begin
 select id into v_manager from public.staff where user_id=v_uid and role='manager' and status='active' limit 1;
 if v_manager is null then raise exception 'Manager authorization required' using errcode='42501';end if;
 if p_decision not in ('needs_info','rejected') or length(trim(coalesce(p_note,'')))<5 or length(p_note)>1000
 then raise exception 'Review reason required (5-1000 characters)'; end if;
 select * into v_old from public.family_payment_receipts where id=p_receipt_id for update;
 if v_old.id is null or v_old.status<>'pending' then raise exception 'Receipt not pending';end if;
 update public.family_payment_receipts set status=p_decision,review_note=trim(p_note),
 reviewed_by=v_manager,reviewed_at=now() where id=p_receipt_id;
 insert into public.family_receipt_review_events(receipt_id,actor_user_id,action,note,prior_proof_path)
 values(p_receipt_id,v_uid,p_decision,trim(p_note),v_old.proof_path);
 return p_receipt_id;
end;$$;
revoke all on function public.review_family_payment_receipt(uuid,text,text) from public,anon;
grant execute on function public.review_family_payment_receipt(uuid,text,text) to authenticated;

create or replace function public.resubmit_family_payment_receipt(
 p_receipt_id uuid,p_proof_path text,p_transfer_date date
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_receipt public.family_payment_receipts%rowtype;
 v_count int;v_total numeric(12,3);
begin
 if v_uid is null then raise exception 'Authentication required';end if;
 select * into v_receipt from public.family_payment_receipts where id=p_receipt_id for update;
 if v_receipt.id is null or v_receipt.parent_user_id<>v_uid then raise exception 'Receipt not owned by parent' using errcode='42501';end if;
 if v_receipt.status not in ('needs_info','rejected') then raise exception 'Receipt not eligible for correction';end if;
 if p_transfer_date is null or p_transfer_date>current_date then raise exception 'Invalid transfer date';end if;
 if p_proof_path is null or length(p_proof_path)>1024 or
 p_proof_path !~ ('^'||v_uid::text||'/family/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}\.(jpg|jpeg|png|webp|pdf)$')
 then raise exception 'Invalid private receipt path';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='payment-proofs'
 and o.name=p_proof_path and o.owner_id=v_uid::text
 and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp','application/pdf')
 and ((p_proof_path~*'\.(jpg|jpeg)$' and o.metadata->>'mimetype'='image/jpeg')
 or (p_proof_path~*'\.png$' and o.metadata->>'mimetype'='image/png')
 or (p_proof_path~*'\.webp$' and o.metadata->>'mimetype'='image/webp')
 or (p_proof_path~*'\.pdf$' and o.metadata->>'mimetype'='application/pdf'))
 and (o.metadata->>'size')~'^[0-9]{1,8}$' and (o.metadata->>'size')::bigint between 1 and 5242880)
 then raise exception 'Receipt upload not found or not owned by parent';end if;
 -- Revalidate every reserved subscription, still unpaid and owned by the same parent.
 select count(*),sum(s.amount) into v_count,v_total
 from public.family_payment_receipt_items i
 join public.subscriptions s on s.id=i.subscription_id and s.player_id=i.player_id
 join public.players pl on pl.id=i.player_id
 join public.parents pa on pa.id=pl.parent_id
 where i.receipt_id=p_receipt_id and pa.user_id=v_uid and s.status='unpaid' and s.amount=i.amount;
 if v_count<2 or v_total<>v_receipt.expected_amount or
 v_count<>(select count(*) from public.family_payment_receipt_items where receipt_id=p_receipt_id)
 then raise exception 'Reserved subscriptions changed since review';end if;
 insert into public.family_receipt_review_events(receipt_id,actor_user_id,action,note,prior_proof_path,new_proof_path)
 values(p_receipt_id,v_uid,'resubmitted',v_receipt.review_note,v_receipt.proof_path,p_proof_path);
 update public.family_payment_receipts set status='pending',proof_path=p_proof_path,
 transfer_date=p_transfer_date,review_note=null,reviewed_by=null,reviewed_at=null
 where id=p_receipt_id;
 return p_receipt_id;
end;$$;
revoke all on function public.resubmit_family_payment_receipt(uuid,text,date) from public,anon;
grant execute on function public.resubmit_family_payment_receipt(uuid,text,date) to authenticated;
