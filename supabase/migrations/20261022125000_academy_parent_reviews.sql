-- Parent-submitted public reviews: private until explicit manager approval and publication.
create table if not exists public.academy_parent_reviews (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 2 and 100),
  quote text not null check (length(btrim(quote)) between 10 and 500),
  rating integer not null check (rating between 1 and 5),
  publication_consent boolean not null default false check (publication_consent = true),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create index if not exists academy_parent_reviews_parent_idx on public.academy_parent_reviews(parent_user_id,created_at desc);
alter table public.academy_parent_reviews enable row level security;
revoke all on public.academy_parent_reviews from anon;
grant select,insert on public.academy_parent_reviews to authenticated;
drop policy if exists "Parents read only their reviews" on public.academy_parent_reviews;
create policy "Parents read only their reviews" on public.academy_parent_reviews
  for select to authenticated using (parent_user_id = (select auth.uid()));
drop policy if exists "Parents submit own pending reviews" on public.academy_parent_reviews;
create policy "Parents submit own pending reviews" on public.academy_parent_reviews
  for insert to authenticated with check (
    parent_user_id = (select auth.uid()) and status = 'pending'
    and reviewed_by is null and reviewed_at is null
    and publication_consent = true
    and exists(select 1 from public.parents p where p.user_id = (select auth.uid()) and p.status = 'active')
  );
-- Only service-side vetted manager RPC may change approval status.
-- The admin dashboard can read pending reviews through the next protected RPC,
-- not by granting managers broad write access to the table.
create or replace function public.manager_review_parent_reviews()
returns table(id uuid, display_name text, quote text, rating integer, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists(select 1 from public.staff s where s.user_id=auth.uid() and s.role='manager' and s.status='active') then
    raise exception 'manager_only';
  end if;
  return query select r.id,r.display_name,r.quote,r.rating,r.created_at
    from public.academy_parent_reviews r where r.status='pending' order by r.created_at desc limit 100;
end; $$;
revoke all on function public.manager_review_parent_reviews() from public, anon;
grant execute on function public.manager_review_parent_reviews() to authenticated;
create or replace function public.manager_approve_parent_review(p_review_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists(select 1 from public.staff s where s.user_id=auth.uid() and s.role='manager' and s.status='active') then
    raise exception 'manager_only';
  end if;
  update public.academy_parent_reviews set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=auth.uid(),reviewed_at=now() where id=p_review_id and status='pending';
  if not found then raise exception 'review_not_pending'; end if;
end; $$;
revoke all on function public.manager_approve_parent_review(uuid,boolean) from public, anon;
grant execute on function public.manager_approve_parent_review(uuid,boolean) to authenticated;
