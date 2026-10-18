-- Proposed schema only: not deployed until registration and payment approval workflows are integrated.
-- A manager sets the per-child recurring fee; 25 BHD is the default.
create table if not exists public.registration_child_fees (
  child_id uuid primary key references public.registration_children(id) on delete cascade,
  monthly_amount numeric(9,3) not null default 25.000
    check (monthly_amount between 0 and 25),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.registration_child_fees enable row level security;
revoke all on public.registration_child_fees from anon;
grant select, insert, update on public.registration_child_fees to authenticated;

-- A parent can see approved fees for only their own registration.
create policy "Applicant reads own child fees" on public.registration_child_fees
for select to authenticated using (
  exists (
    select 1 from public.registration_children c
    join public.registration_applications a on a.id=c.application_id
    where c.id=child_id and a.applicant_user_id=(select auth.uid())
  )
);
create policy "Managers read child fees" on public.registration_child_fees
for select to authenticated using (
  exists (select 1 from public.staff s where s.user_id=(select auth.uid())
    and s.role='manager' and s.status='active')
);
create policy "Managers create child fees" on public.registration_child_fees
for insert to authenticated with check (
  updated_by=(select auth.uid())
  and exists (select 1 from public.staff s where s.user_id=(select auth.uid())
    and s.role='manager' and s.status='active')
);
create policy "Managers update child fees" on public.registration_child_fees
for update to authenticated using (
  exists (select 1 from public.staff s where s.user_id=(select auth.uid())
    and s.role='manager' and s.status='active')
) with check (
  updated_by=(select auth.uid())
  and exists (select 1 from public.staff s where s.user_id=(select auth.uid())
    and s.role='manager' and s.status='active')
);
-- Production approval must apply fees to player subscription billing server-side.
-- No automatic payment confirmation may be based solely on screenshot OCR.
