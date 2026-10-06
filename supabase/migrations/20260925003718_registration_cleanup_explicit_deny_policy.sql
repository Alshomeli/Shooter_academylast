-- Require a committed cleanup request before direct deletion of registration files.

drop policy if exists registration_cleanup_no_direct_access
  on internal.registration_file_cleanup;

create policy registration_cleanup_no_direct_access
on internal.registration_file_cleanup
for all
to authenticated
using (false)
with check (false);

drop policy if exists registration_cleanup_requires_committed_delete
  on storage.objects;

create policy registration_cleanup_requires_committed_delete
on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id <> 'player-documents'
  or name not like 'applications/%'
  or internal.can_cleanup_registration_file(name)
);
