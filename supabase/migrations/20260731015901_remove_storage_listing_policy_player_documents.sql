-- Remove the broad SELECT policy on storage.objects for the player-documents bucket.
-- The bucket is public, so individual object URLs work without any SELECT policy.
-- The SELECT policy allowed any authenticated user to LIST all files in the bucket,
-- exposing file paths and metadata they should not see. The app never calls .list()
-- — it retrieves file paths from the player_documents table and uses getPublicUrl().
DROP POLICY IF EXISTS read_player_documents_bucket_authenticated ON storage.objects;
