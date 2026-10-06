-- Remediation 13 P2-1: Data integrity — orphan cleanup + foreign key constraints
-- No RLS, grant, policy, function, or trigger changes (permanent).
-- No financial, attendance, player, or document records are deleted.

-- ── STEP 1: Make FK columns nullable ──
ALTER TABLE public.players ALTER COLUMN parent_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE public.player_documents ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE public.matches ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE public.trainings ALTER COLUMN team_id DROP NOT NULL;

-- ── STEP 2: Temporarily disable the sensitive-column guard trigger ──
-- The trigger blocks parent_id changes for non-managers. We are running as
-- the service role without an auth session, so the guard would fire.
-- We disable it only for the cleanup UPDATE, then immediately re-enable.
ALTER TABLE public.players DISABLE TRIGGER trg_guard_player_sensitive_columns;

-- ── STEP 3: Clean orphan records (SET to NULL, never DELETE) ──

-- players.parent_id: 4 orphans
UPDATE public.players SET parent_id = NULL
  WHERE parent_id IS NOT NULL
    AND parent_id NOT IN (SELECT id FROM public.parents);

-- subscriptions.player_id: 1 orphan (sub-10 → player-10)
UPDATE public.subscriptions SET player_id = NULL
  WHERE player_id IS NOT NULL
    AND player_id NOT IN (SELECT id FROM public.players);

-- attendance.player_id: 1 orphan (att-4 → player-4)
UPDATE public.attendance SET player_id = NULL
  WHERE player_id IS NOT NULL
    AND player_id NOT IN (SELECT id FROM public.players);

-- ── STEP 4: Re-enable the guard trigger ──
ALTER TABLE public.players ENABLE TRIGGER trg_guard_player_sensitive_columns;

-- ── STEP 5: Add supporting indexes ──
CREATE INDEX IF NOT EXISTS idx_players_parent_id ON public.players(parent_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_id ON public.matches(team_id);
CREATE INDEX IF NOT EXISTS idx_trainings_team_id ON public.trainings(team_id);

-- ── STEP 6: Add foreign key constraints ──

-- players → parents: ON DELETE SET NULL
ALTER TABLE public.players
  ADD CONSTRAINT fk_players_parent_id
  FOREIGN KEY (parent_id) REFERENCES public.parents(id)
  ON DELETE SET NULL;

-- subscriptions → players: ON DELETE SET NULL (preserve financial history)
ALTER TABLE public.subscriptions
  ADD CONSTRAINT fk_subscriptions_player_id
  FOREIGN KEY (player_id) REFERENCES public.players(id)
  ON DELETE SET NULL;

-- attendance → players: ON DELETE SET NULL (preserve attendance history)
ALTER TABLE public.attendance
  ADD CONSTRAINT fk_attendance_player_id
  FOREIGN KEY (player_id) REFERENCES public.players(id)
  ON DELETE SET NULL;

-- player_documents → players: ON DELETE CASCADE (dependent records)
ALTER TABLE public.player_documents
  ADD CONSTRAINT fk_player_documents_player_id
  FOREIGN KEY (player_id) REFERENCES public.players(id)
  ON DELETE CASCADE;

-- matches → teams: ON DELETE SET NULL (preserve match history)
ALTER TABLE public.matches
  ADD CONSTRAINT fk_matches_team_id
  FOREIGN KEY (team_id) REFERENCES public.teams(id)
  ON DELETE SET NULL;

-- trainings → teams: ON DELETE SET NULL (preserve training history)
ALTER TABLE public.trainings
  ADD CONSTRAINT fk_trainings_team_id
  FOREIGN KEY (team_id) REFERENCES public.teams(id)
  ON DELETE SET NULL;
