drop policy if exists staff_documents_storage_insert on storage.objects;
drop policy if exists staff_documents_storage_select on storage.objects;
drop policy if exists staff_documents_storage_delete on storage.objects;

create policy staff_documents_storage_insert on storage.objects
for insert to authenticated
with check (
 bucket_id='staff-documents'
 and (
   internal.has_role(array['manager'::text])
   or exists(
     select 1 from public.staff st
     where st.id=(storage.foldername(storage.objects.name))[1]
       and st.user_id=(select auth.uid())
   )
 )
);
create policy staff_documents_storage_select on storage.objects
for select to authenticated
using (
 bucket_id='staff-documents'
 and (
   internal.has_role(array['manager'::text])
   or exists(
     select 1 from public.staff st
     where st.id=(storage.foldername(storage.objects.name))[1]
       and st.user_id=(select auth.uid())
   )
 )
);
create policy staff_documents_storage_delete on storage.objects
for delete to authenticated
using (
 bucket_id='staff-documents'
 and (
   internal.has_role(array['manager'::text])
   or exists(
     select 1 from public.staff st
     where st.id=(storage.foldername(storage.objects.name))[1]
       and st.user_id=(select auth.uid())
   )
 )
);
