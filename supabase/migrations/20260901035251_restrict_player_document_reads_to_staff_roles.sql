/*
  # Restrict player document reads to staff roles

  1. Problem
     - `player_documents` SELECT and the `player-documents` bucket SELECT used
       `is_active_member()`, which has no role test. A self-registered account of
       type `parent`, once approved, could read every player's ID scans/photos.

  2. Change
     - Both SELECT policies now require one of manager, coach, receptionist or
       accountant. Accountant is retained because the AI Center screen (open to
       accountants) loads the document list.

  3. Notes
     - Write policies on these objects are unchanged.
*/

DROP POLICY IF EXISTS "select_player_documents_authenticated" ON public.player_documents;

CREATE POLICY "select_player_documents_staff_roles"
  ON public.player_documents FOR SELECT
  TO authenticated
  USING (has_role(ARRAY['manager', 'coach', 'receptionist', 'accountant']));

DROP POLICY IF EXISTS "select_player_documents_bucket_authorized" ON storage.objects;

CREATE POLICY "select_player_documents_bucket_staff_roles"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'player-documents'
    AND has_role(ARRAY['manager', 'coach', 'receptionist', 'accountant'])
  );
