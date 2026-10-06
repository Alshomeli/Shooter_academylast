-- Public wrappers are SECURITY INVOKER and therefore require the authenticated
-- caller to retain EXECUTE on their internal implementation functions.
-- Keep anon/PUBLIC revoked while restoring only authenticated execution.

GRANT EXECUTE ON FUNCTION internal.create_subscription_entry_impl(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION internal.record_attendance_entry_impl(text, date, text, text, text, text) TO authenticated;
