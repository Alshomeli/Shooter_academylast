/*
  # Move SECURITY DEFINER helper functions to internal schema

  1. Problem
     - Seven SECURITY DEFINER functions in the `public` schema are exposed via
       PostgREST at `/rest/v1/rpc/<name>`, allowing any authenticated user to
       call them directly. While the functions only return the caller's own
       data, exposing them is unnecessary and triggers security linter warnings.

  2. Solution
     - Create an `internal` schema that PostgREST does not expose.
     - Recreate all helper functions in `internal`.
     - Grant EXECUTE to `authenticated` (needed for RLS policy evaluation).
     - Recreate every RLS policy that references these functions to use
       the `internal.` qualified name.
     - Drop the old `public` schema functions.

  3. Affected functions
     - has_role, is_active_member, is_academy_member, is_academy_admin,
       current_user_role, get_staff_private, stamp_login_audit_log

  4. Affected policies
     - All RLS policies on public tables that call has_role() or is_active_member()
     - All storage.objects policies for the player-documents bucket
     - The trigger on login_audit_logs that calls stamp_login_audit_log()

  5. Important notes
     - No table or column changes.
     - No data changes.
     - The `internal` schema is not on PostgREST's exposed schemas list, so
       these functions become invisible to the REST API while still callable
       from RLS policies.
*/

-- ============================================================
-- 1. Create internal schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS internal;

-- ============================================================
-- 2. Recreate functions in internal schema
-- ============================================================

CREATE OR REPLACE FUNCTION internal.has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.staff
  WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
    AND staff.status = 'active'
    AND staff.role = ANY(allowed_roles)
);
$$;

CREATE OR REPLACE FUNCTION internal.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.staff
  WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
    AND staff.status = 'active'
);
$$;

CREATE OR REPLACE FUNCTION internal.is_academy_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.staff
  WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
    AND staff.status = 'active'
);
$$;

CREATE OR REPLACE FUNCTION internal.is_academy_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.staff
  WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
    AND staff.role = 'manager'
    AND staff.status = 'active'
);
$$;

