/*
# Tighten RLS: remove anonymous access + add RBAC helpers

## Purpose
1. Remove all `TO anon` access — every table currently allows anonymous
   reads (and the login screen relied on that). Now that the app uses
   Supabase Auth, all legitimate requests arrive authenticated.
2. Add reusable RBAC SQL helpers so policies and edge functions share
   one authorization source of truth.
3. Tighten player_documents SELECT to authenticated only.

## New helper functions
- current_user_role()  → text  (the staff.role of the caller, or null)
- is_academy_admin()   → bool  (caller is a signed-in staff member with role 'manager')

## Policy changes
- SELECT on every core table: drop `TO anon, authenticated USING (true)`,
  recreate as `TO authenticated USING (true)` (shared single-tenant data,
  but only visible to signed-in staff).
- player_documents SELECT: same tightening.
- Write policies unchanged (already require is_academy_member()).
*/

-- ============ RBAC helpers ============

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT staff.role
  FROM public.staff
  WHERE staff.email = (auth.jwt() ->> 'email')
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_academy_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.email = (auth.jwt() ->> 'email')
      AND staff.role = 'manager'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_academy_admin() TO authenticated;

-- ============ Tighten SELECT policies: remove anon ============

-- Helper to recreate a SELECT policy as authenticated-only
-- staff
DROP POLICY IF EXISTS "anon_select_staff" ON staff;
CREATE POLICY "select_staff_authenticated" ON staff
  FOR SELECT TO authenticated USING (true);

-- teams
DROP POLICY IF EXISTS "anon_select_teams" ON teams;
CREATE POLICY "select_teams_authenticated" ON teams
  FOR SELECT TO authenticated USING (true);

-- players
DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "select_players_authenticated" ON players
  FOR SELECT TO authenticated USING (true);

-- parents
DROP POLICY IF EXISTS "anon_select_parents" ON parents;
CREATE POLICY "select_parents_authenticated" ON parents
  FOR SELECT TO authenticated USING (true);

-- subscriptions
DROP POLICY IF EXISTS "anon_select_subscriptions" ON subscriptions;
CREATE POLICY "select_subscriptions_authenticated" ON subscriptions
  FOR SELECT TO authenticated USING (true);

-- attendance
DROP POLICY IF EXISTS "anon_select_attendance" ON attendance;
CREATE POLICY "select_attendance_authenticated" ON attendance
  FOR SELECT TO authenticated USING (true);

-- matches
DROP POLICY IF EXISTS "anon_select_matches" ON matches;
CREATE POLICY "select_matches_authenticated" ON matches
  FOR SELECT TO authenticated USING (true);

-- trainings
DROP POLICY IF EXISTS "anon_select_trainings" ON trainings;
CREATE POLICY "select_trainings_authenticated" ON trainings
  FOR SELECT TO authenticated USING (true);

-- transactions
DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "select_transactions_authenticated" ON transactions
  FOR SELECT TO authenticated USING (true);

-- tournaments
DROP POLICY IF EXISTS "anon_select_tournaments" ON tournaments;
CREATE POLICY "select_tournaments_authenticated" ON tournaments
  FOR SELECT TO authenticated USING (true);

-- videos
DROP POLICY IF EXISTS "anon_select_videos" ON videos;
CREATE POLICY "select_videos_authenticated" ON videos
  FOR SELECT TO authenticated USING (true);

-- audit_logs
DROP POLICY IF EXISTS "anon_select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs_authenticated" ON audit_logs
  FOR SELECT TO authenticated USING (true);

-- login_audit_logs
DROP POLICY IF EXISTS "anon_select_login_audit_logs" ON login_audit_logs;
CREATE POLICY "select_login_audit_logs_authenticated" ON login_audit_logs
  FOR SELECT TO authenticated USING (true);

-- notifications
DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "select_notifications_authenticated" ON notifications
  FOR SELECT TO authenticated USING (true);

-- academy_settings
DROP POLICY IF EXISTS "anon_select_academy_settings" ON academy_settings;
CREATE POLICY "select_academy_settings_authenticated" ON academy_settings
  FOR SELECT TO authenticated USING (true);

-- player_documents
DROP POLICY IF EXISTS "anon_select_player_documents" ON player_documents;
CREATE POLICY "select_player_documents_authenticated" ON player_documents
  FOR SELECT TO authenticated USING (true);

-- ============ Tighten storage SELECT: remove anon ============
DROP POLICY IF EXISTS "anon_read_player_documents_bucket" ON storage.objects;
CREATE POLICY "read_player_documents_bucket_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'player-documents');

-- Tighten storage INSERT: require authenticated (was anon, authenticated)
DROP POLICY IF EXISTS "anon_insert_player_documents_bucket" ON storage.objects;
CREATE POLICY "insert_player_documents_bucket_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'player-documents' AND name LIKE 'player-%/%');
