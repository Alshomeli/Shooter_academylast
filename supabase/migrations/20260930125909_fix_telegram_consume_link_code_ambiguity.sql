create or replace function internal.consume_telegram_link_code(p_code text,p_chat_id bigint)
returns table(user_id uuid,role text)
language plpgsql security definer set search_path='' as $$
declare v_row public.telegram_link_codes%rowtype;
begin
 if p_chat_id is null or p_code is null or length(trim(p_code))<6 then return; end if;
 select lc.* into v_row from public.telegram_link_codes lc
 where lc.code_hash=encode(extensions.digest(upper(trim(p_code)),'sha256'),'hex')
 and lc.consumed_at is null and lc.expires_at>now()
 order by lc.created_at desc limit 1 for update;
 if not found or v_row.role not in ('manager','coach') then return; end if;
 if internal.telegram_role_for_user(v_row.user_id) is distinct from v_row.role then return; end if;
 update public.telegram_user_links tul set is_active=false where tul.chat_id=p_chat_id and tul.user_id<>v_row.user_id;
 insert into public.telegram_user_links(user_id,chat_id,role,telegram_user_code,linked_at,last_seen_at,is_active)
 values(v_row.user_id,p_chat_id,v_row.role,'TG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),now(),now(),true)
 on conflict(user_id) do update set chat_id=excluded.chat_id,role=excluded.role,linked_at=now(),last_seen_at=now(),is_active=true;
 update public.telegram_link_codes lc set consumed_at=now() where lc.id=v_row.id;
 return query select v_row.user_id,v_row.role;
end $$;
revoke all on function internal.consume_telegram_link_code(text,bigint) from public,anon,authenticated;