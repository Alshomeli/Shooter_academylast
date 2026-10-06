-- Strengthen subscription domain integrity for all future writes.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_type_chk CHECK (plan_type IN ('monthly','quarterly','yearly')) NOT VALID,
  ADD CONSTRAINT subscriptions_amount_positive_chk CHECK (amount > 0) NOT VALID,
  ADD CONSTRAINT subscriptions_status_chk CHECK (status IN ('paid','unpaid')) NOT VALID;

-- Paid rows must carry payment metadata; unpaid rows must not be marked paid.
CREATE OR REPLACE FUNCTION internal.validate_subscription_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    IF NEW.paid_at IS NULL OR NULLIF(trim(COALESCE(NEW.payment_method, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Paid subscription requires paid_at and payment_method';
    END IF;
  ELSIF NEW.status = 'unpaid' THEN
    IF NEW.paid_at IS NOT NULL OR NULLIF(trim(COALESCE(NEW.payment_method, '')), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Unpaid subscription cannot contain payment metadata';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_subscription_state ON public.subscriptions;
CREATE TRIGGER trg_validate_subscription_state
BEFORE INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION internal.validate_subscription_state();

-- Do not allow future subscriptions to be detached from a player.
CREATE OR REPLACE FUNCTION internal.validate_subscription_player()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  IF NEW.player_id IS NULL OR NULLIF(trim(NEW.player_id), '') IS NULL THEN
    RAISE EXCEPTION 'Subscription must be linked to a player';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = NEW.player_id) THEN
    RAISE EXCEPTION 'Subscription player does not exist';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_subscription_player ON public.subscriptions;
CREATE TRIGGER trg_validate_subscription_player
BEFORE INSERT OR UPDATE OF player_id ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION internal.validate_subscription_player();

-- Keep notification content valid on future writes.
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_title_nonempty_chk CHECK (length(trim(title)) > 0) NOT VALID,
  ADD CONSTRAINT notifications_message_nonempty_chk CHECK (length(trim(message)) > 0) NOT VALID;

