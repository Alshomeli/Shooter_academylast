create index if not exists idx_payment_proofs_player_id on public.payment_proofs(player_id);
create index if not exists idx_payment_proofs_reviewed_by on public.payment_proofs(reviewed_by);
create index if not exists idx_staff_documents_uploaded_by on public.staff_documents(uploaded_by);
