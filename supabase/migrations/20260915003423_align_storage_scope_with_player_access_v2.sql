DROP POLICY IF EXISTS select_player_documents_bucket_staff_roles ON storage.objects;
CREATE POLICY select_player_documents_bucket_staff_roles
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'player-documents'
  AND (
    internal.has_role(ARRAY['manager','accountant','receptionist'])
    OR (
      internal.has_role(ARRAY['coach'])
      AND EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = (storage.foldername(storage.objects.name))[1]
          AND internal.is_coach_of_team(p.team_id)
      )
    )
    OR (
      internal.has_role(ARRAY['parent'])
      AND EXISTS (
        SELECT 1 FROM public.players p
        JOIN public.parents pa ON pa.id = p.parent_id
        WHERE p.id = (storage.foldername(storage.objects.name))[1]
          AND pa.user_id = (select auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS insert_player_documents_bucket_authorized ON storage.objects;
CREATE POLICY insert_player_documents_bucket_authorized
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'player-documents'
  AND (
    internal.has_role(ARRAY['manager','receptionist'])
    OR (
      internal.has_role(ARRAY['coach'])
      AND EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = (storage.foldername(storage.objects.name))[1]
          AND internal.is_coach_of_team(p.team_id)
      )
    )
    OR (
      internal.has_role(ARRAY['parent'])
      AND EXISTS (
        SELECT 1 FROM public.players p
        JOIN public.parents pa ON pa.id = p.parent_id
        WHERE p.id = (storage.foldername(storage.objects.name))[1]
          AND pa.user_id = (select auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS update_player_documents_bucket_authorized ON storage.objects;
CREATE POLICY update_player_documents_bucket_authorized
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'player-documents'
  AND (
    internal.has_role(ARRAY['manager','receptionist'])
    OR (
      internal.has_role(ARRAY['coach'])
      AND EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = (storage.foldername(storage.objects.name))[1]
          AND internal.is_coach_of_team(p.team_id)
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'player-documents'
  AND (
    internal.has_role(ARRAY['manager','receptionist'])
    OR (
      internal.has_role(ARRAY['coach'])
      AND EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = (storage.foldername(storage.objects.name))[1]
          AND internal.is_coach_of_team(p.team_id)
      )
    )
  )
);

DROP POLICY IF EXISTS delete_player_documents_bucket_authorized ON storage.objects;
CREATE POLICY delete_player_documents_bucket_authorized
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'player-documents'
  AND (
    internal.has_role(ARRAY['manager','receptionist'])
    OR (
      internal.has_role(ARRAY['coach'])
      AND EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = (storage.foldername(storage.objects.name))[1]
          AND internal.is_coach_of_team(p.team_id)
      )
    )
  )
);
