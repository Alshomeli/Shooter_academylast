# Staging attendance and renewal review — 11 October 2026

Repository: `Alshomeli/Shooter_academylast` (private).
Target branch: `Staging-shooter`, reviewed at `a210dfe15c073351462ff0a96c54315282bda7ec`.
Changes are proposed through a separate review branch targeting staging. No merge or deployment is part of this work.

## Comparison with the old repository

References reviewed:

- [PR 117](https://github.com/Alshomeli/Shooter_academy--last/pull/117), head `c18c8dd060272ae1037bcffca2957890b2b813bb`.
- [PR 118](https://github.com/Alshomeli/Shooter_academy--last/pull/118), head `9307556db02e3e75f274d6fd4b4b5156535eca35`.

| Area | Staging before this change | Resolution |
| --- | --- | --- |
| Match identity in frontend | `Attendance.matchId` and mapper `match_id` already use strings | Retained; tested with non-UUID text IDs |
| Match identity in schema | No migration added `attendance.match_id`; the existing table fixture also lacks it | New migration adds nullable `text`, checks both it and `matches.id` are `text`, adds a validated foreign key |
| Attendance index | Four-part identity omits match ID | Five-part identity includes `coalesce(match_id, '')`, following PR 117 |
| Attendance RPC | Six arguments; insert and `ON CONFLICT` omit match ID | Seven-argument implementation and invoker wrapper; index and conflict expressions match exactly |
| API compatibility | Existing training/legacy callers use six arguments | Optional final `p_match_id` keeps six-argument calls usable; old signatures are removed to avoid ambiguous overloads |
| AI attendance | Gateway, MCP schema and form omit match identity | Match selector, prepared payload/preview and RPC forwarding now carry text `matchId` |
| Batch attendance | No pre-save duplicate guard | Guard from PR 118's approach rejects existing and within-batch repeats; database remains authoritative |
| Renewal | PR 118's renewal helper and button absent | Ported the helper and form flow: new unpaid period, no copied ID/version/payment evidence |
| Business dates | Attendance/renewal entry defaults use UTC | Use existing Bahrain date helper in these paths |
| CI | Quality Gate targets main only | Also validates PRs targeting staging; adds lint to the gate |

The PR 117 audit-login changes and the unrelated PR 118 CSV, parent-linking, accessibility and performance changes are outside this requested attendance/renewal port. They are not represented as completed here.

## Database safeguards and behavior

- The migration changes schema, functions, grants and indexes only; it contains no business-row `DELETE` or migration-time business-row `UPDATE`.
- Existing attendance remains unchanged. Legacy records without a match ID retain their daily identity; no match association is guessed.
- Duplicate data, invalid historical match references or incompatible ID types stop the transaction instead of being cleaned automatically.
- Match-linked writes validate session type, date and player team for both direct inserts and RPC calls. Linked match deletion is restricted to preserve the reference.
- A repeated RPC call intentionally updates the same attendance row's status/notes. A duplicate direct insert fails. Two distinct matches on the same day succeed.
- The internal definer function retains explicit authentication, active-role and coach-team checks, and an empty search path. Anonymous execution is revoked. Authenticated internal execution is required by the invoker wrapper and remains guarded in the implementation.
- Renewal inserts one unpaid subscription through the existing collection diff/mapper path; the original paid period and linked financial evidence remain intact. Payment confirmation remains a separate operation.

## Verification

All database tests use in-memory PGlite PostgreSQL and synthetic `.invalid` identities. No deployed Supabase connection or credentials were used.

| Check | Result |
| --- | --- |
| Baseline suite | 83/83 passed |
| Final full suite, `npm test` | 97/97 passed; 14 new cases |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, 0 errors and 7 warnings |
| `npm run build` | Passed |
| `git diff --check` | Passed |

New coverage includes:

- Reproducing the actual old RPC failure after applying only the PR 117 index shape, then successfully calling the corrected RPC.
- Missing match column, incompatible UUID column rollback, non-UUID text identifiers, and unchanged historical rows.
- Two matches on one date, retry/correction of the same match, duplicate match/training inserts, two training sessions, legacy six-argument calls.
- Invalid date/team/match/type/status rejection; own-team coach success; other-team coach, parent, accountant, inactive staff, unknown user and anonymous denial.
- Executing the actual gateway handler in a mocked HTTP harness to verify match ID forwarding and rejection of mixed training/match links. This does not claim a deployed Edge runtime test.
- Renewal persistence using actual collection-diff and mapper code plus existing financial guards; byte-equivalent prior rows, unchanged transactions/audit, and one unpaid new period.
- Month-end/leap-year renewal calculations and Bahrain day/year boundaries.

The seven lint warnings concern hook dependencies in App, Approvals, Reports, StaffRegistration and Subscriptions. Build warnings concern a mixed static/dynamic Registration import and a main bundle over 500 kB. These do not fail the commands.

## Limits and rollout

- No production reads/writes, real account creation, financial operations, message sends, merge, or deployment were performed.
- Tests load the relevant real function/migration code onto schema fixtures; they do not replay the entire historical Supabase migration chain. Some historical exports omit top-level statement terminators, so the old attendance function is explicitly extracted for the regression reproduction rather than claiming a clean full-history replay.
- Live schema state, remote advisors, browser/mobile interactions and true multi-connection concurrency were not tested. PGlite is an isolated PostgreSQL runtime, not a hosted Supabase replica.
- The source migration and Edge Function changes are not deployed. A later authorized staging deployment must apply the database migration before the new gateway signature is used, then deploy the gateway/MCP and frontend together and run browser verification.
- GitHub CI status must be read from the new PR; local success is not a claim that remote checks have completed.

Technical references: [PostgreSQL INSERT / conflict inference](https://www.postgresql.org/docs/current/sql-insert.html), [Supabase database functions](https://supabase.com/docs/guides/database/functions). The current Supabase changelog was checked; the September PostgreSQL minor-release notes cover extension/operator changes not used by this migration.
