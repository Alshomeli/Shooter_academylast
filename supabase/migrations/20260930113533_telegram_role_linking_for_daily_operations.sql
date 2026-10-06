create table public.telegram_user_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint not null unique,
  role text not null check (role in ('manager','coach','parent')),
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);
alter table public.telegram_user_links enable row level security;
revoke all on public.telegram_user_links from anon;
grant select, delete on public.telegram_user_links to authenticated;
create policy telegram_links_select_own on public.telegram_user_links for select to authenticated using ((select auth.uid()) = user_id);
create policy telegram_links_delete_own on public.telegram_user_links for delete to authenticated using ((select auth.uid()) = user_id);

create table public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  role text not null check (role in ('manager','coach','parent')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.telegram_link_codes enable row level security;
revoke all on public.telegram_link_codes from anon, authenticated;

create index idx_telegram_link_codes_user_active on public.telegram_link_codes(user_id, expires_at desc) where consumed_at is null;

create or replace function internal.telegram_role_for_user(p_user_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_role text;
begin
  select s.role into v_role from public.staff s where s.user_id=p_user_id and s.status='active' and s.role in ('manager','coach') order by s.created_at desc limit 1;
  if v_role is not null then return v_role; end if;
  if exists(select 1 from public.parents p where p.user_id=p_user_id and p.status='active') then return 'parent'; end if;
  return null;
end $$;
revoke all on function internal.telegram_role_for_user(uuid) from public, anon, authenticated;

create or replace function public.create_telegram_link_code()
returns text language plpgsql security invoker set search_path='' as $$
declare v_user uuid := auth.uid(); v_role text; v_code text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  v_role := internal.telegram_role_for_user(v_user);
  if v_role is null then raise exception 'telegram_role_not_allowed'; end if;
  delete from public.telegram_link_codes where user_id=v_user and consumed_at is null;
  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.telegram_link_codes(user_id,code_hash,role,expires_at)
  values(v_user, encode(extensions.digest(v_code,'sha256'),'hex'), v_role, now()+interval '10 minutes');
  return v_code;
end $$;
revoke all on function public.create_telegram_link_code() from public, anon;
grant execute on function public.create_telegram_link_code() to authenticated;

create or replace function internal.consume_telegram_link_code(p_code text,p_chat_id bigint)
returns table(user_id uuid, role text)
language plpgsql security definer set search_path='' as $$
declare v_row public.telegram_link_codes%rowtype;
begin
  if p_chat_id is null or p_code is null or length(trim(p_code)) < 6 then return; end if;
  select * into v_row from public.telegram_link_codes
  where code_hash=encode(extensions.digest(upper(trim(p_code)),'sha256'),'hex')
    and consumed_at is null and expires_at>now()
  order by created_at desc limit 1 for update;
  if not found then return; end if;
  if internal.telegram_role_for_user(v_row.user_id) is distinct from v_row.role then return; end if;
  update public.telegram_user_links set is_active=false where chat_id=p_chat_id and user_id<>v_row.user_id;
  insert into public.telegram_user_links(user_id,chat_id,role,linked_at,last_seen_at,is_active)
  values(v_row.user_id,p_chat_id,v_row.role,now(),now(),true)
  on conflict(user_id) do update set chat_id=excluded.chat_id,role=excluded.role,linked_at=now(),last_seen_at=now(),is_active=true;
  update public.telegram_link_codes set consumed_at=now() where id=v_row.id;
  return query select v_row.user_id,v_row.role;
end $$;
revoke all on function internal.consume_telegram_link_code(text,bigint) from public, anon, authenticated;

create or replace function internal.telegram_identity(p_chat_id bigint)
returns table(user_id uuid, role text, staff_id text, parent_id text, display_name text)
language plpgsql security definer set search_path='' as $$
begin
 return query
 select l.user_id,l.role,s.id,p.id,coalesce(s.name,p.name,'مستخدم')
 from public.telegram_user_links l
 left join public.staff s on s.user_id=l.user_id and s.status='active'
 left join public.parents p on p.user_id=l.user_id and p.status='active'
 where l.chat_id=p_chat_id and l.is_active
   and ((l.role in ('manager','coach') and s.id is not null and s.role=l.role) or (l.role='parent' and p.id is not null))
 limit 1;
 update public.telegram_user_links set last_seen_at=now() where chat_id=p_chat_id and is_active;
end $$;
revoke all on function internal.telegram_identity(bigint) from public, anon, authenticated;