CREATE OR REPLACE FUNCTION internal.current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT staff.role
FROM public.staff
WHERE lower(staff.email) = lower(auth.jwt() ->> 'email')
  AND staff.status = 'active'
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION internal.get_staff_private()
RETURNS TABLE(id text, salary numeric, national_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT s.id, s.salary::numeric, s.national_id
FROM public.staff s
WHERE internal.is_academy_admin();
$$;

CREATE OR REPLACE FUNCTION internal.stamp_login_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_email text := lower(auth.jwt() ->> 'email');
  caller_name text;
  caller_role text;
BEGIN
  SELECT s.name, s.role INTO caller_name, caller_role
  FROM public.staff s
  WHERE lower(s.email) = caller_email
  LIMIT 1;

  NEW.user_name := coalesce(caller_name, caller_email, 'unknown');
  NEW.user_role := coalesce(caller_role, 'unknown');
  NEW."timestamp" := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Grant EXECUTE to authenticated (needed for RLS evaluation)
-- ============================================================
GRANT USAGE ON SCHEMA internal TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.has_role(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_active_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_academy_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_academy_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.get_staff_private() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.stamp_login_audit_log() TO authenticated, service_role;

-- ============================================================
-- 4. Recreate all public-schema RLS policies with internal.* references
-- ============================================================

-- ── academy_settings ──
DROP POLICY IF EXISTS "delete_settings_manager" ON public.academy_settings;
CREATE POLICY "delete_settings_manager" ON public.academy_settings FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_settings_manager" ON public.academy_settings;
CREATE POLICY "insert_settings_manager" ON public.academy_settings FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "select_academy_settings_authenticated" ON public.academy_settings;
CREATE POLICY "select_academy_settings_authenticated" ON public.academy_settings FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_settings_manager" ON public.academy_settings;
CREATE POLICY "update_settings_manager" ON public.academy_settings FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager']))
  WITH CHECK (internal.has_role(ARRAY['manager']));

-- ── attendance ──
DROP POLICY IF EXISTS "delete_attendance_authorized" ON public.attendance;
CREATE POLICY "delete_attendance_authorized" ON public.attendance FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_attendance_authorized" ON public.attendance;
CREATE POLICY "insert_attendance_authorized" ON public.attendance FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','coach','receptionist']));

DROP POLICY IF EXISTS "select_attendance_authenticated" ON public.attendance;
CREATE POLICY "select_attendance_authenticated" ON public.attendance FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_attendance_authorized" ON public.attendance;
CREATE POLICY "update_attendance_authorized" ON public.attendance FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach']))
  WITH CHECK (internal.has_role(ARRAY['manager','coach']));

-- ── audit_logs ──
DROP POLICY IF EXISTS "delete_audit_logs_manager" ON public.audit_logs;
CREATE POLICY "delete_audit_logs_manager" ON public.audit_logs FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_audit_logs_active" ON public.audit_logs;
CREATE POLICY "insert_audit_logs_active" ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (internal.is_active_member());

DROP POLICY IF EXISTS "select_audit_logs_authenticated" ON public.audit_logs;
CREATE POLICY "select_audit_logs_authenticated" ON public.audit_logs FOR SELECT
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "update_audit_logs_manager" ON public.audit_logs;
CREATE POLICY "update_audit_logs_manager" ON public.audit_logs FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager']))
  WITH CHECK (internal.has_role(ARRAY['manager']));

-- ── login_audit_logs ──
DROP POLICY IF EXISTS "delete_login_audit_logs_manager" ON public.login_audit_logs;
CREATE POLICY "delete_login_audit_logs_manager" ON public.login_audit_logs FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "select_login_audit_logs_authenticated" ON public.login_audit_logs;
CREATE POLICY "select_login_audit_logs_authenticated" ON public.login_audit_logs FOR SELECT
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "update_login_audit_logs_manager" ON public.login_audit_logs;
CREATE POLICY "update_login_audit_logs_manager" ON public.login_audit_logs FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager']))
  WITH CHECK (internal.has_role(ARRAY['manager']));

-- (login_audit_logs INSERT policy uses auth.uid() IS NOT NULL, no function ref — leave as-is)

-- ── matches ──
DROP POLICY IF EXISTS "delete_matches_authorized" ON public.matches;
CREATE POLICY "delete_matches_authorized" ON public.matches FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_matches_authorized" ON public.matches;
CREATE POLICY "insert_matches_authorized" ON public.matches FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','coach']));

DROP POLICY IF EXISTS "select_matches_authenticated" ON public.matches;
CREATE POLICY "select_matches_authenticated" ON public.matches FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_matches_authorized" ON public.matches;
CREATE POLICY "update_matches_authorized" ON public.matches FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach']))
  WITH CHECK (internal.has_role(ARRAY['manager','coach']));

-- ── notifications ──
DROP POLICY IF EXISTS "insert_notifications_active" ON public.notifications;
CREATE POLICY "insert_notifications_active" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (internal.is_active_member());

DROP POLICY IF EXISTS "select_notifications_authenticated" ON public.notifications;
CREATE POLICY "select_notifications_authenticated" ON public.notifications FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_notifications_staff_roles" ON public.notifications;
CREATE POLICY "update_notifications_staff_roles" ON public.notifications FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach','receptionist','accountant']))
  WITH CHECK (internal.has_role(ARRAY['manager','coach','receptionist','accountant']));

DROP POLICY IF EXISTS "delete_notifications_staff_roles" ON public.notifications;
CREATE POLICY "delete_notifications_staff_roles" ON public.notifications FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach','receptionist','accountant']));

-- ── parents ──
DROP POLICY IF EXISTS "delete_parents_authorized" ON public.parents;
CREATE POLICY "delete_parents_authorized" ON public.parents FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_parents_authorized" ON public.parents;
CREATE POLICY "insert_parents_authorized" ON public.parents FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','receptionist']));

DROP POLICY IF EXISTS "select_parents_authenticated" ON public.parents;
CREATE POLICY "select_parents_authenticated" ON public.parents FOR SELECT
  TO authenticated USING (internal.has_role(ARRAY['manager','accountant','receptionist','coach']));

DROP POLICY IF EXISTS "update_parents_authorized" ON public.parents;
CREATE POLICY "update_parents_authorized" ON public.parents FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','receptionist']))
  WITH CHECK (internal.has_role(ARRAY['manager','receptionist']));

-- ── player_documents ──
DROP POLICY IF EXISTS "delete_player_documents_authorized" ON public.player_documents;
CREATE POLICY "delete_player_documents_authorized" ON public.player_documents FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach','receptionist']) AND file_path LIKE (player_id || '/%'));

DROP POLICY IF EXISTS "insert_player_documents_authorized" ON public.player_documents;
CREATE POLICY "insert_player_documents_authorized" ON public.player_documents FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','coach','receptionist']) AND file_path LIKE (player_id || '/%'));

DROP POLICY IF EXISTS "select_player_documents_staff_roles" ON public.player_documents;
CREATE POLICY "select_player_documents_staff_roles" ON public.player_documents FOR SELECT
  TO authenticated USING (internal.has_role(ARRAY['manager','coach','receptionist','accountant']));

DROP POLICY IF EXISTS "update_player_documents_authorized" ON public.player_documents;
CREATE POLICY "update_player_documents_authorized" ON public.player_documents FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach','receptionist']) AND file_path LIKE (player_id || '/%'))
  WITH CHECK (internal.has_role(ARRAY['manager','coach','receptionist']) AND file_path LIKE (player_id || '/%'));

-- ── players ──
DROP POLICY IF EXISTS "delete_players_authorized" ON public.players;
CREATE POLICY "delete_players_authorized" ON public.players FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_players_authorized" ON public.players;
CREATE POLICY "insert_players_authorized" ON public.players FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','coach','receptionist']));

DROP POLICY IF EXISTS "select_players_authenticated" ON public.players;
CREATE POLICY "select_players_authenticated" ON public.players FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_players_authorized" ON public.players;
CREATE POLICY "update_players_authorized" ON public.players FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach','receptionist']))
  WITH CHECK (internal.has_role(ARRAY['manager','coach','receptionist']));

-- ── staff ──
DROP POLICY IF EXISTS "delete_staff_manager" ON public.staff;
CREATE POLICY "delete_staff_manager" ON public.staff FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "select_staff_self_or_staff_roles" ON public.staff;
CREATE POLICY "select_staff_self_or_staff_roles" ON public.staff FOR SELECT
  TO authenticated USING (
    lower(email) = lower(auth.jwt() ->> 'email')
    OR id = (auth.uid())::text
    OR internal.has_role(ARRAY['manager','coach','receptionist','accountant'])
  );

DROP POLICY IF EXISTS "update_staff_manager" ON public.staff;
CREATE POLICY "update_staff_manager" ON public.staff FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager']))
  WITH CHECK (internal.has_role(ARRAY['manager']));

-- (staff INSERT policies: self_register_staff and insert_staff_manager use inline checks, not these functions — leave as-is)

-- ── subscriptions ──
DROP POLICY IF EXISTS "delete_subscriptions_authorized" ON public.subscriptions;
CREATE POLICY "delete_subscriptions_authorized" ON public.subscriptions FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_subscriptions_authorized" ON public.subscriptions;
CREATE POLICY "insert_subscriptions_authorized" ON public.subscriptions FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','accountant','receptionist']));

DROP POLICY IF EXISTS "select_subscriptions_authenticated" ON public.subscriptions;
CREATE POLICY "select_subscriptions_authenticated" ON public.subscriptions FOR SELECT
  TO authenticated USING (internal.has_role(ARRAY['manager','accountant','receptionist']));

DROP POLICY IF EXISTS "update_subscriptions_authorized" ON public.subscriptions;
CREATE POLICY "update_subscriptions_authorized" ON public.subscriptions FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','accountant']))
  WITH CHECK (internal.has_role(ARRAY['manager','accountant']));

-- ── teams ──
DROP POLICY IF EXISTS "delete_teams_authorized" ON public.teams;
CREATE POLICY "delete_teams_authorized" ON public.teams FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_teams_authorized" ON public.teams;
CREATE POLICY "insert_teams_authorized" ON public.teams FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','coach']));

DROP POLICY IF EXISTS "select_teams_authenticated" ON public.teams;
CREATE POLICY "select_teams_authenticated" ON public.teams FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_teams_authorized" ON public.teams;
CREATE POLICY "update_teams_authorized" ON public.teams FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach']))
  WITH CHECK (internal.has_role(ARRAY['manager','coach']));

-- ── tournaments ──
DROP POLICY IF EXISTS "delete_tournaments_authorized" ON public.tournaments;
CREATE POLICY "delete_tournaments_authorized" ON public.tournaments FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_tournaments_authorized" ON public.tournaments;
CREATE POLICY "insert_tournaments_authorized" ON public.tournaments FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','coach']));

DROP POLICY IF EXISTS "select_tournaments_authenticated" ON public.tournaments;
CREATE POLICY "select_tournaments_authenticated" ON public.tournaments FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_tournaments_authorized" ON public.tournaments;
CREATE POLICY "update_tournaments_authorized" ON public.tournaments FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach']))
  WITH CHECK (internal.has_role(ARRAY['manager','coach']));

-- ── trainings ──
DROP POLICY IF EXISTS "delete_trainings_authorized" ON public.trainings;
CREATE POLICY "delete_trainings_authorized" ON public.trainings FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_trainings_authorized" ON public.trainings;
CREATE POLICY "insert_trainings_authorized" ON public.trainings FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','coach']));

DROP POLICY IF EXISTS "select_trainings_authenticated" ON public.trainings;
CREATE POLICY "select_trainings_authenticated" ON public.trainings FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_trainings_authorized" ON public.trainings;
CREATE POLICY "update_trainings_authorized" ON public.trainings FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach']))
  WITH CHECK (internal.has_role(ARRAY['manager','coach']));

-- ── transactions ──
DROP POLICY IF EXISTS "delete_transactions_authorized" ON public.transactions;
CREATE POLICY "delete_transactions_authorized" ON public.transactions FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_transactions_authorized" ON public.transactions;
CREATE POLICY "insert_transactions_authorized" ON public.transactions FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','accountant']));

DROP POLICY IF EXISTS "select_transactions_authenticated" ON public.transactions;
CREATE POLICY "select_transactions_authenticated" ON public.transactions FOR SELECT
  TO authenticated USING (internal.has_role(ARRAY['manager','accountant']));

DROP POLICY IF EXISTS "update_transactions_authorized" ON public.transactions;
CREATE POLICY "update_transactions_authorized" ON public.transactions FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','accountant']))
  WITH CHECK (internal.has_role(ARRAY['manager','accountant']));

-- ── videos ──
DROP POLICY IF EXISTS "delete_videos_authorized" ON public.videos;
CREATE POLICY "delete_videos_authorized" ON public.videos FOR DELETE
  TO authenticated USING (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS "insert_videos_authorized" ON public.videos;
CREATE POLICY "insert_videos_authorized" ON public.videos FOR INSERT
  TO authenticated WITH CHECK (internal.has_role(ARRAY['manager','coach']));

DROP POLICY IF EXISTS "select_videos_authenticated" ON public.videos;
CREATE POLICY "select_videos_authenticated" ON public.videos FOR SELECT
  TO authenticated USING (internal.is_active_member());

DROP POLICY IF EXISTS "update_videos_authorized" ON public.videos;
CREATE POLICY "update_videos_authorized" ON public.videos FOR UPDATE
  TO authenticated USING (internal.has_role(ARRAY['manager','coach']))
  WITH CHECK (internal.has_role(ARRAY['manager','coach']));

-- ============================================================
-- 5. Recreate storage.objects policies with internal.* references
-- ============================================================

DROP POLICY IF EXISTS "insert_player_documents_bucket_authorized" ON storage.objects;
CREATE POLICY "insert_player_documents_bucket_authorized" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'player-documents' AND internal.has_role(ARRAY['manager','coach','receptionist']));

DROP POLICY IF EXISTS "select_player_documents_bucket_staff_roles" ON storage.objects;
CREATE POLICY "select_player_documents_bucket_staff_roles" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'player-documents' AND internal.has_role(ARRAY['manager','coach','receptionist','accountant']));

DROP POLICY IF EXISTS "update_player_documents_bucket_authorized" ON storage.objects;
CREATE POLICY "update_player_documents_bucket_authorized" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'player-documents' AND internal.has_role(ARRAY['manager','coach','receptionist']))
  WITH CHECK (bucket_id = 'player-documents' AND internal.has_role(ARRAY['manager','coach','receptionist']));

DROP POLICY IF EXISTS "delete_player_documents_bucket_authorized" ON storage.objects;
CREATE POLICY "delete_player_documents_bucket_authorized" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'player-documents' AND internal.has_role(ARRAY['manager','coach','receptionist']));

-- ============================================================
-- 6. Update the trigger to use internal.stamp_login_audit_log
-- ============================================================

DROP TRIGGER IF EXISTS trg_stamp_login_audit ON public.login_audit_logs;
CREATE TRIGGER trg_stamp_login_audit
  BEFORE INSERT ON public.login_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION internal.stamp_login_audit_log();

-- ============================================================
-- 7. Drop old public schema functions
-- ============================================================
DROP FUNCTION IF EXISTS public.stamp_login_audit_log() CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_private() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_academy_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_academy_member() CASCADE;
DROP FUNCTION IF EXISTS public.is_active_member() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(text[]) CASCADE;
