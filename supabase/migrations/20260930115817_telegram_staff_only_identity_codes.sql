alter table public.telegram_user_links add column if not exists telegram_user_code text;
update public.telegram_user_links
set telegram_user_code='TG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
where telegram_user_code is null;
alter table public.telegram_user_links alter column telegram_user_code set not null;
create unique index if not exists uq_telegram_user_links_code on public.telegram_user_links(telegram_user_code);

delete from public.telegram_link_codes where role='parent';
delete from public.telegram_user_links where role='parent';

alter table public.telegram_user_links drop constraint if exists telegram_user_links_role_check;
alter table public.telegram_user_links add constraint telegram_user_links_role_check check (role in ('manager','coach'));
alter table public.telegram_link_codes drop constraint if exists telegram_link_codes_role_check;
alter table public.telegram_link_codes add constraint telegram_link_codes_role_check check (role in ('manager','coach'));

create or replace function internal.telegram_role_for_user(p_user_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_role text;
begin
  select s.role into v_role
  from public.staff s
  where s.user_id=p_user_id and s.status='active' and s.role in ('manager','coach')
  order by s.created_at desc limit 1;
  return v_role;
end $$;
revoke all on function internal.telegram_role_for_user(uuid) from public,anon,authenticated;

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
  if not found or v_row.role not in ('manager','coach') then return; end if;
  if internal.telegram_role_for_user(v_row.user_id) is distinct from v_row.role then return; end if;
  update public.telegram_user_links set is_active=false where chat_id=p_chat_id and user_id<>v_row.user_id;
  insert into public.telegram_user_links(user_id,chat_id,role,telegram_user_code,linked_at,last_seen_at,is_active)
  values(v_row.user_id,p_chat_id,v_row.role,'TG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),now(),now(),true)
  on conflict(user_id) do update set chat_id=excluded.chat_id,role=excluded.role,linked_at=now(),last_seen_at=now(),is_active=true;
  update public.telegram_link_codes set consumed_at=now() where id=v_row.id;
  return query select v_row.user_id,v_row.role;
end $$;
revoke all on function internal.consume_telegram_link_code(text,bigint) from public,anon,authenticated;

create or replace function internal.telegram_identity(p_chat_id bigint)
returns table(user_id uuid, role text, staff_id text, parent_id text, display_name text)
language plpgsql security definer set search_path='' as $$
begin
 return query
 select l.user_id,l.role,s.id,null::text,s.name
 from public.telegram_user_links l
 join public.staff s on s.user_id=l.user_id and s.status='active' and s.role=l.role
 where l.chat_id=p_chat_id and l.is_active and l.role in ('manager','coach')
 limit 1;
 update public.telegram_user_links set last_seen_at=now() where chat_id=p_chat_id and is_active;
end $$;
revoke all on function internal.telegram_identity(bigint) from public,anon,authenticated;

create or replace function public.telegram_my_connection()
returns table(telegram_user_code text, role text, linked_at timestamptz, last_seen_at timestamptz, is_active boolean)
language sql security invoker set search_path='' as $$
 select l.telegram_user_code,l.role,l.linked_at,l.last_seen_at,l.is_active
 from public.telegram_user_links l where l.user_id=auth.uid();
$$;
revoke all on function public.telegram_my_connection() from public,anon;
grant execute on function public.telegram_my_connection() to authenticated;
