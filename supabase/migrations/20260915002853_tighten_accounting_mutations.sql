DROP POLICY IF EXISTS "update_subscriptions_authorized" ON public.subscriptions;
CREATE POLICY "update_subscriptions_manager_only"
ON public.subscriptions
FOR UPDATE TO authenticated
USING (internal.has_role(ARRAY['manager']))
WITH CHECK (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "update_transactions_authorized" ON public.transactions;
CREATE POLICY "update_transactions_manager_only"
ON public.transactions
FOR UPDATE TO authenticated
USING (internal.has_role(ARRAY['manager']))
WITH CHECK (internal.has_role(ARRAY['manager']));
