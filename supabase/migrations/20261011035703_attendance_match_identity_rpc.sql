-- Staging-only source change. Apply through a reviewed deployment separately.
-- Extend PR #117's identity fix to the schema AND the RPC conflict target.
-- No business rows are deleted, rewritten, or assigned inferred match IDs.
BEGIN;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS match_id text;
DO $$
BEGIN
  IF (SELECT atttypid FROM pg_attribute WHERE attrelid = 'public.attendance'::regclass
      AND attname = 'match_id' AND NOT attisdropped) <> 'text'::regtype
     OR (SELECT atttypid FROM pg_attribute WHERE attrelid = 'public.matches'::regclass
      AND attname = 'id' AND NOT attisdropped) <> 'text'::regtype THEN
    RAISE EXCEPTION 'attendance.match_id and matches.id must both be text; review schema before migrating';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.attendance'::regclass
      AND conname = 'fk_attendance_match_id') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT fk_attendance_match_id
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$$;
-- Fail and roll back on invalid historical links instead of altering real data.
ALTER TABLE public.attendance VALIDATE CONSTRAINT fk_attendance_match_id;

DROP INDEX IF EXISTS public.attendance_unique_player_session;
CREATE UNIQUE INDEX attendance_unique_player_session ON public.attendance
  (player_id, session_date, session_type, coalesce(training_id, ''), coalesce(match_id, ''));
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_match_player ON public.attendance
  (match_id, player_id) WHERE match_id IS NOT NULL AND player_id IS NOT NULL;

-- Protect the direct table path as well as the AI RPC path.
CREATE OR REPLACE FUNCTION internal.validate_attendance_match_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_match public.matches%rowtype;
  v_team text;
BEGIN
  IF NEW.match_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.session_type IS DISTINCT FROM 'match' OR NEW.training_id IS NOT NULL THEN
    RAISE EXCEPTION 'Match attendance cannot reference a training';
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE id = NEW.match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attendance match_id does not reference a valid match'; END IF;
  IF NEW.session_date IS DISTINCT FROM v_match.match_date THEN
    RAISE EXCEPTION 'Attendance session_date must match the linked match date';
  END IF;
  IF NEW.player_id IS NOT NULL THEN
    SELECT team_id INTO v_team FROM public.players WHERE id = NEW.player_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Attendance player_id does not reference a valid player'; END IF;
    IF v_team IS DISTINCT FROM v_match.team_id THEN
      RAISE EXCEPTION 'Attendance player must belong to the match team';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.validate_attendance_match_link() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_validate_attendance_match_link ON public.attendance;
CREATE TRIGGER trg_validate_attendance_match_link
  BEFORE INSERT OR UPDATE OF match_id, training_id, player_id, session_type, session_date
  ON public.attendance FOR EACH ROW EXECUTE FUNCTION internal.validate_attendance_match_link();

-- Replace the six-argument API, rather than leaving ambiguous defaulted overloads.
-- Existing training callers remain compatible because p_match_id defaults to NULL.
DROP FUNCTION IF EXISTS public.record_attendance_entry(text,date,text,text,text,text);
DROP FUNCTION IF EXISTS internal.record_attendance_entry_impl(text,date,text,text,text,text);
CREATE OR REPLACE FUNCTION internal.record_attendance_entry_impl(
  p_player_id text, p_session_date date, p_session_type text DEFAULT 'training',
  p_status text DEFAULT 'present', p_notes text DEFAULT NULL,
  p_training_id text DEFAULT NULL, p_match_id text DEFAULT NULL
)
RETURNS public.attendance LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text;
  v_player public.players%rowtype;
  v_attendance public.attendance%rowtype;
  v_training_id text := nullif(trim(coalesce(p_training_id, '')), '');
  v_match_id text := nullif(trim(coalesce(p_match_id, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  v_role := internal.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('manager', 'coach') THEN
    RAISE EXCEPTION 'Only manager or coach can record attendance' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(coalesce(p_player_id, '')), '') IS NULL THEN RAISE EXCEPTION 'Player is required'; END IF;
  IF p_session_date IS NULL THEN RAISE EXCEPTION 'Session date is required'; END IF;
  IF p_session_type IS NULL OR p_session_type NOT IN ('training', 'match') THEN RAISE EXCEPTION 'Invalid session type'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('present', 'absent', 'excused') THEN RAISE EXCEPTION 'Invalid attendance status'; END IF;
  IF (p_session_type = 'training' AND v_match_id IS NOT NULL)
     OR (p_session_type = 'match' AND v_training_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Attendance session type must match its linked session';
  END IF;
  SELECT * INTO v_player FROM public.players WHERE id = p_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF v_role = 'coach' AND NOT coalesce(internal.is_coach_of_team(v_player.team_id), false) THEN
    RAISE EXCEPTION 'Coach can only record attendance for own team' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.attendance
    (id, player_id, session_date, session_type, status, notes, training_id, match_id)
  VALUES ('att-' || gen_random_uuid()::text, p_player_id, p_session_date, p_session_type,
    p_status, nullif(trim(coalesce(p_notes, '')), ''), v_training_id, v_match_id)
  ON CONFLICT (player_id, session_date, session_type, (coalesce(training_id, '')), (coalesce(match_id, '')))
  DO UPDATE SET status = excluded.status, notes = excluded.notes
  RETURNING * INTO v_attendance;
  RETURN v_attendance;
END;
$$;
CREATE OR REPLACE FUNCTION public.record_attendance_entry(
  p_player_id text, p_session_date date, p_session_type text DEFAULT 'training',
  p_status text DEFAULT 'present', p_notes text DEFAULT NULL,
  p_training_id text DEFAULT NULL, p_match_id text DEFAULT NULL
)
RETURNS public.attendance LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT internal.record_attendance_entry_impl($1,$2,$3,$4,$5,$6,$7);
$$;
REVOKE ALL ON FUNCTION internal.record_attendance_entry_impl(text,date,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_attendance_entry(text,date,text,text,text,text,text) FROM PUBLIC, anon;
-- The invoker wrapper requires this grant; the internal function checks auth and role itself.
GRANT EXECUTE ON FUNCTION internal.record_attendance_entry_impl(text,date,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_entry(text,date,text,text,text,text,text) TO authenticated;
COMMIT;
