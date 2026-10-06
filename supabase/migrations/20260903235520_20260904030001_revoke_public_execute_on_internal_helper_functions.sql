/*
  # Remediation 3: Revoke PUBLIC/anon EXECUTE on internal helper functions

  ## Problem
     6 internal functions have EXECUTE granted to PUBLIC (inherited by anon):
       - internal.current_user_role()
       - internal.has_role(text[])
       - internal.is_academy_admin()
       - internal.is_academy_member()
       - internal.is_active_member()
       - internal.stamp_login_audit_log()

  ## Safety analysis
     - RLS policies use has_role() and is_active_member(), but RLS is only
       evaluated when the caller has table-level privileges. anon has FALSE
       on all table privileges, so RLS is never evaluated for anon. Revoking
       anon EXECUTE cannot break RLS.
     - authenticated has explicit EXECUTE grants on all these functions,
       so RLS policy evaluation for authenticated users is unaffected.
     - is_academy_admin() is only called from SECURITY DEFINER functions
       (get_staff_private, get_parent_private) which run as postgres (owner).
     - stamp_login_audit_log() is a trigger function. PostgreSQL trigger
       execution does not check EXECUTE privileges — the trigger fires
       regardless of caller's EXECUTE permission on the function.
     - current_user_role() is not used in any RLS policy, frontend, edge
       function, or other function.
     - is_academy_member() is not used in any RLS policy or function call.
     - No frontend or edge function calls any of these directly.

  ## Change
     REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC for all 6 functions.
     (anon inherits from PUBLIC, so this closes anon access too.)
     authenticated and service_role retain their explicit EXECUTE grants.
     postgres retains EXECUTE as owner.

  ## What does NOT change
     - RLS policies, table/column privileges, data, frontend, edge functions
     - Function definitions, search_path, security definer status, owners
     - Remediation 1 and 2 results
*/

REVOKE EXECUTE ON FUNCTION internal.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.has_role(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.is_academy_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.is_academy_member() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.is_active_member() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.stamp_login_audit_log() FROM PUBLIC;
