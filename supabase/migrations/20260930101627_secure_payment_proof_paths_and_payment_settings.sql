alter table public.academy_settings
 add column if not exists benefit_iban text not null default '',
 add column if not exists benefit_account_name text not null default '',
 add column if not exists payment_instructions_ar text not null default '',
 add column if not exists payment_instructions_en text not null default '';

drop policy if exists payment_proofs_parent_insert on public.payment_proofs;
create policy payment_proofs_parent_insert on public.payment_proofs
for insert to authenticated
with check (
  parent_user_id=(select auth.uid())
  and proof_path like ((select auth.uid())::text || '/%')
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
