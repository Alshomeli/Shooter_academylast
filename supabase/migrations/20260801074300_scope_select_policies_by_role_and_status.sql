/*
  # Scope read access by role and membership status

  1. Changes
    - Replace every `USING (true)` SELECT policy with a predicate that requires an
      active academy membership, and restricts financial, personal and audit data
      to the roles that need it.
    - Remove table-wide SELECT on staff and re-grant it per column so salary and
      national_id are not readable by ordinary members; expose them to managers
      through a SECURITY DEFINER function instead.
*/

-- Staff: own row or any active member; salary / national_id withheld at column level
DROP POLICY IF EXISTS select_staff_authenticated ON public.staff;
CREATE POLICY select_staff_authenticated ON public.staff FOR SELECT TO authenticated
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
    OR id = auth.uid()::text
    OR is_active_member()
  );

REVOKE SELECT ON public.staff FROM authenticated;
GRANT SELECT (id, name, email, phone, role, specialization, status, joined_date,
              avatar_url, licenses, experience_years, rating, tactical_style, notes,
              created_at)
  ON public.staff TO authenticated;

CREATE OR REPLACE FUNCTION public.get_staff_private()
RETURNS TABLE (id text, salary numeric, national_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.salary::numeric, s.national_id
  FROM public.staff s
  WHERE public.is_academy_admin();
$$;

REVOKE EXECUTE ON FUNCTION public.get_staff_private() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_staff_private() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_staff_private() TO authenticated;

-- Financial data
DROP POLICY IF EXISTS select_transactions_authenticated ON public.transactions;
CREATE POLICY select_transactions_authenticated ON public.transactions FOR SELECT TO authenticated
  USING (has_role(ARRAY['manager','accountant']));

DROP POLICY IF EXISTS select_subscriptions_authenticated ON public.subscriptions;
CREATE POLICY select_subscriptions_authenticated ON public.subscriptions FOR SELECT TO authenticated
  USING (has_role(ARRAY['manager','accountant','receptionist']));

-- Guardian personal data
DROP POLICY IF EXISTS select_parents_authenticated ON public.parents;
CREATE POLICY select_parents_authenticated ON public.parents FOR SELECT TO authenticated
  USING (has_role(ARRAY['manager','accountant','receptionist','coach']));

-- Audit trails: managers only
DROP POLICY IF EXISTS select_audit_logs_authenticated ON public.audit_logs;
CREATE POLICY select_audit_logs_authenticated ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(ARRAY['manager']));

DROP POLICY IF EXISTS select_login_audit_logs_authenticated ON public.login_audit_logs;
CREATE POLICY select_login_audit_logs_authenticated ON public.login_audit_logs FOR SELECT TO authenticated
  USING (has_role(ARRAY['manager']));

-- Operational data: active members only
DROP POLICY IF EXISTS select_players_authenticated ON public.players;
CREATE POLICY select_players_authenticated ON public.players FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_teams_authenticated ON public.teams;
CREATE POLICY select_teams_authenticated ON public.teams FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_attendance_authenticated ON public.attendance;
CREATE POLICY select_attendance_authenticated ON public.attendance FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_matches_authenticated ON public.matches;
CREATE POLICY select_matches_authenticated ON public.matches FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_trainings_authenticated ON public.trainings;
CREATE POLICY select_trainings_authenticated ON public.trainings FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_tournaments_authenticated ON public.tournaments;
CREATE POLICY select_tournaments_authenticated ON public.tournaments FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_videos_authenticated ON public.videos;
CREATE POLICY select_videos_authenticated ON public.videos FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_notifications_authenticated ON public.notifications;
CREATE POLICY select_notifications_authenticated ON public.notifications FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_academy_settings_authenticated ON public.academy_settings;
CREATE POLICY select_academy_settings_authenticated ON public.academy_settings FOR SELECT TO authenticated
  USING (is_active_member());

DROP POLICY IF EXISTS select_player_documents_authenticated ON public.player_documents;
CREATE POLICY select_player_documents_authenticated ON public.player_documents FOR SELECT TO authenticated
  USING (is_active_member());
