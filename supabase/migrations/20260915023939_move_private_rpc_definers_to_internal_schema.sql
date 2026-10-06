create or replace function internal.get_player_private()
returns table(id text, notes text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id, p.notes
  from public.players p
  where (select internal.is_academy_admin())
$$;

create or replace function internal.get_parent_private()
returns table(id text, national_id text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id, p.national_id
  from public.parents p
  where (select internal.is_academy_admin())
$$;

revoke execute on function internal.get_player_private() from public, anon;
revoke execute on function internal.get_parent_private() from public, anon;
grant execute on function internal.get_player_private() to authenticated;
grant execute on function internal.get_parent_private() to authenticated;

create or replace function public.get_player_private()
returns table(id text, notes text)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from internal.get_player_private()
$$;

create or replace function public.get_parent_private()
returns table(id text, national_id text)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from internal.get_parent_private()
$$;

revoke execute on function public.get_player_private() from public, anon;
revoke execute on function public.get_parent_private() from public, anon;
grant execute on function public.get_player_private() to authenticated;
grant execute on function public.get_parent_private() to authenticated;
