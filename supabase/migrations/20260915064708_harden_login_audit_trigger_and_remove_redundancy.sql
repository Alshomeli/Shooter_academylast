create or replace function internal.guard_login_audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'login_audit_logs is append-only';
end;
$$;

drop trigger if exists trg_guard_login_audit_logs_immutable on public.login_audit_logs;
