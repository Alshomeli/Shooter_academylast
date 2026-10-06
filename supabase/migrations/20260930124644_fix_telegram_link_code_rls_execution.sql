create or replace function public.create_telegram_link_code()
returns text
language plpgsql
security definer
set search_path=''
as $$
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
revoke all on function public.create_telegram_link_code() from public,anon;
grant execute on function public.create_telegram_link_code() to authenticated;
