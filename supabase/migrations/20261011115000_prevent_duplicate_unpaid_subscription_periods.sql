-- Proposed staging migration. Does not change existing subscription rows.
-- Serializes concurrent writes for one player and rejects future duplicate unpaid periods.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_unpaid_subscription_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'unpaid' THEN
    RETURN NEW;
  END IF;

  -- Lock is transaction-scoped; simultaneous requests for one player cannot both pass.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.player_id::text));

  IF EXISTS (
    SELECT 1 FROM public.subscriptions existing
    WHERE existing.player_id = NEW.player_id
      AND existing.status = 'unpaid'
      AND existing.start_date = NEW.start_date
      AND existing.end_date = NEW.end_date
      AND existing.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'An unpaid subscription already exists for this player and period'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_prevent_duplicate_unpaid_period ON public.subscriptions;
CREATE TRIGGER subscriptions_prevent_duplicate_unpaid_period
BEFORE INSERT OR UPDATE OF player_id, status, start_date, end_date
ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_unpaid_subscription_period();

REVOKE ALL ON FUNCTION public.prevent_duplicate_unpaid_subscription_period() FROM PUBLIC, anon, authenticated;
