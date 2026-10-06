/*
  # Private document storage

  1. Changes
    - Make the player-documents bucket private and enforce a 5 MB size limit and an
      image/PDF allow list at the storage layer.
    - Replace the role-less upload policy with a role-gated one and add read,
      update and delete policies so objects are reachable only by academy staff.
*/

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf']
WHERE id = 'player-documents';

DROP POLICY IF EXISTS insert_player_documents_bucket_authenticated ON storage.objects;
CREATE POLICY insert_player_documents_bucket_authorized ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-documents' AND has_role(ARRAY['manager','coach','receptionist']));

DROP POLICY IF EXISTS select_player_documents_bucket_authorized ON storage.objects;
CREATE POLICY select_player_documents_bucket_authorized ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-documents' AND is_active_member());

DROP POLICY IF EXISTS update_player_documents_bucket_authorized ON storage.objects;
CREATE POLICY update_player_documents_bucket_authorized ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-documents' AND has_role(ARRAY['manager','coach','receptionist']))
  WITH CHECK (bucket_id = 'player-documents' AND has_role(ARRAY['manager','coach','receptionist']));

DROP POLICY IF EXISTS delete_player_documents_bucket_authorized ON storage.objects;
CREATE POLICY delete_player_documents_bucket_authorized ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'player-documents' AND has_role(ARRAY['manager','coach','receptionist']));
