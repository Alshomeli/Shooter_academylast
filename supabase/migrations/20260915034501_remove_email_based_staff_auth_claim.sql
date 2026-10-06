drop trigger if exists trg_claim_staff_record on auth.users;
drop function if exists internal.claim_staff_record();

create or replace function internal.record_client_audit_log(p_action text, p_details text)
returns public.audit_logs
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text := (select internal.current_user_role());
  v_name text;
  v_row public.audit_logs;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(coalesce(p_action, '')), '') is null then raise exception 'Audit action is required'; end if;

  if v_role = 'parent' then
    select p.name into v_name from public.parents p where p.user_id = v_user_id and p.status = 'active' limit 1;
  else
    select s.name into v_name from public.staff s where s.user_id = v_user_id and s.status = 'active' limit 1;
  end if;

  if v_name is null then raise exception 'No active academy identity found'; end if;

  insert into public.audit_logs (id, action, timestamp, user_role, user_name, details, created_at)
  values ('audit-' || gen_random_uuid()::text, trim(p_action), to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), v_role, v_name, coalesce(p_details, ''), now())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function internal.record_client_login_audit(p_action text, p_details text)
returns public.login_audit_logs
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text := (select internal.current_user_role());
  v_name text;
  v_row public.login_audit_logs;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(coalesce(p_action, '')), '') is null then raise exception 'Audit action is required'; end if;

  if v_role = 'parent' then
    select p.name into v_name from public.parents p where p.user_id = v_user_id and p.status = 'active' limit 1;
  else
    select s.name into v_name from public.staff s where s.user_id = v_user_id and s.status = 'active' limit 1;
  end if;

  if v_name is null then raise exception 'No active academy identity found'; end if;

  insert into public.login_audit_logs (id, action, timestamp, user_role, user_name, details, created_at)
  values ('login-log-' || gen_random_uuid()::text, trim(p_action), to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), v_role, v_name, coalesce(p_details, ''), now())
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function internal.record_client_audit_log(text,text) from anon, public;
grant execute on function internal.record_client_audit_log(text,text) to authenticated;
revoke execute on function internal.record_client_login_audit(text,text) from anon, public;
grant execute on function internal.record_client_login_audit(text,text) to authenticated;
