/*
# Tighten RLS policies: require academy membership for writes

## Purpose
The previous policies allowed the `anon` role (anyone with the public API key)
to INSERT / UPDATE / DELETE rows on every table. The security scanner flagged
all of these as "RLS Policy Always True". This migration replaces those
open write policies with membership-scoped policies backed by a SQL function
that checks the `staff` table for the authenticated user's email.

## Changes

### 1. New SQL function: `is_academy_member()`
- Returns true when the calling user is signed-in (`auth.uid() IS NOT NULL`)
  AND their email appears in the `staff` table.
- This is the single gate used by every write policy.

### 2. Write policies tightened on ALL core tables
Tables affected: staff, teams, players, parents, subscriptions, attendance,
matches, trainings, transactions, tournaments, videos, notifications,
academy_settings, audit_logs, login_audit_logs.

For each table, the INSERT / UPDATE / DELETE policies are dropped and
recreated with the membership check:
- INSERT: `WITH CHECK (is_academy_member())`
- UPDATE: `USING (is_academy_member()) WITH CHECK (is_academy_member())`
- DELETE: `USING (is_academy_member())`

### 3. SELECT policies unchanged
SELECT remains `TO anon, authenticated USING (true)` on every table. The
app's data is intentionally shared within the single academy tenant, and the
login screen reads the staff list (via anon key) to authenticate against it.
Tightening SELECT to authenticated-only would break the login flow because
the anon-key client could not read the staff table to verify credentials.

## Security notes
1. `is_academy_member()` uses `auth.uid()` (never `current_user`).
2. Only signed-in users whose email exists in `staff` can modify data.
3. Anonymous reads are still allowed (intentional, single-tenant shared data).
4. No data is lost — only policies are dropped/recreated.
*/

-- Helper function: is the current user a signed-in academy staff member?
CREATE OR REPLACE FUNCTION public.is_academy_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
$$;

-- Grant execute to anon + authenticated so RLS policies can call it
GRANT EXECUTE ON FUNCTION public.is_academy_member() TO anon, authenticated;

-- Helper to avoid repeating the 3-policy block per table.
-- We do it inline so the migration is self-contained and idempotent.

-- ============ staff ============
DROP POLICY IF EXISTS "anon_insert_staff" ON staff;
CREATE POLICY "anon_insert_staff" ON staff FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_staff" ON staff;
CREATE POLICY "anon_update_staff" ON staff FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_staff" ON staff;
CREATE POLICY "anon_delete_staff" ON staff FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ teams ============
DROP POLICY IF EXISTS "anon_insert_teams" ON teams;
CREATE POLICY "anon_insert_teams" ON teams FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_teams" ON teams;
CREATE POLICY "anon_update_teams" ON teams FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_teams" ON teams;
CREATE POLICY "anon_delete_teams" ON teams FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ players ============
DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ parents ============
DROP POLICY IF EXISTS "anon_insert_parents" ON parents;
CREATE POLICY "anon_insert_parents" ON parents FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_parents" ON parents;
CREATE POLICY "anon_update_parents" ON parents FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_parents" ON parents;
CREATE POLICY "anon_delete_parents" ON parents FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ subscriptions ============
DROP POLICY IF EXISTS "anon_insert_subscriptions" ON subscriptions;
CREATE POLICY "anon_insert_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_subscriptions" ON subscriptions;
CREATE POLICY "anon_update_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_subscriptions" ON subscriptions;
CREATE POLICY "anon_delete_subscriptions" ON subscriptions FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ attendance ============
DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance;
CREATE POLICY "anon_insert_attendance" ON attendance FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_attendance" ON attendance;
CREATE POLICY "anon_update_attendance" ON attendance FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance;
CREATE POLICY "anon_delete_attendance" ON attendance FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ matches ============
DROP POLICY IF EXISTS "anon_insert_matches" ON matches;
CREATE POLICY "anon_insert_matches" ON matches FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_matches" ON matches;
CREATE POLICY "anon_update_matches" ON matches FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_matches" ON matches;
CREATE POLICY "anon_delete_matches" ON matches FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ trainings ============
DROP POLICY IF EXISTS "anon_insert_trainings" ON trainings;
CREATE POLICY "anon_insert_trainings" ON trainings FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_trainings" ON trainings;
CREATE POLICY "anon_update_trainings" ON trainings FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_trainings" ON trainings;
CREATE POLICY "anon_delete_trainings" ON trainings FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ transactions ============
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ tournaments ============
DROP POLICY IF EXISTS "anon_insert_tournaments" ON tournaments;
CREATE POLICY "anon_insert_tournaments" ON tournaments FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_tournaments" ON tournaments;
CREATE POLICY "anon_update_tournaments" ON tournaments FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_tournaments" ON tournaments;
CREATE POLICY "anon_delete_tournaments" ON tournaments FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ videos ============
DROP POLICY IF EXISTS "anon_insert_videos" ON videos;
CREATE POLICY "anon_insert_videos" ON videos FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_videos" ON videos;
CREATE POLICY "anon_update_videos" ON videos FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_videos" ON videos;
CREATE POLICY "anon_delete_videos" ON videos FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ notifications ============
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ academy_settings ============
DROP POLICY IF EXISTS "anon_insert_academy_settings" ON academy_settings;
CREATE POLICY "anon_insert_academy_settings" ON academy_settings FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_academy_settings" ON academy_settings;
CREATE POLICY "anon_update_academy_settings" ON academy_settings FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_academy_settings" ON academy_settings;
CREATE POLICY "anon_delete_academy_settings" ON academy_settings FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ audit_logs ============
DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;
CREATE POLICY "anon_insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_update_audit_logs" ON audit_logs;
CREATE POLICY "anon_update_audit_logs" ON audit_logs FOR UPDATE
  TO authenticated USING (is_academy_member()) WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_audit_logs" ON audit_logs;
CREATE POLICY "anon_delete_audit_logs" ON audit_logs FOR DELETE
  TO authenticated USING (is_academy_member());

-- ============ login_audit_logs ============
DROP POLICY IF EXISTS "anon_insert_login_audit_logs" ON login_audit_logs;
CREATE POLICY "anon_insert_login_audit_logs" ON login_audit_logs FOR INSERT
  TO authenticated WITH CHECK (is_academy_member());
DROP POLICY IF EXISTS "anon_delete_login_audit_logs" ON login_audit_logs;
CREATE POLICY "anon_delete_login_audit_logs" ON login_audit_logs FOR DELETE
  TO authenticated USING (is_academy_member());
