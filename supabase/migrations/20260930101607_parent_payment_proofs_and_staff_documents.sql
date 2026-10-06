create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  subscription_id text not null references public.subscriptions(id) on delete restrict,
  player_id text not null references public.players(id) on delete restrict,
  parent_user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(10,3) not null check (amount > 0),
  transfer_date date not null,
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','needs_info')),
  parent_note text not null default '',
  review_note text not null default '',
  reviewed_by text references public.staff(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 0
);

create unique index if not exists uq_payment_proofs_pending_subscription
on public.payment_proofs(subscription_id)
where status in ('pending','needs_info');

create index if not exists idx_payment_proofs_parent on public.payment_proofs(parent_user_id,created_at desc);
create index if not exists idx_payment_proofs_status on public.payment_proofs(status,created_at desc);

alter table public.payment_proofs enable row level security;
revoke all on public.payment_proofs from anon;
grant select,insert on public.payment_proofs to authenticated;

create policy payment_proofs_parent_select on public.payment_proofs
for select to authenticated
using (parent_user_id=(select auth.uid()) or internal.has_role(array['manager'::text,'accountant'::text]));

create policy payment_proofs_parent_insert on public.payment_proofs
for insert to authenticated
with check (
  parent_user_id=(select auth.uid())
  and status='pending'
  and reviewed_by is null and reviewed_at is null
  and exists (
    select 1 from public.players p
    join public.parents pa on pa.id=p.parent_id
    join public.subscriptions s on s.player_id=p.id
    where p.id=payment_proofs.player_id
      and s.id=payment_proofs.subscription_id
      and s.status='unpaid'
      and pa.user_id=(select auth.uid())
      and s.amount=payment_proofs.amount
  )
);

create table if not exists public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references public.staff(id) on delete restrict,
  document_type text not null default 'certificate',
  title text not null,
  file_path text not null,
  expiry_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_staff_documents_staff on public.staff_documents(staff_id,created_at desc);
alter table public.staff_documents enable row level security;
revoke all on public.staff_documents from anon;
grant select,insert,delete on public.staff_documents to authenticated;

create policy staff_documents_select on public.staff_documents
for select to authenticated
using (
  internal.has_role(array['manager'::text])
  or exists(select 1 from public.staff s where s.id=staff_documents.staff_id and s.user_id=(select auth.uid()))
);

create policy staff_documents_insert on public.staff_documents
for insert to authenticated
with check (
  internal.has_role(array['manager'::text])
  or exists(select 1 from public.staff s where s.id=staff_documents.staff_id and s.user_id=(select auth.uid()))
);

