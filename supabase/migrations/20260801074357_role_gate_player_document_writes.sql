/*
  # Role-gate player document writes

  1. Changes
    - Drop the duplicate INSERT policy that required no role, leaving only the
      role-gated one.
    - Replace the UPDATE and DELETE policies so that only managers, coaches and
      receptionists can modify or remove document records.
*/

DROP POLICY IF EXISTS insert_player_documents_authenticated ON public.player_documents;

DROP POLICY IF EXISTS update_player_documents_authenticated ON public.player_documents;
CREATE POLICY update_player_documents_authorized ON public.player_documents FOR UPDATE TO authenticated
  USING (has_role(ARRAY['manager','coach','receptionist']) AND file_path LIKE (player_id || '/%'))
  WITH CHECK (has_role(ARRAY['manager','coach','receptionist']) AND file_path LIKE (player_id || '/%'));

DROP POLICY IF EXISTS delete_player_documents_authenticated ON public.player_documents;
CREATE POLICY delete_player_documents_authorized ON public.player_documents FOR DELETE TO authenticated
  USING (has_role(ARRAY['manager','coach','receptionist']) AND file_path LIKE (player_id || '/%'));
