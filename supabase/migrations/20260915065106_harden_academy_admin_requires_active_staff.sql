create or replace function internal.is_academy_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    where s.user_id = (select auth.uid())
      and s.role = 'manager'
      and s.status = 'active'
  );
$$;
revoke all on function internal.is_academy_admin() from public, anon;
grant execute on function internal.is_academy_admin() to authenticated;