create policy staff_documents_delete on public.staff_documents
for delete to authenticated
using (
  internal.has_role(array['manager'::text])
  or exists(select 1 from public.staff s where s.id=staff_documents.staff_id and s.user_id=(select auth.uid()))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('staff-documents','staff-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;

create policy payment_proofs_storage_insert on storage.objects
for insert to authenticated
with check (
 bucket_id='payment-proofs'
 and (storage.foldername(name))[1]=(select auth.uid())::text
);

create policy payment_proofs_storage_select on storage.objects
for select to authenticated
using (
 bucket_id='payment-proofs'
 and (
   (storage.foldername(name))[1]=(select auth.uid())::text
   or internal.has_role(array['manager'::text,'accountant'::text])
 )
);

create policy staff_documents_storage_insert on storage.objects
for insert to authenticated
with check (
 bucket_id='staff-documents'
 and (
   internal.has_role(array['manager'::text])
   or exists(
     select 1 from public.staff s
     where s.id=(storage.foldername(name))[1]
       and s.user_id=(select auth.uid())
   )
 )
);

create policy staff_documents_storage_select on storage.objects
for select to authenticated
using (
 bucket_id='staff-documents'
 and (
   internal.has_role(array['manager'::text])
   or exists(
     select 1 from public.staff s
     where s.id=(storage.foldername(name))[1]
       and s.user_id=(select auth.uid())
   )
 )
);

create policy staff_documents_storage_delete on storage.objects
for delete to authenticated
using (
 bucket_id='staff-documents'
 and (
   internal.has_role(array['manager'::text])
   or exists(
     select 1 from public.staff s
     where s.id=(storage.foldername(name))[1]
       and s.user_id=(select auth.uid())
   )
 )
);

create or replace function internal.approve_payment_proof_impl(p_proof_id uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_staff public.staff;
  v_proof public.payment_proofs;
  v_sub public.subscriptions;
  v_tx_id text;
begin
  select * into v_staff from public.staff
  where user_id=auth.uid() and status='active' and role in ('manager','accountant')
  limit 1;
  if v_staff.id is null then raise exception 'not authorized'; end if;

  select * into v_proof from public.payment_proofs where id=p_proof_id for update;
  if v_proof.id is null then raise exception 'payment proof not found'; end if;
  if v_proof.status<>'pending' then raise exception 'payment proof already processed'; end if;

  select * into v_sub from public.subscriptions where id=v_proof.subscription_id for update;
  if v_sub.id is null or v_sub.player_id<>v_proof.player_id then raise exception 'invalid subscription'; end if;
  if v_sub.status<>'unpaid' then raise exception 'subscription already paid'; end if;
  if v_sub.amount<>v_proof.amount then raise exception 'amount mismatch'; end if;

  v_tx_id := 'txn-proof-' || p_proof_id::text;

  update public.subscriptions
  set status='paid',payment_method='benefit_transfer',paid_at=now(),row_version=row_version+1
  where id=v_sub.id;

  insert into public.transactions(id,type,category,amount,transaction_date,description,recorded_by,subscription_id,player_id)
  values(v_tx_id,'revenue','subscription',v_proof.amount,(now() at time zone 'Asia/Bahrain')::date,
         'Benefit transfer approved from parent payment proof',v_staff.name,v_sub.id,v_sub.player_id);

  update public.payment_proofs
  set status='approved',reviewed_by=v_staff.id,reviewed_at=now(),updated_at=now(),row_version=row_version+1
  where id=p_proof_id;

  insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
  values('notif-payment-'||p_proof_id::text,'تم اعتماد الدفعة','تم التحقق من تحويل الاشتراك واعتماد الدفعة.',
         to_char(now() at time zone 'Asia/Bahrain','YYYY-MM-DD HH24:MI'),'success',false,v_proof.parent_user_id)
  on conflict(id) do nothing;

  return v_tx_id;
end $$;

create or replace function public.approve_payment_proof(p_proof_id uuid)
returns text language sql security invoker set search_path=''
as $$ select internal.approve_payment_proof_impl(p_proof_id); $$;

revoke all on function internal.approve_payment_proof_impl(uuid) from public,anon;
grant execute on function internal.approve_payment_proof_impl(uuid) to authenticated;
revoke all on function public.approve_payment_proof(uuid) from public,anon;
grant execute on function public.approve_payment_proof(uuid) to authenticated;

create or replace function internal.review_payment_proof_impl(p_proof_id uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_staff public.staff; v_proof public.payment_proofs;
begin
 select * into v_staff from public.staff where user_id=auth.uid() and status='active' and role in ('manager','accountant') limit 1;
 if v_staff.id is null then raise exception 'not authorized'; end if;
 if p_status not in ('rejected','needs_info') then raise exception 'invalid review status'; end if;
 if nullif(trim(p_note),'') is null then raise exception 'review note required'; end if;
 select * into v_proof from public.payment_proofs where id=p_proof_id for update;
 if v_proof.id is null then raise exception 'payment proof not found'; end if;
 if v_proof.status<>'pending' then raise exception 'payment proof already processed'; end if;
 update public.payment_proofs set status=p_status,review_note=trim(p_note),reviewed_by=v_staff.id,reviewed_at=now(),updated_at=now(),row_version=row_version+1 where id=p_proof_id;
 insert into public.notifications(id,title,message,timestamp,type,read,recipient_user_id)
 values('notif-payment-review-'||p_proof_id::text,
        case when p_status='rejected' then 'تعذر اعتماد الدفعة' else 'مطلوب استكمال إثبات الدفع' end,
        trim(p_note),to_char(now() at time zone 'Asia/Bahrain','YYYY-MM-DD HH24:MI'),
        case when p_status='rejected' then 'error' else 'warning' end,false,v_proof.parent_user_id)
 on conflict(id) do nothing;
end $$;

create or replace function public.review_payment_proof(p_proof_id uuid,p_status text,p_note text)
returns void language sql security invoker set search_path=''
as $$ select internal.review_payment_proof_impl(p_proof_id,p_status,p_note); $$;
revoke all on function internal.review_payment_proof_impl(uuid,text,text) from public,anon;
grant execute on function internal.review_payment_proof_impl(uuid,text,text) to authenticated;
revoke all on function public.review_payment_proof(uuid,text,text) from public,anon;
grant execute on function public.review_payment_proof(uuid,text,text) to authenticated;
