grant update on public.registration_children to authenticated;
grant update on public.registration_documents to authenticated;

create policy registration_children_update_manager
on public.registration_children
for update to authenticated
using ((select internal.is_academy_admin()))
with check ((select internal.is_academy_admin()));

create policy registration_documents_update_manager
on public.registration_documents
for update to authenticated
using ((select internal.is_academy_admin()))
with check ((select internal.is_academy_admin()));

