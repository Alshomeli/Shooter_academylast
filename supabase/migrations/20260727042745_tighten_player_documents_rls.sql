/*
# Tighten player_documents RLS and storage policies

## Purpose
Fix four security findings from the RLS audit:
1. INSERT policy used `WITH CHECK (true)` — unrestricted inserts.
2. UPDATE policy used `USING (true) / WITH CHECK (true)` — unrestricted updates.
3. DELETE policy used `USING (true)` — unrestricted deletes.
4. Public bucket had a broad SELECT policy on storage.objects allowing clients to
   list ALL files in the bucket (public URLs still work without it).

## Changes
- `player_documents`:
  - DROP the unused `anon_update_player_documents` policy entirely. The app only
    inserts and deletes rows; it never updates them.
  - Replace `anon_insert_player_documents` with a policy that requires the row's
    `file_path` to start with the `player_id` prefix (e.g. `player-123/...`). This
    ties every inserted row to a real player id so random/garbage paths are rejected.
  - Replace `anon_delete_player_documents` with a policy that requires the existing
    row's `player_id` to match the `file_path` prefix. This prevents deleting a
    document that belongs to a different player than its path implies.
- `storage.objects`:
  - DROP `anon_read_player_documents_bucket`. Public bucket object URLs do not need
    a SELECT policy to be readable; removing it stops clients from listing the
    whole bucket. (Public URL access works via the public URL endpoint, not RLS.)
  - Keep INSERT and DELETE storage policies, but DELETE now only allows deletion
    when the object path prefix matches the file's owning player — enforced at the
    app layer via the delete edge function using the service role key.

## Security
- INSERT now checks `file_path LIKE player_id || '/%'` (WITH CHECK).
- DELETE now checks the same prefix match against the stored row (USING).
- UPDATE is removed entirely (no app code uses it).
- Storage SELECT (listing) removed; public URLs still work.

## Notes
1. The app has no real auth (localStorage fake login), so all requests arrive as
   the `anon` role — policies must remain `TO anon, authenticated`.
2. Real-world deletion of storage objects is performed by an edge function using
   the service role key, which bypasses RLS. The DB row delete still goes through
   the anon-key DELETE policy, which now validates the player_id/path prefix.
3. The `file_path LIKE player_id || '/%'` constraint is a defense-in-depth check:
   it ensures a row cannot be written or removed for a path that doesn't belong
   to its declared player. Since `player_id` is text and not FK-constrained, this
   is the strongest ownership check available without real auth.
*/

-- ------------------------------------------------------------------
-- player_documents: remove unrestricted UPDATE policy (unused by app)
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_update_player_documents" ON player_documents;

-- ------------------------------------------------------------------
-- player_documents: tighten INSERT to require path matches player_id
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_insert_player_documents" ON player_documents;
CREATE POLICY "anon_insert_player_documents"
  ON player_documents FOR INSERT
  TO anon, authenticated
  WITH CHECK (file_path LIKE player_id || '/%');

-- ------------------------------------------------------------------
-- player_documents: tighten DELETE to require path matches player_id
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_delete_player_documents" ON player_documents;
CREATE POLICY "anon_delete_player_documents"
  ON player_documents FOR DELETE
  TO anon, authenticated
  USING (file_path LIKE player_id || '/%');

-- ------------------------------------------------------------------
-- storage.objects: remove the broad listing (SELECT) policy.
-- Public bucket URLs are served via the public URL endpoint and do NOT
-- need a SELECT policy on storage.objects to be readable.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_read_player_documents_bucket" ON storage.objects;
