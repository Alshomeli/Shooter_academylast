/*
# Tighten storage.objects policies for player-documents bucket

## Purpose
The earlier migration tightened the database table RLS but left the storage
bucket policies overly broad:
- anon_update_player_documents_bucket — unused (app never updates objects).
- anon_delete_player_documents_bucket — broad DELETE that bypasses the
  secure edge function path. Deletion now goes through the edge function
  using the service role key, so the anon DELETE policy is not needed.
- anon_insert_player_documents_bucket — allowed any path. Tighten to require
  the object name (path) to start with a player-id folder prefix.

## Changes
- DROP anon_update_player_documents_bucket (unused).
- DROP anon_delete_player_documents_bucket (deletion via edge function only).
- Replace anon_insert_player_documents_bucket with a path-prefix check:
  the object name must match a player-id-slash pattern so random paths are rejected.
- SELECT (listing) remains dropped from the prior migration.

## Security
- INSERT now requires name LIKE 'player-%/%' (WITH CHECK).
- DELETE and UPDATE are removed entirely — only the edge function (service role)
  can delete objects, and updates are not supported.
*/
DROP POLICY IF EXISTS "anon_update_player_documents_bucket" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_player_documents_bucket" ON storage.objects;

DROP POLICY IF EXISTS "anon_insert_player_documents_bucket" ON storage.objects;
CREATE POLICY "anon_insert_player_documents_bucket"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'player-documents' AND name LIKE 'player-%/%');
