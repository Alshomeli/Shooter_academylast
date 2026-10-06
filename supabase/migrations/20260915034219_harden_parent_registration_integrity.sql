CREATE OR REPLACE FUNCTION internal.validate_parent_registration_player()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_user uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.user_id INTO parent_user
  FROM public.parents p
  WHERE p.id = NEW.parent_id;

  IF parent_user IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_email IS DISTINCT FROM (SELECT p.email FROM public.parents p WHERE p.id = NEW.parent_id) THEN
    RAISE EXCEPTION 'Player parent email must match parent record';
  END IF;

  IF NEW.parent_name IS DISTINCT FROM (SELECT p.name FROM public.parents p WHERE p.id = NEW.parent_id) THEN
    RAISE EXCEPTION 'Player parent name must match parent record';
  END IF;

  IF NEW.parent_phone IS DISTINCT FROM (SELECT p.phone FROM public.parents p WHERE p.id = NEW.parent_id) THEN
    RAISE EXCEPTION 'Player parent phone must match parent record';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_parent_registration_player ON public.players;
CREATE TRIGGER trg_validate_parent_registration_player
BEFORE INSERT OR UPDATE OF parent_id, parent_email, parent_name, parent_phone ON public.players
FOR EACH ROW EXECUTE FUNCTION internal.validate_parent_registration_player();

REVOKE ALL ON FUNCTION internal.validate_parent_registration_player() FROM PUBLIC, anon, authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS ux_parents_user_id_not_null
ON public.parents (user_id)
WHERE user_id IS NOT NULL;
