-- Remediation 12: Performance indexes + redundant index removal
-- No RLS, grant, policy, function, or trigger changes.

-- Priority 1: Missing indexes on frequently queried columns

CREATE INDEX IF NOT EXISTS idx_staff_user_id
  ON public.staff(user_id);

CREATE INDEX IF NOT EXISTS idx_staff_email_lower
  ON public.staff(lower(email));

CREATE INDEX IF NOT EXISTS idx_players_parent_email
  ON public.players(parent_email);

CREATE INDEX IF NOT EXISTS idx_player_documents_player_id
  ON public.player_documents(player_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_player_id
  ON public.subscriptions(player_id);

-- Priority 2: Remove redundant index
-- idx_attendance_player_id is a subset of idx_attendance_composite(player_id, session_date).
-- Any query filtering by player_id alone is served by the composite index's leading column.
DROP INDEX IF EXISTS public.idx_attendance_player_id;
