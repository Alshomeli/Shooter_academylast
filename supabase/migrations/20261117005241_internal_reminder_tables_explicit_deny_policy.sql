/*
# Explicit deny policies for internal reminder tables

1. Purpose
- `internal.subscription_reminder_days` and `internal.subscription_telegram_reminders`
  have RLS enabled but no policies, which trips the Supabase linter rule
  "RLS Enabled No Policy".
- These tables are internal-only: their sole writer is the SECURITY DEFINER
  function `internal.queue_daily_subscription_reminders()`, owned by `postgres`
  (rolbypassrls = true), so it bypasses RLS entirely.
- The only role holding table privileges is `postgres` (verified via
  `information_schema.role_table_grants`); no grants exist for `anon`,
  `authenticated`, or `service_role`.

2. Security changes
- Add explicit-deny policies for `authenticated` on both tables, matching the
  established project pattern (`*_no_direct_access`, FOR ALL, USING (false),
  WITH CHECK (false)). This resolves the linter warning with deny-by-default
  semantics and does not affect the SECURITY DEFINER writer.

3. Notes
- Safe to re-run: each policy is dropped first.
*/

drop policy if exists subscription_reminder_days_no_direct_access
  on internal.subscription_reminder_days;

create policy subscription_reminder_days_no_direct_access
  on internal.subscription_reminder_days
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists subscription_telegram_reminders_no_direct_access
  on internal.subscription_telegram_reminders;

create policy subscription_telegram_reminders_no_direct_access
  on internal.subscription_telegram_reminders
  for all
  to authenticated
  using (false)
  with check (false);
