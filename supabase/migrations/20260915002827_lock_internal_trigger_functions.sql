REVOKE EXECUTE ON FUNCTION internal.guard_player_sensitive_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internal.guard_staff_deactivation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internal.guard_login_audit_log_immutable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internal.validate_subscription_player() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internal.validate_subscription_state() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internal.validate_team_coach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internal.validate_match_result() FROM PUBLIC, anon, authenticated;
DO $
BEGIN
  IF to_regprocedure('internal.example_function()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION internal.example_function() FROM PUBLIC, anon, authenticated';
  END IF;
END
$;
