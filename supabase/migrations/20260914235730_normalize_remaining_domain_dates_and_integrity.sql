ALTER TABLE public.parents ALTER COLUMN joined_date DROP DEFAULT;
ALTER TABLE public.parents ALTER COLUMN joined_date TYPE date USING NULLIF(joined_date,'')::date;
ALTER TABLE public.staff ALTER COLUMN joined_date DROP DEFAULT;
ALTER TABLE public.staff ALTER COLUMN joined_date TYPE date USING NULLIF(joined_date,'')::date;
ALTER TABLE public.tournaments ALTER COLUMN start_date DROP DEFAULT;
ALTER TABLE public.tournaments ALTER COLUMN end_date DROP DEFAULT;
ALTER TABLE public.tournaments ALTER COLUMN start_date TYPE date USING NULLIF(start_date,'')::date;
ALTER TABLE public.tournaments ALTER COLUMN end_date TYPE date USING NULLIF(end_date,'')::date;
ALTER TABLE public.videos ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE public.videos ALTER COLUMN created_at TYPE timestamptz USING NULLIF(created_at,'')::timestamptz;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS chk_subscriptions_amount_positive;
ALTER TABLE public.subscriptions ADD CONSTRAINT chk_subscriptions_amount_positive CHECK (amount > 0);
ALTER TABLE public.staff ADD CONSTRAINT chk_staff_experience_nonnegative CHECK (experience_years IS NULL OR experience_years >= 0);
ALTER TABLE public.staff ADD CONSTRAINT chk_staff_rating_range CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));
ALTER TABLE public.matches ADD CONSTRAINT chk_matches_result_valid CHECK (result IN ('scheduled','win','draw','loss','cancelled','postponed'));
ALTER TABLE public.tournaments ADD CONSTRAINT chk_tournaments_date_range CHECK (end_date >= start_date);
ALTER TABLE public.tournaments ADD CONSTRAINT chk_tournaments_teams_count_nonnegative CHECK (teams_count >= 0);
ALTER TABLE public.player_documents ADD CONSTRAINT chk_player_documents_size_nonnegative CHECK (file_size >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_settings_singleton ON public.academy_settings ((true));

CREATE OR REPLACE FUNCTION internal.validate_team_coach()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
BEGIN
  IF NEW.coach_id IS NULL OR NEW.coach_id = '' THEN RAISE EXCEPTION 'A team must have an assigned coach'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.id = NEW.coach_id AND s.role='coach' AND s.status='active') THEN
    RAISE EXCEPTION 'Assigned team coach must be an active staff member with role coach';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_team_coach ON public.teams;
CREATE TRIGGER trg_validate_team_coach BEFORE INSERT OR UPDATE OF coach_id ON public.teams FOR EACH ROW EXECUTE FUNCTION internal.validate_team_coach();

CREATE OR REPLACE FUNCTION internal.guard_staff_deactivation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
BEGIN
  IF OLD.status='active' AND NEW.status<>'active' AND EXISTS (SELECT 1 FROM public.teams t WHERE t.coach_id=OLD.id) THEN
    RAISE EXCEPTION 'Cannot deactivate staff member while assigned as a team coach';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_staff_deactivation ON public.staff;
CREATE TRIGGER trg_guard_staff_deactivation BEFORE UPDATE OF status ON public.staff FOR EACH ROW EXECUTE FUNCTION internal.guard_staff_deactivation();

CREATE OR REPLACE FUNCTION internal.validate_match_result()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result='win' AND NEW.academy_score<=NEW.opponent_score THEN RAISE EXCEPTION 'Match result win conflicts with scores'; END IF;
  IF NEW.result='draw' AND NEW.academy_score<>NEW.opponent_score THEN RAISE EXCEPTION 'Match result draw conflicts with scores'; END IF;
  IF NEW.result='loss' AND NEW.academy_score>=NEW.opponent_score THEN RAISE EXCEPTION 'Match result loss conflicts with scores'; END IF;
  IF NEW.result='scheduled' AND (NEW.academy_score<>0 OR NEW.opponent_score<>0) THEN RAISE EXCEPTION 'Scheduled match cannot have a non-zero score'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_match_result ON public.matches;
CREATE TRIGGER trg_validate_match_result BEFORE INSERT OR UPDATE OF result, academy_score, opponent_score ON public.matches FOR EACH ROW EXECUTE FUNCTION internal.validate_match_result();

CREATE OR REPLACE FUNCTION internal.guard_login_audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'login_audit_logs is append-only'; END; $$;
DROP TRIGGER IF EXISTS trg_guard_login_audit_log_update ON public.login_audit_logs;
DROP TRIGGER IF EXISTS trg_guard_login_audit_log_delete ON public.login_audit_logs;
CREATE TRIGGER trg_guard_login_audit_log_update BEFORE UPDATE ON public.login_audit_logs FOR EACH ROW EXECUTE FUNCTION internal.guard_login_audit_log_immutable();
CREATE TRIGGER trg_guard_login_audit_log_delete BEFORE DELETE ON public.login_audit_logs FOR EACH ROW EXECUTE FUNCTION internal.guard_login_audit_log_immutable();

CREATE INDEX IF NOT EXISTS idx_subscriptions_player_id ON public.subscriptions(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_id ON public.matches(team_id);
CREATE INDEX IF NOT EXISTS idx_trainings_team_id ON public.trainings(team_id);
CREATE INDEX IF NOT EXISTS idx_player_documents_player_id ON public.player_documents(player_id);
CREATE INDEX IF NOT EXISTS idx_attendance_player_id ON public.attendance(player_id);
