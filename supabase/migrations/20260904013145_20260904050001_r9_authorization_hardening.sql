-- ════════════════════════════════════════════════════════════════════
-- REMEDIATION 10 — FINAL AUTHORIZATION HARDENING
--   R9-1: Restrict UPDATE on players.parent_email, parent_id, team_id
--         to manager-only via a BEFORE UPDATE trigger.
--   R9-2: Restrict audit_logs INSERT to manager + receptionist.
--   R9-3: Restrict login_audit_logs INSERT to staff roles only.
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- R9-1: Prevent non-managers from changing authorization-sensitive
--       player columns (parent_email, parent_id, team_id).
--
-- Approach: a BEFORE UPDATE trigger that raises an exception when a
-- non-manager attempts to modify these columns.  Column-level GRANT
-- revocation alone cannot distinguish manager from coach/receptionist
-- (both are "authenticated"), so a trigger is the correct mechanism.
--
-- The trigger preserves the existing RLS UPDATE policy unchanged —
-- coach/receptionist can still UPDATE other player fields; they simply
-- cannot touch these three authorization-sensitive columns.
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION internal.guard_player_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only managers may change parent_email, parent_id, or team_id.
  IF NOT internal.is_academy_admin() THEN
    IF NEW.parent_email IS DISTINCT FROM OLD.parent_email THEN
      RAISE EXCEPTION 'Only managers can modify parent_email'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
      RAISE EXCEPTION 'Only managers can modify parent_id'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
      RAISE EXCEPTION 'Only managers can modify team_id'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_player_sensitive_columns ON public.players;
CREATE TRIGGER trg_guard_player_sensitive_columns
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION internal.guard_player_sensitive_columns();

-- ────────────────────────────────────────────────────────────────────
-- R9-2: Restrict audit_logs INSERT to manager + receptionist only.
--
-- The frontend writes audit entries from manager and receptionist
-- actions.  Other staff roles and parents should not create audit
-- records.  The stamp_audit_log trigger continues to overwrite
-- user_name, user_role, and timestamp from the session.
-- ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_audit_logs_active ON public.audit_logs;

CREATE POLICY insert_audit_logs_authorized
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]));

-- ────────────────────────────────────────────────────────────────────
-- R9-3: Restrict login_audit_logs INSERT to staff roles only.
--
-- Parents must not be able to INSERT into login_audit_logs.  The
-- stamp_login_audit_log trigger continues to overwrite user_name,
-- user_role, and timestamp from the session.
-- ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_login_audit_logs_authenticated ON public.login_audit_logs;

CREATE POLICY insert_login_audit_logs_staff
  ON public.login_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (internal.has_role(ARRAY['manager'::text, 'coach'::text, 'receptionist'::text, 'accountant'::text]));
