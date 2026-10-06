create or replace function internal.current_staff_id()
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_id text;
begin
  select s.id into v_id
  from public.staff s
  where s.user_id = (select auth.uid())
    and s.status = 'active'
  limit 1;
  return v_id;
end;
$$;

create or replace function internal.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_role text;
begin
  select s.role into v_role
  from public.staff s
  where s.user_id = (select auth.uid())
    and s.status = 'active'
  limit 1;
  if v_role is not null then return v_role; end if;
  if exists (
    select 1 from public.parents p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
  ) then return 'parent'; end if;
  return null;
end;
$$;

create or replace function internal.has_role(allowed_roles text[])
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  return exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
      and s.role = any(allowed_roles)
  ) or exists (
    select 1 from public.parents p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and 'parent' = any(allowed_roles)
  );
end;
$$;

create or replace function internal.is_academy_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.role = 'manager'
      and s.status = 'active'
  );
$$;

create or replace function internal.is_academy_member()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
  ) or exists (
    select 1 from public.parents p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
  );
$$;

create or replace function internal.is_active_member()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  return exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
  ) or exists (
    select 1 from public.parents p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
  );
end;
$$;

create or replace function internal.is_coach_of_team(p_team_id text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if p_team_id is null or nullif(trim(p_team_id),'') is null then return false; end if;
  return exists (
    select 1
    from public.teams t
    join public.staff s on s.id = t.coach_id
    where t.id = p_team_id
      and s.role = 'coach'
      and s.status = 'active'
      and s.user_id = (select auth.uid())
  );
end;
$$;

revoke all on function internal.current_staff_id() from anon, public;
grant execute on function internal.current_staff_id() to authenticated;
revoke all on function internal.current_user_role() from anon, public;
grant execute on function internal.current_user_role() to authenticated;
revoke all on function internal.has_role(text[]) from anon, public;
grant execute on function internal.has_role(text[]) to authenticated;
revoke all on function internal.is_academy_admin() from anon, public;
grant execute on function internal.is_academy_admin() to authenticated;
revoke all on function internal.is_academy_member() from anon, public;
grant execute on function internal.is_academy_member() to authenticated;
revoke all on function internal.is_active_member() from anon, public;
grant execute on function internal.is_active_member() to authenticated;
revoke all on function internal.is_coach_of_team(text) from anon, public;
grant execute on function internal.is_coach_of_team(text) to authenticated;
