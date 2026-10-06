create or replace function public.get_staff_private()
returns table(id text, salary numeric, national_id text)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from internal.get_staff_private()
$$;

revoke execute on function public.get_staff_private() from public, anon;
grant execute on function public.get_staff_private() to authenticated;
