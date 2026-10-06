/*
# Tighten player_documents write policies: remove anon access

The original migration left INSERT and DELETE on player_documents
open to `TO anon, authenticated`. Now that the app uses Supabase Auth,
all legitimate requests arrive authenticated. Tighten both to
authenticated-only, keeping the path-prefix ownership check.
*/

DROP POLICY IF EXISTS "anon_insert_player_documents" ON player_documents;
CREATE POLICY "insert_player_documents_authenticated"
  ON player_documents FOR INSERT
  TO authenticated
  WITH CHECK (file_path LIKE (player_id || '/%'));

DROP POLICY IF EXISTS "anon_delete_player_documents" ON player_documents;
CREATE POLICY "delete_player_documents_authenticated"
  ON player_documents FOR DELETE
  TO authenticated
  USING (file_path LIKE (player_id || '/%'));

DROP POLICY IF EXISTS "anon_update_player_documents" ON player_documents;
CREATE POLICY "update_player_documents_authenticated"
  ON player_documents FOR UPDATE
  TO authenticated
  USING (file_path LIKE (player_id || '/%'))
  WITH CHECK (file_path LIKE (player_id || '/%'));
