create unique index if not exists uq_staff_documents_profile_photo
on public.staff_documents(staff_id)
where document_type='profile_photo';
