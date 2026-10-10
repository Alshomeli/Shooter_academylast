/*
# Stress-test monitoring and safe teardown for load-test accounts

## Purpose
Give the concurrent-login load tests (tests/artillery-load-test.yml and
tests/load-test-k6.js) somewhere to write latency samples, and give operators a
safe way to remove the throwaway accounts created by scripts/seed-test-users.ts.

## New Objects
- public.performance_audit_logs: append-only latency samples (service_role only).
- public.purge_performance_audit_logs(interval): delete samples older than the
  retention window.
- public.clean_stress_test_accounts(text, boolean): delete the *public schema*
  rows that seeded load-test accounts touch, and optionally the auth.users rows.

## Security
- RLS is enabled on performance_audit_logs with **no policies on purpose**. With
  zero policies, anon and authenticated are denied even if someone later grants
  table access by accident; the service role bypasses RLS.
- Both functions are `security invoker` with `set search_path = ''` and have
  EXECUTE revoked from public/anon/authenticated, matching the convention used
  across the rest of the migration history (see
  20260915012543_harden_security_definer_search_paths.sql). A SECURITY DEFINER
  teardown function that deletes accounts would be callable by anyone it was
  granted to and is exactly the shape of bug this repo has been fixing.

## Why clean_stress_test_accounts deletes public rows BEFORE auth.users
public.staff.user_id, public.parents.user_id and
registration_applications.applicant_user_id all reference auth.users(id) with
ON DELETE SET NULL (see the fk_staff_user_id / parents_user_id_fkey /
registration_applications_applicant_user_id_fkey constraints). Deleting the auth
user first does not cascade the academy data away: it silently nulls user_id and
leaves the row behind. That matters because internal.is_academy_member() and
internal.has_role() fall back to matching lower(staff.email) against the JWT
email claim when user_id IS NULL, so an orphaned staff row is still resolvable
by email after its auth user is gone. Deleting the public rows first avoids
creating those orphans.

## Notes
1. Deleting from auth.users directly bypasses GoTrue: no audit log entry and no
   cache invalidation. scripts/cleanup-test-users.ts therefore calls the Admin
   API (auth.admin.deleteUser) by default and uses this function only for the
   public-schema rows. Pass delete_auth_users := true only for a throwaway
   project.
2. There is no scheduled job for purge_performance_audit_logs; wire it to
   pg_cron or call it from CI after a run.
*/

-- 1. Latency samples collected during a load run --------------------------------

create table if not exists public.performance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action_name text not null,
  duration_ms integer not null check (duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

comment on table public.performance_audit_logs is
  'Latency samples emitted by the load-test harness. Written by the service role only; RLS is enabled with no policies so anon and authenticated are always denied.';

alter table public.performance_audit_logs enable row level security;

revoke all on table public.performance_audit_logs from public;
revoke all on table public.performance_audit_logs from anon, authenticated;
-- DELETE is granted as well so purge_performance_audit_logs() works even on a
-- database that does not inherit the Supabase default privileges.
grant select, insert, delete on table public.performance_audit_logs to service_role;

-- The harness writes with a recorded_at filter (retention purge) and reads by
-- action, newest first.
create index if not exists performance_audit_logs_recorded_at_idx
  on public.performance_audit_logs (recorded_at desc);
create index if not exists performance_audit_logs_action_recorded_at_idx
  on public.performance_audit_logs (action_name, recorded_at desc);

-- 2. Retention purge -------------------------------------------------------------

create or replace function public.purge_performance_audit_logs(retention_interval interval default interval '7 days')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.performance_audit_logs
   where recorded_at < (now() - retention_interval);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Revoke first, then grant only what is needed: the repo does not rely on
-- ALTER DEFAULT PRIVILEGES, so the service role must be granted explicitly.
revoke all on function public.purge_performance_audit_logs(interval) from public;
revoke all on function public.purge_performance_audit_logs(interval) from anon, authenticated;
grant execute on function public.purge_performance_audit_logs(interval) to service_role;

-- 3. Teardown for seeded load-test accounts --------------------------------------

create or replace function public.clean_stress_test_accounts(email_pattern text, delete_auth_users boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  removed_parents integer;
  removed_staff integer;
  removed_applications integer;
  removed_notifications integer;
  removed_auth integer;
begin
  if email_pattern is null or btrim(email_pattern) = '' then
    raise exception 'email_pattern must not be empty';
  end if;

  -- Public-schema rows first: see the header note on ON DELETE SET NULL.
  delete from public.parents p where lower(p.email) like lower(email_pattern);
  get diagnostics removed_parents = row_count;

  delete from public.staff s where lower(s.email) like lower(email_pattern);
  get diagnostics removed_staff = row_count;

  delete from public.registration_applications a
   where lower(a.parent_email) like lower(email_pattern);
  get diagnostics removed_applications = row_count;

  -- Notifications cascade from auth.users, but clearing them explicitly keeps
  -- the counts in the summary honest when delete_auth_users is false.
  delete from public.notifications n
   where n.recipient_user_id in (
     select u.id from auth.users u where lower(u.email) like lower(email_pattern)
   );
  get diagnostics removed_notifications = row_count;

  removed_auth := 0;
  if delete_auth_users then
    delete from auth.users u where lower(u.email) like lower(email_pattern);
    get diagnostics removed_auth = row_count;
  end if;

  return jsonb_build_object(
    'email_pattern', email_pattern,
    'parents', removed_parents,
    'staff', removed_staff,
    'registration_applications', removed_applications,
    'notifications', removed_notifications,
    'auth_users', removed_auth
  );
end;
$$;

revoke all on function public.clean_stress_test_accounts(text, boolean) from public;
revoke all on function public.clean_stress_test_accounts(text, boolean) from anon, authenticated;
grant execute on function public.clean_stress_test_accounts(text, boolean) to service_role;
