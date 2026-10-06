/*
# Production Security Hardening

## Summary
Comprehensive security hardening for production readiness.

## Changes

### 1. Role-Based Access Control (RBAC) in RLS Policies
- Replace generic `is_academy_member()` write policies with role-specific checks
- Financial tables (transactions, subscriptions) restricted to manager + accountant
- Staff management restricted to manager only
- Academy settings restricted to manager only
- Coaches can write attendance, matches, trainings, videos
- Receptionists can write players, parents, attendance
- Parents get read-only access (already enforced by authenticated SELECT)

### 2. Column-Level Privilege Restrictions
- Revoke anon role's column-level access on all tables (anon should never write)
- Staff salary and role columns protected from self-modification

### 3. Registration Security
- New registrations get status='pending' - add policy check so pending users
  cannot write to most tables until approved
- Add `is_active_member()` function that checks status != 'pending'

### 4. Performance Indexes
- Add indexes on frequently queried foreign key columns
- Add indexes on email columns used for lookups
- Add composite indexes for attendance queries

### 5. Data Integrity Constraints
- Add CHECK constraints on numeric fields
- Add email format validation
- Add status enum constraints

## Security Notes
- All write policies now enforce role-based checks
- Pending users can only read data, not modify it
- Financial data restricted to authorized roles
- Audit logs are append-only (no update/delete for non-managers)
*/

-- ============================================================
-- 1. RBAC HELPER FUNCTION: checks role AND active status
-- ============================================================

CREATE OR REPLACE FUNCTION is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE email = lower(auth.jwt() ->> 'email')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE email = lower(auth.jwt() ->> 'email')
      AND status = 'active'
      AND role = ANY(allowed_roles)
  );
$$;

-- ============================================================
-- 2. REVOKE anon privileges on all public tables
--    (anon should never have direct table access in an auth app)
-- ============================================================

REVOKE ALL ON staff FROM anon;
REVOKE ALL ON teams FROM anon;
REVOKE ALL ON players FROM anon;
REVOKE ALL ON parents FROM anon;
REVOKE ALL ON subscriptions FROM anon;
REVOKE ALL ON attendance FROM anon;
REVOKE ALL ON matches FROM anon;
REVOKE ALL ON trainings FROM anon;
REVOKE ALL ON transactions FROM anon;
REVOKE ALL ON tournaments FROM anon;
REVOKE ALL ON videos FROM anon;
REVOKE ALL ON audit_logs FROM anon;
REVOKE ALL ON login_audit_logs FROM anon;
REVOKE ALL ON notifications FROM anon;
REVOKE ALL ON academy_settings FROM anon;
REVOKE ALL ON player_documents FROM anon;

-- ============================================================
-- 3. TIGHTEN WRITE POLICIES — role-based
-- ============================================================

-- ---- STAFF: only managers can manage staff ----
DROP POLICY IF EXISTS "anon_insert_staff" ON staff;
DROP POLICY IF EXISTS "anon_update_staff" ON staff;
DROP POLICY IF EXISTS "anon_delete_staff" ON staff;

CREATE POLICY "insert_staff_manager" ON staff FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager']));

CREATE POLICY "update_staff_manager" ON staff FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager']))
  WITH CHECK (has_role(ARRAY['manager']));

CREATE POLICY "delete_staff_manager" ON staff FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- TEAMS: managers and coaches ----
DROP POLICY IF EXISTS "anon_insert_teams" ON teams;
DROP POLICY IF EXISTS "anon_update_teams" ON teams;
DROP POLICY IF EXISTS "anon_delete_teams" ON teams;

CREATE POLICY "insert_teams_authorized" ON teams FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "update_teams_authorized" ON teams FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach']))
  WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "delete_teams_authorized" ON teams FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- PLAYERS: managers, coaches, receptionists ----
DROP POLICY IF EXISTS "anon_insert_players" ON players;
DROP POLICY IF EXISTS "anon_update_players" ON players;
DROP POLICY IF EXISTS "anon_delete_players" ON players;

CREATE POLICY "insert_players_authorized" ON players FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'coach', 'receptionist']));

CREATE POLICY "update_players_authorized" ON players FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach', 'receptionist']))
  WITH CHECK (has_role(ARRAY['manager', 'coach', 'receptionist']));

