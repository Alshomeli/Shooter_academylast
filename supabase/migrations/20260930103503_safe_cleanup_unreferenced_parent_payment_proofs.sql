drop policy if exists payment_proofs_storage_delete_unreferenced on storage.objects;
create policy payment_proofs_storage_delete_unreferenced
on storage.objects for delete to authenticated
using (
  bucket_id='payment-proofs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists (
    select 1 from public.payment_proofs pp where pp.proof_path=storage.objects.name
  )
);
