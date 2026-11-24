# Launch readiness — 2026-10-29

Decision: **general launch remains blocked**. This review does not certify every
feature or the absence of vulnerabilities. Baseline: main commit
`b1b333a85c616dfa7f767b398dfa2582dd8bfef1`.

## Confirmed production defect

**TG-1 — high, Telegram notification delivery:** bounded production logs showed
293 `telegram_claim_registration_notifications` HTTP 403 failures, followed by
failed notification flushes. Catalog inspection confirms that four SECURITY
DEFINER outbox functions compare `current_user` with `service_role` even though
their owner is `postgres`. Inside SECURITY DEFINER, `current_user` is the owner.
The check therefore rejects the legitimate backend caller. Aggregate inspection
also found 51 pending login notifications.

**TG-2 — medium, login notification lookup:** the login claim function joins
`login_audit_logs.id` (text) to the independent outbox `id` (UUID), instead of
joining through `telegram_login_outbox.login_audit_id`. The service-role guard
currently masks this second failure.

The forward migration replaces the invalid caller check with the actual session
role (`current_setting('role', true)`), retains service-role-only EXECUTE grants,
and fixes the join. Isolated PostgreSQL tests reproduce the original rejection,
apply the repair twice, verify claims, completion, retry and no double claim,
and deny anon/authenticated calls. An additional deliberately over-granted role
is still rejected by the function body.

**Deployment status:** prepared, verified locally and in real disposable Supabase
migration replay, **not applied to production**.
The migration itself does not consume rows or send messages. Applying it allows
the existing five-minute dispatcher to resume pending notifications, including
the observed login backlog. Review recipient configuration and backlog behavior
before production application; no real messages were sent in these tests.
Recovery: restore the four pre-application function definitions and ACLs from a
target catalog snapshot if necessary; this restores the previous delivery failure
and does not undo messages already delivered. No data deletion is needed.

## Evidence and coverage

| Area | Result | Evidence / limitation |
|---|---|---|
| Baseline code | Passed | lint, typecheck, 315 baseline tests, Vite production build |
| Final local code | Passed | 318 tests, zero failures/skips; lint/typecheck and diff whitespace checks passed |
| New unified registration tests | Passed | Actual approval and issuance SQL over minimal synthetic tables; mixed siblings, role denial, malformed fees, exemption reason, duplicate approval, later-child failure and full rollback |
| New Telegram tests | Passed | Actual original and repaired SQL in PGlite; synthetic rows only |
| Production schema | Read-only checks passed within scope | Unified approval/issuance RPCs present; staff RPC ACLs present; no public base tables without RLS; storage buckets private |
| Supabase security advisor | No WARN/ERROR returned | Two INFO notices for internal reminder tables without policies; not a behavioral access proof |
| Latest main CI | Passed | Quality Gate run 40815571151; code, types, tests, build |
| Review branch CI | Passed | Commit b206c8296fe5ffe999a268409254da19b286fb2d: Quality Gate 40852084536 and PR validation 40852084506; includes production dependency audit |
| Web production | Public smoke only | Home and login screen loaded; no authenticated journey executed |
| Bolt linkage | Observed | Editor reports synced to Alshomeli/Shooter_academylast, main; no exact deployed artifact hash established |
| Test environments | Blocked for hosted acceptance | Shooter test has zero public tables/functions; two older test branches report MIGRATIONS_FAILED |
| Full real Supabase integration | Passed | Run 40852040948 applied all 248 migrations in disposable Docker Supabase and passed real Auth/PostgREST/private Storage tests, including production accounting trigger parity, proof correction, exact-amount approval, duplicate denial, cross-parent isolation and evidence retention |
| Shooter MCP connector | Blocked | Snapshot/history tools still return internal errors; root cause not established. Direct health/discovery return 200, and unauthenticated MCP returns 401 with OAuth challenge. Editable plugin files contain App identity/metadata only; connection configuration is not exposed there |
| Branch protection | Blocked | main branch unprotected and repository rulesets empty at inspection; connector cannot write protection settings, and the browser has no signed-in GitHub session |

The new unified registration fixture does not replace authenticated browser or
concurrency testing. Real Supabase Auth/PostgREST/Storage, production accounting
trigger parity and full fresh migration replay have now passed in CI. Existing
renewal, attendance and goalkeeper tests run in the baseline suite; this does not
prove the corresponding production UI flows or an existing-production upgrade.

CI evidence:
- https://github.com/Alshomeli/Shooter_academylast/actions/runs/40852040948
- https://github.com/Alshomeli/Shooter_academylast/actions/runs/40852084536
- https://github.com/Alshomeli/Shooter_academylast/actions/runs/40852084506

## Remaining release gates

1. Run authenticated manager/parent/coach/goalkeeper browser acceptance using
   isolated synthetic identities, including cross-user denial, proof correction,
   payment approval, renewal/expiry and Bahrain dates.
2. Resolve the MCP connector failure and confirm cloud OAuth end to end.
3. Apply the reviewed Telegram repair only with production release authorization
   that accounts for queued message delivery; verify delivery and bounded logs.
4. Require successful quality checks before main merges and confirm exact deployed
   version. Existing reminders are scheduled; scheduled invoice renewal execution
   was not established by the inspected cron job names.

No production business rows, accounts, payments, grants or deployment were changed
by this review. Older readiness documents are historical evidence, not proof that
their reported blockers remain current.

## Publication status

An earlier Git push was rejected by automatic approval review. The user then
explicitly approved the five-file payload, destination repository and branch.
Publication through the authenticated GitHub connector succeeded, and draft PR
71 is open: https://github.com/Alshomeli/Shooter_academylast/pull/71.
The five-file change consists of one forward migration, two synthetic regression
test files, this readiness report and a branch-specific integration-workflow
trigger. No main merge or production migration was performed.
