-- Prevent direct creation of subscription revenue transactions.
-- All subscription payments must go through the controlled payment RPC.
DROP POLICY IF EXISTS "insert_transactions_authorized" ON public.transactions;

CREATE POLICY "insert_transactions_non_subscription_authorized"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  internal.has_role(ARRAY['manager','accountant'])
  AND subscription_id IS NULL
);

-- Ensure one financial transaction can exist for each subscription.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_subscription_payment
ON public.transactions (subscription_id)
WHERE subscription_id IS NOT NULL;

-- Repair the audit trigger to match the current audit_logs schema.
CREATE OR REPLACE FUNCTION internal.audit_subscription_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'internal'
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    id,
    action,
    timestamp,
    user_role,
    user_name,
    details,
    created_at
  )
  VALUES (
    'audit-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '-' || substr(md5(random()::text),1,8),
    'subscription_payment_recorded',
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
    internal.current_user_role(),
    coalesce((SELECT s.name FROM public.staff s WHERE s.user_id = auth.uid() LIMIT 1), coalesce(auth.jwt() ->> 'email','')),
    'تم تسجيل سداد الاشتراك ' || coalesce(new.subscription_id,'') || ' بمبلغ ' || new.amount::text || '، رقم المعاملة ' || new.id,
    now()
  );
  RETURN new;
END;
$$;

-- Ensure the payment RPC itself remains the only route that can create linked subscription transactions.
REVOKE EXECUTE ON FUNCTION internal.record_subscription_payment(text,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.record_subscription_payment(text,numeric,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_subscription_payment(text,numeric,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_subscription_payment(text,numeric,text,text,text) TO authenticated;
