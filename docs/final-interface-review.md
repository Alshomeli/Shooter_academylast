# Final interface review — 2026-10-14

Reviewed the current main source at b4a3c9b6f3e667766615cca6f0bfe8526fe5b40b: public homepage, parent portal, staff sidebar, login/recovery routing, legal pages, contact links, public media and HTML metadata. Recent mobile/sidebar/theme browser checks remain applicable; the latest fixes target confirmed gaps rather than changing account permissions or financial behavior.

## Corrections

- Old `/landing.html` and `/forgot-password.html` contained static POST forms with no authentication backend. They now redirect to the real platform and its forgot-password screen. Recovery and onboarding retain routing priority.
- Legal pages now load independently of the authenticated app, support the shared theme preference, and have explicit dark text/link/surface colors.
- Login provides a public-home link. Legal navigation distinguishes the public homepage from platform login.
- Social preview image URLs are absolute, pointing to the current Bolt hosting origin. Change these if hosting moves.

## Database review (read-only)

On the Shooter academy project jgvfruijtixguavspyer, all public tables have RLS enabled. The security advisor flags `get_parent_academy_activities()` as callable by authenticated users with SECURITY DEFINER. This is intentional: execution is unavailable to anon, the function checks the parent's role, and `internal.has_role` requires an active parent record linked to auth.uid(). The RPC returns an allowlist of activity fields rather than player/account documents. Do not remove this RPC grant merely to silence the advisor.

Performance notices include overlapping SELECT policies on matches/trainings and unused indexes. They do not justify deleting indexes or changing access rules without workload measurements and permission regression tests. No production database changes were made.

## Verification limits and remaining content

Local browser checks and GitHub quality/build gates verify code and rendering; no real registration approval, payment approval, email delivery or Telegram action is performed by this review. The deployed HTML was readable, but browser navigation to the live host was blocked by the review environment's connection, so a complete live end-to-end review is not claimed.

The policy pages still describe their text as an operational draft pending academy/legal adoption. No legal content was rewritten. Verified coach portraits remain unsupplied. Event gallery, JPL announcement and Farid video use the academy-supplied public material.

Advisor references: [intentional SECURITY DEFINER RPC access](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [overlapping policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
