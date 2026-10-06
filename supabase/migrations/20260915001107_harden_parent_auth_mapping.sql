alter table public.parents add column if not exists user_id uuid;

update public.parents p
set user_id = u.id
from auth.users u
where p.user_id is null
  and lower(trim(p.email)) = lower(trim(u.email));

create unique index if not exists parents_user_id_key on public.parents(user_id) where user_id is not null;

alter table public.parents
  drop constraint if exists parents_user_id_fkey;

alter table public.parents
  add constraint parents_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

create or replace function internal.has_role(allowed_roles text[])
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  return exists (
    select 1
    from public.staff s
    where (s.user_id = (select auth.uid())
       or (s.user_id is null and lower(s.email) = lower((select auth.jwt() ->> 'email'))))
      and s.status = 'active'
      and s.role = any(allowed_roles)
  )
  or exists (
    select 1
    from public.parents p
    where (p.user_id = (select auth.uid())
       or (p.user_id is null and lower(p.email) = lower((select auth.jwt() ->> 'email'))))
      and p.status = 'active'
      and 'parent' = any(allowed_roles)
  );
end;
$function$;

create or replace function internal.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare v_role text;
begin
  select s.role into v_role
  from public.staff s
  where (s.user_id = (select auth.uid())
      or (s.user_id is null and lower(s.email) = lower((select auth.jwt() ->> 'email'))))
    and s.status = 'active'
  limit 1;
  if v_role is not null then return v_role; end if;

  if exists (
    select 1 from public.parents p
    where (p.user_id = (select auth.uid())
        or (p.user_id is null and lower(p.email) = lower((select auth.jwt() ->> 'email'))))
      and p.status = 'active'
  ) then
    return 'parent';
  end if;
  return null;
end;
$function$;

create or replace function internal.is_active_member()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  return exists (
    select 1 from public.staff s
    where (s.user_id = (select auth.uid())
        or (s.user_id is null and lower(s.email) = lower((select auth.jwt() ->> 'email'))))
      and s.status = 'active'
  )
  or exists (
    select 1 from public.parents p
    where (p.user_id = (select auth.uid())
        or (p.user_id is null and lower(p.email) = lower((select auth.jwt() ->> 'email'))))
      and p.status = 'active'
  );
end;
$function$;
