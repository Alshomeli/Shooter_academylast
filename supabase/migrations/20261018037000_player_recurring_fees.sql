-- Staging only. Price registry survives monthly renewals independently of any one bill.
-- This is not applied to production and creates no subscription or transaction.
create table if not exists public.player_recurring_fees (
 player_id text primary key references public.players(id) on delete restrict,
 monthly_amount numeric(9,3) not null default 25.000
   check (monthly_amount between 0 and 25),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.player_recurring_fees enable row level security;
revoke all on public.player_recurring_fees from public,anon,authenticated;
grant select,insert,update on public.player_recurring_fees to authenticated;
create policy "Read owned player fee or manager" on public.player_recurring_fees
for select to authenticated using (
 exists (select 1 from public.players pl join public.parents pa on pa.id=pl.parent_id
         where pl.id=player_id and pa.user_id=(select auth.uid()))
 or exists (select 1 from public.staff st where st.user_id=(select auth.uid())
            and st.role='manager' and st.status='active')
);
create policy "Manager inserts recurring player fee" on public.player_recurring_fees
for insert to authenticated with check (
 updated_by=(select auth.uid()) and exists (
 select 1 from public.staff st where st.user_id=(select auth.uid())
 and st.role='manager' and st.status='active')
);
create policy "Manager edits recurring player fee" on public.player_recurring_fees
for update to authenticated using (exists (
 select 1 from public.staff st where st.user_id=(select auth.uid())
 and st.role='manager' and st.status='active'))
with check (updated_by=(select auth.uid()) and exists (
 select 1 from public.staff st where st.user_id=(select auth.uid())
 and st.role='manager' and st.status='active'));
-- Fee changes affect future renewal drafts only, never paid/old subscriptions.
-- Initial player fee should be copied from registration_child_fees on approval;
-- registration approval RPC integration remains gated until isolated DB testing.
