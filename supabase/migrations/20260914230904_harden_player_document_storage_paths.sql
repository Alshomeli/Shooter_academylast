drop policy if exists insert_player_documents_bucket_authorized on storage.objects;
create policy insert_player_documents_bucket_authorized on storage.objects
for insert to authenticated
with check (
  bucket_id = 'player-documents'
  and internal.has_role(array['manager','coach','receptionist'])
  and exists (
    select 1 from public.players p
    where p.id = (storage.foldername(name))[1]
  )
);

drop policy if exists update_player_documents_bucket_authorized on storage.objects;
create policy update_player_documents_bucket_authorized on storage.objects
for update to authenticated
using (
  bucket_id = 'player-documents'
  and internal.has_role(array['manager','coach','receptionist'])
  and exists (
    select 1 from public.players p
    where p.id = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'player-documents'
  and internal.has_role(array['manager','coach','receptionist'])
  and exists (
    select 1 from public.players p
    where p.id = (storage.foldername(name))[1]
  )
);

drop policy if exists delete_player_documents_bucket_authorized on storage.objects;
create policy delete_player_documents_bucket_authorized on storage.objects
for delete to authenticated
using (
  bucket_id = 'player-documents'
  and internal.has_role(array['manager','coach','receptionist'])
  and exists (
    select 1 from public.players p
    where p.id = (storage.foldername(name))[1]
  )
);
