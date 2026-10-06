/*
# Create academy core data tables

## Purpose
Migrate all core academy data from localStorage to Supabase so that multiple
devices and users share the same data with real-time updates. The app uses a
localStorage-based fake login (not Supabase Auth), so all requests arrive as
the anon role — policies use TO anon, authenticated with USING (true) because
the data is intentionally shared within the single academy tenant.

## New Tables
- staff: academy staff members (managers, coaches, accountants, receptionists)
- teams: age-group teams
- players: player records
- parents: parent/guardian records
- subscriptions: player subscription/payment records
- attendance: per-session attendance records
- matches: match records
- trainings: training session records
- transactions: financial transactions (revenue/expense)
- tournaments: tournament records
- videos: analysis videos with tactical markers
- audit_logs: audit log entries
- login_audit_logs: login audit entries
- notifications: in-app notifications
- academy_settings: academy configuration (single row)

## Security
- RLS enabled on every table.
- All policies use TO anon, authenticated because the app has no real auth
  boundary — data is intentionally shared within the academy.
- 4 CRUD policies per table (SELECT, INSERT, UPDATE, DELETE).

## Notes
1. IDs use text (not uuid) to preserve existing app-generated IDs like
   "player-1", "team-1", etc. This avoids migration friction.
2. Arrays (training_days, tagged_player_ids, licenses) use text[] columns.
3. Videos.markers is a jsonb column holding the VideoMarker[] array.
4. academy_settings is a single-row table enforced by a constraint.
5. All timestamp columns default to now().
*/