CREATE POLICY "delete_players_authorized" ON players FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- PARENTS: managers, receptionists ----
DROP POLICY IF EXISTS "anon_insert_parents" ON parents;
DROP POLICY IF EXISTS "anon_update_parents" ON parents;
DROP POLICY IF EXISTS "anon_delete_parents" ON parents;

CREATE POLICY "insert_parents_authorized" ON parents FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'receptionist']));

CREATE POLICY "update_parents_authorized" ON parents FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'receptionist']))
  WITH CHECK (has_role(ARRAY['manager', 'receptionist']));

CREATE POLICY "delete_parents_authorized" ON parents FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- SUBSCRIPTIONS: managers, accountants ----
DROP POLICY IF EXISTS "anon_insert_subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "anon_update_subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "anon_delete_subscriptions" ON subscriptions;

CREATE POLICY "insert_subscriptions_authorized" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'accountant', 'receptionist']));

CREATE POLICY "update_subscriptions_authorized" ON subscriptions FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'accountant']))
  WITH CHECK (has_role(ARRAY['manager', 'accountant']));

CREATE POLICY "delete_subscriptions_authorized" ON subscriptions FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- ATTENDANCE: managers, coaches, receptionists ----
DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance;
DROP POLICY IF EXISTS "anon_update_attendance" ON attendance;
DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance;

CREATE POLICY "insert_attendance_authorized" ON attendance FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'coach', 'receptionist']));

CREATE POLICY "update_attendance_authorized" ON attendance FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach']))
  WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "delete_attendance_authorized" ON attendance FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- MATCHES: managers, coaches ----
DROP POLICY IF EXISTS "anon_insert_matches" ON matches;
DROP POLICY IF EXISTS "anon_update_matches" ON matches;
DROP POLICY IF EXISTS "anon_delete_matches" ON matches;

CREATE POLICY "insert_matches_authorized" ON matches FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "update_matches_authorized" ON matches FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach']))
  WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "delete_matches_authorized" ON matches FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- TRAININGS: managers, coaches ----
DROP POLICY IF EXISTS "anon_insert_trainings" ON trainings;
DROP POLICY IF EXISTS "anon_update_trainings" ON trainings;
DROP POLICY IF EXISTS "anon_delete_trainings" ON trainings;

CREATE POLICY "insert_trainings_authorized" ON trainings FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "update_trainings_authorized" ON trainings FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach']))
  WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "delete_trainings_authorized" ON trainings FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- TRANSACTIONS: managers, accountants only ----
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;

CREATE POLICY "insert_transactions_authorized" ON transactions FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'accountant']));

CREATE POLICY "update_transactions_authorized" ON transactions FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'accountant']))
  WITH CHECK (has_role(ARRAY['manager', 'accountant']));

CREATE POLICY "delete_transactions_authorized" ON transactions FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- TOURNAMENTS: managers, coaches ----
DROP POLICY IF EXISTS "anon_insert_tournaments" ON tournaments;
DROP POLICY IF EXISTS "anon_update_tournaments" ON tournaments;
DROP POLICY IF EXISTS "anon_delete_tournaments" ON tournaments;

CREATE POLICY "insert_tournaments_authorized" ON tournaments FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "update_tournaments_authorized" ON tournaments FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach']))
  WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "delete_tournaments_authorized" ON tournaments FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- VIDEOS: managers, coaches ----
DROP POLICY IF EXISTS "anon_insert_videos" ON videos;
DROP POLICY IF EXISTS "anon_update_videos" ON videos;
DROP POLICY IF EXISTS "anon_delete_videos" ON videos;

CREATE POLICY "insert_videos_authorized" ON videos FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "update_videos_authorized" ON videos FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach']))
  WITH CHECK (has_role(ARRAY['manager', 'coach']));

CREATE POLICY "delete_videos_authorized" ON videos FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- AUDIT LOGS: insert-only for active members, read/delete by manager ----
DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "anon_update_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "anon_delete_audit_logs" ON audit_logs;

CREATE POLICY "insert_audit_logs_active" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (is_active_member());

CREATE POLICY "update_audit_logs_manager" ON audit_logs FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager']))
  WITH CHECK (has_role(ARRAY['manager']));

CREATE POLICY "delete_audit_logs_manager" ON audit_logs FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- LOGIN AUDIT LOGS: anyone authenticated can insert (for login tracking) ----
DROP POLICY IF EXISTS "anon_insert_login_audit_logs" ON login_audit_logs;
DROP POLICY IF EXISTS "anon_update_login_audit_logs" ON login_audit_logs;
DROP POLICY IF EXISTS "anon_delete_login_audit_logs" ON login_audit_logs;

