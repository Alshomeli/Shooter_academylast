-- Preserve financial references while excluding archived players from operations.
-- Historical players are marked explicitly by administrative cleanup; new players default to visible.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS archived_at timestamptz;
COMMENT ON COLUMN public.players.archived_at IS 'Operational archive marker; NULL means visible in player lists';
