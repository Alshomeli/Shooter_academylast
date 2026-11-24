# Project memory

## Product intent & audience

- **Shooter Academy**: production sports/shooting academy management platform.
- Manages players, subscriptions, and automated reminders (subscription + Telegram).
- Primary audience: academy staff/admins managing player data, subscriptions, and notifications.
- Arabic-speaking users; UI is RTL.

## Brand personality & voice

- Professional, security-conscious academy administration tool.
- Assistant communicates in Arabic during interactions.

## Visual design & UX direction

- Dark theme, mobile-first, responsive (per existing app conventions).
- No new design direction inferred this turn.

## Decisions, constraints & rationale

- **Internal-table RLS pattern**: tables in `internal` schema (e.g. `internal.subscription_reminder_days`, `internal.subscription_telegram_reminders`) use explicit-deny policies — single policy `FOR ALL TO authenticated` with `USING (false)` / `WITH CHECK (false)`. This resolves "RLS enabled, no policy" warnings without granting client access.
- **Privilege model**: only `postgres` role holds grants on internal reminder tables; reminder-queuing functions run with elevated privileges and bypass RLS, so deny-all policies don't break scheduled jobs.
- **Schema changes**: applied directly to the live database via migration tool (local migration file writes are blocked in this environment). Migrations are named descriptively (e.g. `internal_reminder_tables_explicit_deny_policy`).
- **No local files changed** when the fix is purely database-level.
- Global rules in `.bolt/prompt` govern all modifications (minimal changes, reuse existing patterns, no direct data manipulation, RPC-first, no RLS weakening).

## Open questions & assumptions

- Next scheduled reminder run needs real-world verification to confirm deny policies don't interrupt queuing (assumed safe since functions bypass RLS).
- No outstanding product/design questions inferred from this turn.