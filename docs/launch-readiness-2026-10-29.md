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

**Deployment status:** prepared and locally verified, **not applied to production**.
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
| Web production | Public smoke only | Home and login screen loaded; no authenticated journey executed |
| Bolt linkage | Observed | Editor reports synced to Alshomeli/Shooter_academylast, main; no exact deployed artifact hash established |
| Test environments | Blocked for hosted acceptance | Shooter test has zero public tables/functions; two older test branches report MIGRATIONS_FAILED |
| Full real Supabase integration | Blocked | Dedicated local branch is configured to trigger the existing disposable Docker workflow, but the push was rejected by automatic approval review; no new remote CI ran. Docker is not installed in this executor |
| Shooter MCP connector | Blocked | Snapshot and history calls return internal errors; no matching MCP/gateway invocations appeared in the inspected Edge logs; root cause not established |
| Branch protection | Blocked | main branch unprotected and repository rulesets empty at inspection; connector cannot write protection settings, and the browser has no signed-in GitHub session |

The new registration fixture does not replace hosted Auth/PostgREST/Storage,
production trigger parity, full migration replay, browser tests or concurrency
testing. Existing family-payment, renewal, attendance and goalkeeper tests run
in the baseline suite; this does not prove the corresponding production UI flows.

## Remaining release gates

1. Complete real Supabase migration replay and Auth/Storage integration; do not
   enable family receipts solely because fixture tests pass.
2. Run authenticated manager/parent/coach/goalkeeper browser acceptance using
   isolated synthetic identities, including cross-user denial, proof correction,
   payment approval, renewal/expiry and Bahrain dates.
3. Resolve the MCP connector failure and confirm cloud OAuth end to end.
4. Apply the reviewed Telegram repair only with production release authorization
   that accounts for queued message delivery; verify delivery and bounded logs.
5. Require successful quality checks before main merges and confirm exact deployed
   version. Existing reminders are scheduled; scheduled invoice renewal execution
   was not established by the inspected cron job names.

No production business rows, accounts, payments, grants or deployment were changed
by this review. Older readiness documents are historical evidence, not proof that
their reported blockers remain current.

## Publication blocker

Automatic approval review rejected the Git push to
`Alshomeli/Shooter_academylast`, branch `fix/launch-readiness-20261029`, because
the current user authorization was considered insufficiently explicit about the
payload and destination. No PR was created and the publication was not retried
through another tool. The five-file change consists of one forward migration,
two synthetic regression-test files, this readiness report, and a branch-specific
integration-workflow trigger. Publishing this branch requires explicit approval;
it does not itself merge to main or apply a production migration.
