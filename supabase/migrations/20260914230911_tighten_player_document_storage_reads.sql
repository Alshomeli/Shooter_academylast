drop policy if exists select_player_documents_bucket_staff_roles on storage.objects;
create policy select_player_documents_bucket_staff_roles on storage.objects
for select to authenticated
using (
  bucket_id = 'player-documents'
  and internal.has_role(array['manager','coach','receptionist','accountant'])
  and exists (
    select 1 from public.players p
    where p.id = (storage.foldername(name))[1]
  )
);
