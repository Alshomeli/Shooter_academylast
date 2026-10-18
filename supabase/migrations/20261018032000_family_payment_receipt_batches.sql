-- Staged schema for one uploaded transfer receipt covering several sibling subscriptions.
-- Not applied to production. Posting transactions and activating players MUST occur in
-- a separate, authorization-checked, idempotent server transaction (future migration).
create table if not exists public.family_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id),
  proof_path text not null check (length(proof_path) between 1 and 1024),
  transfer_date date not null,
  expected_amount numeric(12,3) not null check (expected_amount > 0),
  status text not null default 'pending'
    check (status in ('pending','needs_info','rejected','approved')),
  review_note text,
  reviewed_by text references public.staff(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- A single uploaded proof must not be attached to multiple family receipt headers.
create unique index if not exists family_payment_receipts_unique_proof_path
on public.family_payment_receipts(proof_path);
create table if not exists public.family_payment_receipt_items (
  receipt_id uuid not null references public.family_payment_receipts(id) on delete restrict,
  subscription_id text not null references public.subscriptions(id),
  player_id text not null references public.players(id),
  amount numeric(12,3) not null check (amount > 0),
  primary key (receipt_id,subscription_id)
);
-- Prevent two receipts from claiming one subscription simultaneously (including
-- rejected history: a replacement must use an explicit audited transition).
create unique index if not exists family_payment_receipt_items_subscription_uq
on public.family_payment_receipt_items(subscription_id);
alter table public.family_payment_receipts enable row level security;
alter table public.family_payment_receipt_items enable row level security;
revoke all on public.family_payment_receipts from anon, authenticated;
revoke all on public.family_payment_receipt_items from anon, authenticated;
grant select on public.family_payment_receipts to authenticated;
grant select on public.family_payment_receipt_items to authenticated;
-- Parents see their own receipt; active managers/accountants see review queue.
create policy "Read own or staff family receipt" on public.family_payment_receipts
for select to authenticated using (
  parent_user_id=(select auth.uid())
  or exists (select 1 from public.staff s where s.user_id=(select auth.uid())
    and s.status='active' and s.role in ('manager','accountant'))
);
create policy "Read authorized family receipt line items" on public.family_payment_receipt_items
for select to authenticated using (
  exists (select 1 from public.family_payment_receipts r where r.id=receipt_id)
);
-- No client INSERT/UPDATE/DELETE grants. Pending upload and approval RPCs must
-- atomically validate parent ownership, totals, proof storage path and status.
-- Never auto-approve solely on OCR: screenshot is not a bank settlement signal.
