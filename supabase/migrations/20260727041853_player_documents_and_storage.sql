/*
# Player Documents & Storage Bucket

## Purpose
Store metadata for files (photos, PDFs, PNGs) uploaded per player, with a Supabase
Storage bucket `player-documents` holding the actual binary objects.

## New Tables
- `player_documents`
  - `id` (uuid, PK)
  - `player_id` (text, not null) — references the app-side Player.id (string like "player-123")
  - `file_name` (text, not null) — original file name
  - `file_path` (text, not null) — path inside the storage bucket
  - `file_type` (text, not null) — MIME type
  - `file_category` (text, not null) — 'photo' | 'document'
  - `file_size` (bigint, not null) — bytes
  - `uploaded_at` (timestamptz, default now())

## Storage
- Create public-read bucket `player-documents` (if not exists).
- Allow anon+authenticated to upload, read, and delete objects.

## Security
- RLS enabled on `player_documents`.
- Single-tenant app (no real auth) → policies use `TO anon, authenticated` with `USING (true)`
  because the data is intentionally shared/public within the academy.

## Notes
1. The frontend app uses a localStorage-backed fake login, NOT Supabase Auth, so all
   requests arrive as the `anon` role. Policies must include `anon` or the app cannot
   read its own data.
2. Storage bucket is public-read so `<img src="publicUrl">` works without signed URLs.
3. Writes (insert/delete) are also open to anon because the app has no real auth boundary.
*/

CREATE TABLE IF NOT EXISTS player_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_category text NOT NULL DEFAULT 'document',
  file_size bigint NOT NULL DEFAULT 0,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_documents_player_id ON player_documents(player_id);

ALTER TABLE player_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_player_documents" ON player_documents;
CREATE POLICY "anon_select_player_documents"
  ON player_documents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_player_documents" ON player_documents;
CREATE POLICY "anon_insert_player_documents"
  ON player_documents FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_player_documents" ON player_documents;
CREATE POLICY "anon_delete_player_documents"
  ON player_documents FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_player_documents" ON player_documents;
CREATE POLICY "anon_update_player_documents"
  ON player_documents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-documents', 'player-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow anon+authenticated CRUD on the bucket
DROP POLICY IF EXISTS "anon_read_player_documents_bucket" ON storage.objects;
CREATE POLICY "anon_read_player_documents_bucket"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'player-documents');

DROP POLICY IF EXISTS "anon_insert_player_documents_bucket" ON storage.objects;
CREATE POLICY "anon_insert_player_documents_bucket"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'player-documents');

DROP POLICY IF EXISTS "anon_delete_player_documents_bucket" ON storage.objects;
CREATE POLICY "anon_delete_player_documents_bucket"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'player-documents');

DROP POLICY IF EXISTS "anon_update_player_documents_bucket" ON storage.objects;
CREATE POLICY "anon_update_player_documents_bucket"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'player-documents')
  WITH CHECK (bucket_id = 'player-documents');
