-- Login audit logs must be append-only, like the existing audit_logs table.
DROP POLICY IF EXISTS delete_login_audit_logs_manager ON public.login_audit_logs;
DROP POLICY IF EXISTS update_login_audit_logs_manager ON public.login_audit_logs;

DROP TRIGGER IF EXISTS trg_guard_login_audit_logs_immutable ON public.login_audit_logs;
CREATE TRIGGER trg_guard_login_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.login_audit_logs
FOR EACH ROW EXECUTE FUNCTION internal.guard_audit_log_immutable();

-- Prevent duplicate jersey numbers within the same team.
CREATE UNIQUE INDEX IF NOT EXISTS uq_players_team_jersey
ON public.players(team_id, jersey_number)
WHERE team_id IS NOT NULL AND jersey_number IS NOT NULL;

-- Parent email is a natural unique identifier when supplied.
CREATE UNIQUE INDEX IF NOT EXISTS uq_parents_email_lower
ON public.parents(lower(trim(email)))
WHERE nullif(trim(email), '') IS NOT NULL;

-- Remove redundant non-unique index covered by the unique lower(email) index.
DROP INDEX IF EXISTS public.idx_staff_email;

-- Academy settings is designed as a singleton with a fixed default id.
-- Enforce the singleton structurally without changing the existing row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_settings_singleton ON public.academy_settings ((true));