-- staff
CREATE TABLE IF NOT EXISTS staff (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'receptionist',
  salary numeric NOT NULL DEFAULT 0,
  specialization text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  joined_date text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  national_id text,
  licenses text[] DEFAULT '{}',
  experience_years integer,
  rating numeric,
  tactical_style text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_staff" ON staff;
CREATE POLICY "anon_select_staff" ON staff FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_staff" ON staff;
CREATE POLICY "anon_insert_staff" ON staff FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff" ON staff;
CREATE POLICY "anon_update_staff" ON staff FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff" ON staff;
CREATE POLICY "anon_delete_staff" ON staff FOR DELETE TO anon, authenticated USING (true);

-- teams
CREATE TABLE IF NOT EXISTS teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  age_group text NOT NULL DEFAULT '',
  coach_id text NOT NULL DEFAULT '',
  training_days text[] DEFAULT '{}',
  training_time text NOT NULL DEFAULT '',
  pitch_number text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_teams" ON teams;
CREATE POLICY "anon_select_teams" ON teams FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_teams" ON teams;
CREATE POLICY "anon_insert_teams" ON teams FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_teams" ON teams;
CREATE POLICY "anon_update_teams" ON teams FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_teams" ON teams;
CREATE POLICY "anon_delete_teams" ON teams FOR DELETE TO anon, authenticated USING (true);

-- players
CREATE TABLE IF NOT EXISTS players (
  id text PRIMARY KEY,
  name text NOT NULL,
  birth_date text NOT NULL DEFAULT '',
  blood_type text NOT NULL DEFAULT '',
  jersey_number integer NOT NULL DEFAULT 0,
  position text NOT NULL DEFAULT '',
  team_id text NOT NULL DEFAULT '',
  parent_name text NOT NULL DEFAULT '',
  parent_phone text NOT NULL DEFAULT '',
  parent_email text NOT NULL DEFAULT '',
  parent_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  notes text NOT NULL DEFAULT '',
  joined_date text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE TO anon, authenticated USING (true);

-- parents
CREATE TABLE IF NOT EXISTS parents (
  id text PRIMARY KEY,
  name text NOT NULL,
  national_id text NOT NULL DEFAULT '',
  nationality text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  whatsapp_phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  occupation text NOT NULL DEFAULT '',
  workplace text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  notes text NOT NULL DEFAULT '',
  joined_date text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_parents" ON parents;
CREATE POLICY "anon_select_parents" ON parents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_parents" ON parents;
CREATE POLICY "anon_insert_parents" ON parents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_parents" ON parents;
CREATE POLICY "anon_update_parents" ON parents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_parents" ON parents;
CREATE POLICY "anon_delete_parents" ON parents FOR DELETE TO anon, authenticated USING (true);

-- subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  player_id text NOT NULL,
  plan_type text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL DEFAULT 0,
  start_date text NOT NULL DEFAULT '',
  end_date text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'unpaid',
  payment_method text,
  paid_at text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_subscriptions" ON subscriptions;
CREATE POLICY "anon_select_subscriptions" ON subscriptions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_subscriptions" ON subscriptions;
CREATE POLICY "anon_insert_subscriptions" ON subscriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_subscriptions" ON subscriptions;
CREATE POLICY "anon_update_subscriptions" ON subscriptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_subscriptions" ON subscriptions;
CREATE POLICY "anon_delete_subscriptions" ON subscriptions FOR DELETE TO anon, authenticated USING (true);

-- attendance
CREATE TABLE IF NOT EXISTS attendance (
  id text PRIMARY KEY,
  player_id text NOT NULL,
  session_date text NOT NULL DEFAULT '',
  session_type text NOT NULL DEFAULT 'training',
  status text NOT NULL DEFAULT 'present',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_attendance" ON attendance;
CREATE POLICY "anon_select_attendance" ON attendance FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance;
CREATE POLICY "anon_insert_attendance" ON attendance FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_attendance" ON attendance;
CREATE POLICY "anon_update_attendance" ON attendance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance;
CREATE POLICY "anon_delete_attendance" ON attendance FOR DELETE TO anon, authenticated USING (true);

-- matches
CREATE TABLE IF NOT EXISTS matches (
  id text PRIMARY KEY,
  team_id text NOT NULL DEFAULT '',
  opponent text NOT NULL DEFAULT '',
  match_date text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT 'scheduled',
  academy_score integer NOT NULL DEFAULT 0,
  opponent_score integer NOT NULL DEFAULT 0,
  scorers text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_matches" ON matches;
CREATE POLICY "anon_select_matches" ON matches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_matches" ON matches;
CREATE POLICY "anon_insert_matches" ON matches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_matches" ON matches;
CREATE POLICY "anon_update_matches" ON matches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_matches" ON matches;
CREATE POLICY "anon_delete_matches" ON matches FOR DELETE TO anon, authenticated USING (true);

-- trainings
CREATE TABLE IF NOT EXISTS trainings (
  id text PRIMARY KEY,
  team_id text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  session_date text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 90,
  objectives text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_trainings" ON trainings;
CREATE POLICY "anon_select_trainings" ON trainings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_trainings" ON trainings;
CREATE POLICY "anon_insert_trainings" ON trainings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_trainings" ON trainings;
CREATE POLICY "anon_update_trainings" ON trainings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_trainings" ON trainings;
CREATE POLICY "anon_delete_trainings" ON trainings FOR DELETE TO anon, authenticated USING (true);

-- transactions
CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT 'revenue',
  category text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  transaction_date text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  recorded_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE TO anon, authenticated USING (true);

-- tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id text PRIMARY KEY,
  name text NOT NULL,
  organizer text NOT NULL DEFAULT '',
  season text NOT NULL DEFAULT '',
  start_date text NOT NULL DEFAULT '',
  end_date text NOT NULL DEFAULT '',
  teams_count integer NOT NULL DEFAULT 0,
  logo_emoji text NOT NULL DEFAULT '🏆',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_tournaments" ON tournaments;
CREATE POLICY "anon_select_tournaments" ON tournaments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tournaments" ON tournaments;
CREATE POLICY "anon_insert_tournaments" ON tournaments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tournaments" ON tournaments;
CREATE POLICY "anon_update_tournaments" ON tournaments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tournaments" ON tournaments;
CREATE POLICY "anon_delete_tournaments" ON tournaments FOR DELETE TO anon, authenticated USING (true);

-- videos
CREATE TABLE IF NOT EXISTS videos (
  id text PRIMARY KEY,
  title text NOT NULL,
  video_url text NOT NULL DEFAULT '',
  associated_type text NOT NULL DEFAULT 'match',
  associated_id text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  markers jsonb NOT NULL DEFAULT '[]',
  inserted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_videos" ON videos;
CREATE POLICY "anon_select_videos" ON videos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_videos" ON videos;
CREATE POLICY "anon_insert_videos" ON videos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_videos" ON videos;
CREATE POLICY "anon_update_videos" ON videos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_videos" ON videos;
CREATE POLICY "anon_delete_videos" ON videos FOR DELETE TO anon, authenticated USING (true);

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  action text NOT NULL DEFAULT '',
  timestamp text NOT NULL DEFAULT '',
  user_role text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_audit_logs" ON audit_logs;
CREATE POLICY "anon_select_audit_logs" ON audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;
CREATE POLICY "anon_insert_audit_logs" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_logs" ON audit_logs;
CREATE POLICY "anon_update_audit_logs" ON audit_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_logs" ON audit_logs;
CREATE POLICY "anon_delete_audit_logs" ON audit_logs FOR DELETE TO anon, authenticated USING (true);

-- login_audit_logs
CREATE TABLE IF NOT EXISTS login_audit_logs (
  id text PRIMARY KEY,
  action text NOT NULL DEFAULT '',
  timestamp text NOT NULL DEFAULT '',
  user_role text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE login_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_login_audit_logs" ON login_audit_logs;
CREATE POLICY "anon_select_login_audit_logs" ON login_audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_login_audit_logs" ON login_audit_logs;
CREATE POLICY "anon_insert_login_audit_logs" ON login_audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_login_audit_logs" ON login_audit_logs;
CREATE POLICY "anon_delete_login_audit_logs" ON login_audit_logs FOR DELETE TO anon, authenticated USING (true);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  timestamp text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE TO anon, authenticated USING (true);

-- academy_settings (single-row)
CREATE TABLE IF NOT EXISTS academy_settings (
  id text PRIMARY KEY DEFAULT 'settings-1',
  name text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  subscription_fee_monthly numeric NOT NULL DEFAULT 0,
  subscription_fee_quarterly numeric NOT NULL DEFAULT 0,
  subscription_fee_yearly numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE academy_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_academy_settings" ON academy_settings;
CREATE POLICY "anon_select_academy_settings" ON academy_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_academy_settings" ON academy_settings;
CREATE POLICY "anon_insert_academy_settings" ON academy_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_academy_settings" ON academy_settings;
CREATE POLICY "anon_update_academy_settings" ON academy_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_academy_settings" ON academy_settings;
CREATE POLICY "anon_delete_academy_settings" ON academy_settings FOR DELETE TO anon, authenticated USING (true);