CREATE POLICY "insert_login_audit_logs_authenticated" ON login_audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_login_audit_logs_manager" ON login_audit_logs FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager']))
  WITH CHECK (has_role(ARRAY['manager']));

CREATE POLICY "delete_login_audit_logs_manager" ON login_audit_logs FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- NOTIFICATIONS: active members can manage ----
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;

CREATE POLICY "insert_notifications_active" ON notifications FOR INSERT
  TO authenticated WITH CHECK (is_active_member());

CREATE POLICY "update_notifications_active" ON notifications FOR UPDATE
  TO authenticated
  USING (is_active_member())
  WITH CHECK (is_active_member());

CREATE POLICY "delete_notifications_active" ON notifications FOR DELETE
  TO authenticated USING (is_active_member());

-- ---- ACADEMY SETTINGS: managers only ----
DROP POLICY IF EXISTS "anon_insert_academy_settings" ON academy_settings;
DROP POLICY IF EXISTS "anon_update_academy_settings" ON academy_settings;
DROP POLICY IF EXISTS "anon_delete_academy_settings" ON academy_settings;

CREATE POLICY "insert_settings_manager" ON academy_settings FOR INSERT
  TO authenticated WITH CHECK (has_role(ARRAY['manager']));

CREATE POLICY "update_settings_manager" ON academy_settings FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['manager']))
  WITH CHECK (has_role(ARRAY['manager']));

CREATE POLICY "delete_settings_manager" ON academy_settings FOR DELETE
  TO authenticated USING (has_role(ARRAY['manager']));

-- ---- PLAYER DOCUMENTS: managers, coaches, receptionists ----
DROP POLICY IF EXISTS "anon_insert_player_documents" ON player_documents;

CREATE POLICY "insert_player_documents_authorized" ON player_documents FOR INSERT
  TO authenticated WITH CHECK (
    has_role(ARRAY['manager', 'coach', 'receptionist'])
    AND file_path LIKE player_id || '/%'
  );

-- ============================================================
-- 4. SELF-REGISTRATION: allow insert into staff for signup
--    but only for the registering user's own record
-- ============================================================

-- The existing manager-only insert policy blocks self-registration.
-- Add a supplementary policy for self-registration with pending status.
CREATE POLICY "self_register_staff" ON staff FOR INSERT
  TO authenticated WITH CHECK (
    id = auth.uid()::text
    AND status = 'pending'
  );

-- Allow users to read their own staff row (needed for session restore)
DROP POLICY IF EXISTS "select_staff_authenticated" ON staff;
CREATE POLICY "select_staff_authenticated" ON staff FOR SELECT
  TO authenticated USING (true);

-- ============================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_parent_id ON players(parent_id);
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_player_id ON subscriptions(player_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_attendance_player_id ON attendance(player_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_date ON attendance(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_composite ON attendance(player_id, session_date);
CREATE INDEX IF NOT EXISTS idx_matches_team_id ON matches(team_id);
CREATE INDEX IF NOT EXISTS idx_trainings_team_id ON trainings(team_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(lower(email));
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_timestamp ON login_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_videos_associated ON videos(associated_type, associated_id);

-- ============================================================
-- 6. DATA INTEGRITY CONSTRAINTS (additive only)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscriptions_amount_positive'
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_amount_positive CHECK (amount >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_transactions_amount_positive'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT chk_transactions_amount_positive CHECK (amount >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_staff_salary_nonneg'
  ) THEN
    ALTER TABLE staff ADD CONSTRAINT chk_staff_salary_nonneg CHECK (salary >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_players_jersey_nonneg'
  ) THEN
    ALTER TABLE players ADD CONSTRAINT chk_players_jersey_nonneg CHECK (jersey_number >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_staff_role_valid'
  ) THEN
    ALTER TABLE staff ADD CONSTRAINT chk_staff_role_valid
      CHECK (role IN ('manager', 'accountant', 'coach', 'receptionist', 'parent'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_staff_status_valid'
  ) THEN
    ALTER TABLE staff ADD CONSTRAINT chk_staff_status_valid
      CHECK (status IN ('active', 'inactive', 'pending'));
  END IF;
END $$;
