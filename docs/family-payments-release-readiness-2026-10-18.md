# Shooter Academy — Family payments release readiness (2026-10-18)

## Decision: LOCAL TESTS PASSED; PRODUCTION ACTIVATION BLOCKED

Branch: `feature/family-receipt-intake-no-merge-20261018`. Last verified code SHA: `c2c0323b895545400e53bf596fc90e38684cd6c3`.
Both GitHub workflows, **PR validation** and **Quality Gate**, concluded **success** at that SHA.

### Verified in isolated PostgreSQL (PGlite) and static contract checks
- Family receipt intake: parent ownership, siblings, one billing period, proof metadata and duplicate claims.
- Family receipt approval: manual manager amount verification, atomic per-child revenue entries, receipt numbers, new-player activation, idempotency.
- Recurring per-player fee copied from approved registration; renewal creation uses fee, cannot duplicate; parent notification.
- Private storage deletion policy compiles and contains protections for individual and family proof references.
- Frontend lint/typecheck/build and relevant test suite pass.

### Unverified / hard blockers before production release
1. Full nine-migration sequence executed on a **disposable, real Supabase** environment with authentic auth, RLS, and Storage semantics.
2. Authenticated parent upload and manager approval end-to-end in a browser, including storage signed URL and denial checks.
3. Confirm database schema and RPC compatibility against the live version **using read-only checks only**, then migrations applied solely after explicit release authorization.
4. Renewal scheduler installation/testing (no daily scheduler is active). Verify Bahrain-local dates and preventing duplicate notices in deployment.
5. Production feature flag remains off: `VITE_ENABLE_FAMILY_RECEIPTS` must not be set to `true` before the above checks.

### Safety and costs
- No deployment, merging to main, PR to main, or writes to production or restore project.
- No paid Supabase project created. Local PGlite tests are free.
- This report does NOT certify real Supabase RLS/Storage behavior: local mocks cannot emulate all platform details.

### Next decision
Do not release this feature until the five blockers above are addressed. Existing live payment workflows remain unchanged.
