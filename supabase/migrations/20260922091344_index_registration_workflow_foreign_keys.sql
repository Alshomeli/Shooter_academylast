create index if not exists idx_registration_applications_approved_parent_id on public.registration_applications (approved_parent_id) where approved_parent_id is not null;
create index if not exists idx_registration_applications_reviewed_by_staff_id on public.registration_applications (reviewed_by_staff_id) where reviewed_by_staff_id is not null;
create index if not exists idx_registration_children_approved_player_id on public.registration_children (approved_player_id) where approved_player_id is not null;
create index if not exists idx_registration_documents_approved_player_id on public.registration_documents (approved_player_id) where approved_player_id is not null;
