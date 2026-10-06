REVOKE ALL ON FUNCTION internal.guard_transaction_financial_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.validate_transaction_subscription_link() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.guard_transaction_financial_fields() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION internal.validate_transaction_subscription_link() TO postgres, service_role;
