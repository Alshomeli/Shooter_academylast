REVOKE EXECUTE ON FUNCTION public.record_subscription_payment(text,numeric,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_subscription_payment(text,numeric,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.record_subscription_payment(text,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.record_subscription_payment(text,numeric,text,text,text) TO authenticated;
