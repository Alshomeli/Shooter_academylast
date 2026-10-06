create or replace function internal.guard_audit_log_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
begin
  raise exception 'Audit logs cannot be modified or deleted';
end;
$$;
revoke all on function internal.guard_audit_log_immutable() from public;

drop trigger if exists trg_guard_audit_log_immutable_update on public.audit_logs;
create trigger trg_guard_audit_log_immutable_update
before update on public.audit_logs
for each row execute function internal.guard_audit_log_immutable();

drop trigger if exists trg_guard_audit_log_immutable_delete on public.audit_logs;
create trigger trg_guard_audit_log_immutable_delete
before delete on public.audit_logs
for each row execute function internal.guard_audit_log_immutable();

drop policy if exists delete_audit_logs_manager on public.audit_logs;
drop policy if exists update_audit_logs_manager on public.audit_logs;

