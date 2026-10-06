CREATE INDEX IF NOT EXISTS idx_parents_user_id ON public.parents(user_id) WHERE user_id IS NOT NULL;
