# Load testing concurrent logins

This covers the harness that exercises simultaneous sign-ins against the hosted
app and its Supabase project.

| File | Purpose |
| --- | --- |
| `scripts/seed-test-users.ts` | Create throwaway auth users and write `tests/users.csv`. |
| `scripts/cleanup-test-users.ts` | Remove those users and the public-schema rows they touched. |
| `tests/artillery-load-test.yml` | Request-flow test (browse → sign in → authenticated call). |
| `tests/load-test-k6.js` | VU-based concurrency test with thresholds. |
| `supabase/migrations/20261009090000_stress_test_monitoring.sql` | `performance_audit_logs`, its retention purge, and `clean_stress_test_accounts()`. |
| `tests/stress-test-monitoring.test.mjs` | PGlite test that applies the migration and asserts its RLS and teardown behaviour. |

## Rate limits: read this before raising the load

Supabase Auth rate limits `POST /auth/v1/token` **per client IP**, and the
password grant shares the token-refresh limiter:

```go
// supabase/auth — internal/api/apilimiter/apilimiter.go
o.Token = tollbooth.NewLimiter(gc.RateLimitTokenRefresh/(60*5), &limiter.ExpirableOptions{
    DefaultExpirationTTL: time.Hour,
}).SetBurst(30)

// supabase/auth — internal/conf/configuration.go
RateLimitTokenRefresh float64 `split_words:"true" default:"150"`
```

So the default budget is **0.5 requests/second sustained, burst 30**, keyed on
the caller's IP. `internal/api/token.go` selects that limiter for
`grant_type=password` (`limiter := a.limiterOpts.Token`, overridden only for
`web3`).

Consequences for this harness:

- One load generator sending more than ~0.5 logins/second collects `429`s after
  the first 30 requests. The run then measures the rate limiter, not the app.
- Both scripts default to a *smoke* profile that stays inside that budget. The
  aggressive profiles (`artillery run -e high`, `K6_PROFILE=peak`) are only
  meaningful after `GOTRUE_RATE_LIMIT_TOKEN_REFRESH` is raised on the project,
  or the load is spread across several source IPs.
- `PUT /auth/v1/user` is limited from `GOTRUE_RATE_LIMIT_OTP` (default 30 per 5
  minutes per IP, also burst 30). `src/components/Login.tsx` calls
  `supabase.auth.updateUser()` on the staff login path, so staff logging in from
  one office IP share that budget. This is a production consideration, not just a
  test one.
- `GET /auth/v1/user` has no GoTrue limiter, which is why both scripts use it as
  the "one authenticated request per login" step.

## Running a test

```bash
# 1. Seed accounts (service role key; refuses to run without SEED_CONFIRM)
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
SEED_CONFIRM=<project-ref> \
  npx tsx scripts/seed-test-users.ts

# 2a. Artillery
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon-key> \
APP_URL=https://shooter-academy-new-1vvk.bolt.host \
  npx artillery run tests/artillery-load-test.yml

# 2b. k6
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon-key> \
APP_URL=https://shooter-academy-new-1vvk.bolt.host \
  k6 run tests/load-test-k6.js

# 3. Tear down
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
SEED_CONFIRM=<project-ref> \
  npx tsx scripts/cleanup-test-users.ts
```

Both scripts read `tests/users.csv`, so credentials can never drift out of sync
with what was actually seeded. The CSV is generated and git-ignored — it holds
usable credentials, even if they are throwaway ones.

Neither script accepts a hard-coded fallback for `SUPABASE_URL` or
`SUPABASE_SERVICE_ROLE_KEY`, and both refuse to run unless `SEED_CONFIRM`
matches the project ref in the URL.

## What the seeded accounts can actually do

A bare auth user is not an academy member. `internal.is_academy_member()`
requires a `public.staff` row with `user_id = auth.uid()` and
`status = 'active'`, and `db.getCurrentUser()` in `src/lib/store.ts` resolves a
session to either a `staff` or a `parents` row by `user_id`, returning `null`
otherwise — the app then shows "Could not load your account".

So by default the load tests measure auth and one authenticated round-trip, not
the application's data path. Set `SEED_PARENT_ROWS=1` when seeding to give each
account a `public.parents` row; you can then point the authenticated step at a
real table such as `/rest/v1/parents?select=id`. There is no `public.profiles`
table in this project, so a request to `/rest/v1/profiles` returns 404 for every
virtual user and tells you nothing.

## Teardown ordering matters

`public.staff.user_id`, `public.parents.user_id` and
`public.registration_applications.applicant_user_id` all reference
`auth.users(id)` with `ON DELETE SET NULL`. Deleting the auth user first does not
cascade the academy data away — it nulls `user_id` and leaves the row behind.
That is worse than it looks: `internal.has_role()` and
`internal.is_academy_member()` fall back to matching `lower(staff.email)`
against the JWT `email` claim when `user_id IS NULL`, so an orphaned staff row
stays resolvable by email after its auth user is gone.

`clean_stress_test_accounts()` therefore deletes the public-schema rows first,
and `scripts/cleanup-test-users.ts` deletes the auth users afterwards through
`auth.admin.deleteUser()` so the delete is audited and cached sessions are
invalidated. Pass `delete_auth_users := true` to the SQL function only on a
throwaway project — deleting from `auth.users` directly bypasses GoTrue.

## Retention

`performance_audit_logs` has no scheduled purge. Call
`select public.purge_performance_audit_logs(interval '7 days');` from CI or wire
it to `pg_cron`.
