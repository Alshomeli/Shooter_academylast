/*
# Fix is_academy_member(): SECURITY DEFINER -> SECURITY INVOKER

## Purpose
The security scanner flagged `is_academy_member()` as a SECURITY DEFINER
function executable by `anon` and `authenticated` via the REST RPC endpoint.
SECURITY DEFINER runs with the function OWNER's privileges, which is an
unnecessary privilege escalation — the function only needs to read `staff`
(which already has an open SELECT policy) and the caller's own JWT.

## Change
1. Recreate `is_academy_member()` as `SECURITY INVOKER` so it runs with the
   CALLER's privileges, not the owner's. No privilege escalation.
2. Replace the `auth.users` subquery with `auth.jwt() ->> 'email'` so the
   function does not need to touch the `auth.users` table at all. The user's
   email is available directly in their JWT payload. For anon users the JWT
   has no email, so the result is false — correct behavior.
3. Re-grant EXECUTE to `anon, authenticated` (required so RLS policies that
   reference the function can evaluate it for those roles).

## Security notes
- SECURITY INVOKER: the function cannot escalate privileges beyond what the
  calling role already has.
- Uses `auth.jwt()` (available to all roles) instead of querying `auth.users`.
- The `staff` table read is governed by its existing RLS SELECT policy
  (anon, authenticated USING true) — intentional for this single-tenant app.
- Calling the function via REST RPC is now harmless: it returns a boolean
  using only the caller's own JWT email and the public staff list.
*/

DROP POLICY IF EXISTS "temp_noop" ON staff; -- no-op to ensure file is valid

CREATE OR REPLACE FUNCTION public.is_academy_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.email = (auth.jwt() ->> 'email')
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_academy_member() TO anon, authenticated;
