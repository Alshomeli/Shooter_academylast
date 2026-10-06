-- Keep privileged implementation functions private.
-- Authenticated clients use the public wrappers, which enforce the same
-- role checks while preventing direct access to internal implementation RPCs.

REVOKE ALL ON FUNCTION internal.create_subscription_entry_impl(text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.create_subscription_entry_impl(text, text, date) FROM anon;
REVOKE ALL ON FUNCTION internal.create_subscription_entry_impl(text, text, date) FROM authenticated;

REVOKE ALL ON FUNCTION internal.record_attendance_entry_impl(text, date, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.record_attendance_entry_impl(text, date, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION internal.record_attendance_entry_impl(text, date, text, text, text, text) FROM authenticated;
