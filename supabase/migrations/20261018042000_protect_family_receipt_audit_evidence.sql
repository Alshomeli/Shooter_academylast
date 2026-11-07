-- Protect prior evidence referenced by auditable review history.
drop policy if exists payment_proofs_storage_delete_unreferenced on storage.objects;
create policy payment_proofs_storage_delete_unreferenced on storage.objects
for delete to authenticated using (
 bucket_id='payment-proofs'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.payment_proofs p where p.proof_path=name)
 and not exists(select 1 from public.family_payment_receipts r where r.proof_path=name)
 and not exists(select 1 from public.family_receipt_review_events e
   where e.prior_proof_path=name or e.new_proof_path=name)
);
