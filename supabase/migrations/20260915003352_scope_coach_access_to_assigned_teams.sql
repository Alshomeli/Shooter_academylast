CREATE OR REPLACE FUNCTION internal.is_coach_of_team(p_team_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','internal'
AS $$
BEGIN
  IF p_team_id IS NULL OR NULLIF(trim(p_team_id),'') IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.staff s ON s.id = t.coach_id
    WHERE t.id = p_team_id
      AND s.role = 'coach'
      AND s.status = 'active'
      AND (
        s.user_id = (select auth.uid())
        OR (s.user_id IS NULL AND lower(s.email) = lower((select auth.jwt() ->> 'email')))
      )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION internal.is_coach_of_team(text) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS select_players_authenticated ON public.players;
CREATE POLICY select_players_authenticated
ON public.players FOR SELECT TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','receptionist'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
  OR (
    internal.has_role(ARRAY['parent'])
    AND EXISTS (
      SELECT 1 FROM public.parents pa
      WHERE pa.id = players.parent_id
        AND pa.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS update_players_authorized ON public.players;
CREATE POLICY update_players_authorized
ON public.players FOR UPDATE TO authenticated
USING (
  internal.has_role(ARRAY['manager','receptionist'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
)
WITH CHECK (
  internal.has_role(ARRAY['manager','receptionist'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
);

DROP POLICY IF EXISTS select_attendance_authenticated ON public.attendance;
CREATE POLICY select_attendance_authenticated
ON public.attendance FOR SELECT TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','receptionist'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = attendance.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
  OR (
    internal.has_role(ARRAY['parent'])
    AND EXISTS (
      SELECT 1
      FROM public.players p
      JOIN public.parents pa ON pa.id = p.parent_id
      WHERE p.id = attendance.player_id
        AND pa.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS insert_attendance_authorized ON public.attendance;
CREATE POLICY insert_attendance_authorized
ON public.attendance FOR INSERT TO authenticated
WITH CHECK (
  internal.has_role(ARRAY['manager','receptionist'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = attendance.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
);

DROP POLICY IF EXISTS update_attendance_authorized ON public.attendance;
CREATE POLICY update_attendance_authorized
ON public.attendance FOR UPDATE TO authenticated
USING (
  internal.has_role(ARRAY['manager'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = attendance.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
)
WITH CHECK (
  internal.has_role(ARRAY['manager'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = attendance.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
);

DROP POLICY IF EXISTS select_trainings_authenticated ON public.trainings;
CREATE POLICY select_trainings_authenticated
ON public.trainings FOR SELECT TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','receptionist'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
  OR (
    internal.has_role(ARRAY['parent'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.parents pa ON pa.id = p.parent_id
      WHERE p.team_id = trainings.team_id
        AND pa.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS insert_trainings_authorized ON public.trainings;
CREATE POLICY insert_trainings_authorized
ON public.trainings FOR INSERT TO authenticated
WITH CHECK (
  internal.has_role(ARRAY['manager'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
);

DROP POLICY IF EXISTS update_trainings_authorized ON public.trainings;
CREATE POLICY update_trainings_authorized
ON public.trainings FOR UPDATE TO authenticated
USING (
  internal.has_role(ARRAY['manager'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
)
WITH CHECK (
  internal.has_role(ARRAY['manager'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
);

DROP POLICY IF EXISTS select_matches_authenticated ON public.matches;
CREATE POLICY select_matches_authenticated
ON public.matches FOR SELECT TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','receptionist'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
  OR (
    internal.has_role(ARRAY['parent'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.parents pa ON pa.id = p.parent_id
      WHERE p.team_id = matches.team_id
        AND pa.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS insert_matches_authorized ON public.matches;
CREATE POLICY insert_matches_authorized
ON public.matches FOR INSERT TO authenticated
WITH CHECK (
  internal.has_role(ARRAY['manager'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
);

DROP POLICY IF EXISTS update_matches_authorized ON public.matches;
CREATE POLICY update_matches_authorized
ON public.matches FOR UPDATE TO authenticated
USING (
  internal.has_role(ARRAY['manager'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
)
WITH CHECK (
  internal.has_role(ARRAY['manager'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(team_id))
);

DROP POLICY IF EXISTS update_teams_authorized ON public.teams;
CREATE POLICY update_teams_authorized
ON public.teams FOR UPDATE TO authenticated
USING (
  internal.has_role(ARRAY['manager'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(id))
)
WITH CHECK (
  internal.has_role(ARRAY['manager'])
  OR (internal.has_role(ARRAY['coach']) AND internal.is_coach_of_team(id))
);

DROP POLICY IF EXISTS insert_teams_authorized ON public.teams;
CREATE POLICY insert_teams_authorized
ON public.teams FOR INSERT TO authenticated
WITH CHECK (internal.has_role(ARRAY['manager']));

DROP POLICY IF EXISTS select_player_documents_staff_roles ON public.player_documents;
CREATE POLICY select_player_documents_staff_roles
ON public.player_documents FOR SELECT TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','receptionist'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_documents.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
  OR (
    internal.has_role(ARRAY['parent'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.parents pa ON pa.id = p.parent_id
      WHERE p.id = player_documents.player_id
        AND pa.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS insert_player_documents_authorized ON public.player_documents;
CREATE POLICY insert_player_documents_authorized
ON public.player_documents FOR INSERT TO authenticated
WITH CHECK (
  internal.has_role(ARRAY['manager','receptionist'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_documents.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
  OR (
    internal.has_role(ARRAY['parent'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.parents pa ON pa.id = p.parent_id
      WHERE p.id = player_documents.player_id
        AND pa.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS update_player_documents_authorized ON public.player_documents;
CREATE POLICY update_player_documents_authorized
ON public.player_documents FOR UPDATE TO authenticated
USING (
  internal.has_role(ARRAY['manager','receptionist'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_documents.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
)
WITH CHECK (
  internal.has_role(ARRAY['manager','receptionist'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_documents.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
);

DROP POLICY IF EXISTS delete_player_documents_authorized ON public.player_documents;
CREATE POLICY delete_player_documents_authorized
ON public.player_documents FOR DELETE TO authenticated
USING (
  internal.has_role(ARRAY['manager','receptionist'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_documents.player_id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
);

DROP POLICY IF EXISTS select_parents_authenticated ON public.parents;
CREATE POLICY select_parents_authenticated
ON public.parents FOR SELECT TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','receptionist'])
  OR (
    internal.has_role(ARRAY['coach'])
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.parent_id = parents.id
        AND internal.is_coach_of_team(p.team_id)
    )
  )
  OR (internal.has_role(ARRAY['parent']) AND parents.user_id = (select auth.uid()))
);
