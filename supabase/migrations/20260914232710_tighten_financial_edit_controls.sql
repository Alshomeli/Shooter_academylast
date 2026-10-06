-- Financial integrity hardening: accountants may create and manage unpaid subscriptions,
-- while paid subscriptions require manager authority to edit.
DROP POLICY IF EXISTS update_subscriptions_authorized ON public.subscriptions;
CREATE POLICY update_subscriptions_authorized
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (
  (select internal.has_role(ARRAY['manager'::text]))
  OR (
    status = 'unpaid'
    AND (select internal.has_role(ARRAY['accountant'::text]))
  )
)
WITH CHECK (
  (select internal.has_role(ARRAY['manager'::text]))
  OR (
    status = 'unpaid'
    AND (select internal.has_role(ARRAY['accountant'::text]))
  )
);

-- Prevent non-managers from altering the financial meaning of an existing transaction.
-- Accountants retain access to non-financial descriptive edits if the UI needs them.
CREATE OR REPLACE FUNCTION internal.guard_transaction_financial_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  IF NOT (select internal.has_role(ARRAY['manager'::text])) THEN
    IF NEW.type IS DISTINCT FROM OLD.type
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.transaction_date IS DISTINCT FROM OLD.transaction_date
       OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
       OR NEW.player_id IS DISTINCT FROM OLD.player_id THEN
      RAISE EXCEPTION 'Only a manager may change financial fields of an existing transaction';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_transaction_financial_fields ON public.transactions;
CREATE TRIGGER trg_guard_transaction_financial_fields
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION internal.guard_transaction_financial_fields();

-- Future linked subscription transactions must be revenue entries in the subscription category,
-- and any explicit player_id must match the subscription owner.
CREATE OR REPLACE FUNCTION internal.validate_transaction_subscription_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE
  v_player_id text;
BEGIN
  IF NEW.subscription_id IS NOT NULL THEN
    SELECT s.player_id INTO v_player_id
    FROM public.subscriptions s
    WHERE s.id = NEW.subscription_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced subscription does not exist';
    END IF;

    IF NEW.type <> 'revenue' OR lower(NEW.category) <> 'subscription' THEN
      RAISE EXCEPTION 'A transaction linked to a subscription must be revenue/subscription';
    END IF;

    IF NEW.player_id IS NOT NULL AND NEW.player_id IS DISTINCT FROM v_player_id THEN
      RAISE EXCEPTION 'Transaction player_id must match the linked subscription player_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_transaction_subscription_link ON public.transactions;
CREATE TRIGGER trg_validate_transaction_subscription_link
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION internal.validate_transaction_subscription_link();

-- Validate existing data before relying on the new linkage rule.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    JOIN public.subscriptions s ON s.id = t.subscription_id
    WHERE t.subscription_id IS NOT NULL
      AND (t.type <> 'revenue' OR lower(t.category) <> 'subscription'
           OR (t.player_id IS NOT NULL AND t.player_id IS DISTINCT FROM s.player_id))
  ) THEN
    RAISE EXCEPTION 'Existing transaction/subscription links violate financial integrity rules';
  END IF;
END;
$$;
