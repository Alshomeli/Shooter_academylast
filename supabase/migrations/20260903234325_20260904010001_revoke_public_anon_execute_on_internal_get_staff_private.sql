/*
  # Remediation 1: Close internal.get_staff_private() to PUBLIC and anon

  ## Problem
     `internal.get_staff_private()` is SECURITY DEFINER, returns salary and
     national_id, and has EXECUTE granted to PUBLIC and anon (inherited from
     the default PUBLIC grant). Any caller -- including unauthenticated anon
     -- can invoke it. The only protection is is_academy_admin() inside the
     function body, which is a single defense-in-depth barrier.

  ## Usage audit
     - Frontend: NO calls to internal.get_staff_private() (uses public version)
     - Database functions: NO function calls internal.get_staff_private()
     - RLS policies: NO policy references internal.get_staff_private()
     - Edge functions: NO reference to internal.get_staff_private()
     The internal version is operationally unused.

  ## Change
     REVOKE EXECUTE ON FUNCTION internal.get_staff_private() FROM PUBLIC;
     REVOKE EXECUTE ON FUNCTION internal.get_staff_private() FROM anon;

     authenticated and service_role retain their explicit EXECUTE grants.
     postgres retains EXECUTE as owner.

  ## What does NOT change
     - public.get_staff_private() (already hardened)
     - RLS policies
     - Table/column privileges
     - Function definition, search_path, security definer status
     - Data, auth users, frontend, edge functions, storage
*/

REVOKE EXECUTE ON FUNCTION internal.get_staff_private() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.get_staff_private() FROM anon;
