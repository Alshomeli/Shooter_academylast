create or replace function public.disconnect_my_telegram()
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'authentication_required'; end if;
 update public.telegram_user_links set is_active=false,last_seen_at=now() where user_id=v_uid and is_active;
 delete from public.telegram_link_codes where user_id=v_uid and consumed_at is null;
 return found;
end $$;
revoke all on function public.disconnect_my_telegram() from public,anon;
grant execute on function public.disconnect_my_telegram() to authenticated;
