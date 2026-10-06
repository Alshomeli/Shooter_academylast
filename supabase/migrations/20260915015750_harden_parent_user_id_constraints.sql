DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parents_user_id_fkey'
      AND conrelid = 'public.parents'::regclass
  ) THEN
    ALTER TABLE public.parents
      ADD CONSTRAINT parents_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS parents_user_id_key
  ON public.parents(user_id)
  WHERE user_id IS NOT NULL;

REVOKE INSERT, UPDATE, DELETE ON public.parents FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.players FROM anon;

