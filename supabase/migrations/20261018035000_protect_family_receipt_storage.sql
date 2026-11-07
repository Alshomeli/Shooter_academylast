-- Development-only migration: apply after family receipt tables and intake RPC.
-- Protect family receipt evidence from deletion once it is attached to a review.
-- Retain the existing individual proof deletion guard.
drop policy if exists payment_proofs_storage_delete_unreferenced on storage.objects;
create policy payment_proofs_storage_delete_unreferenced
on storage.objects for delete to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.payment_proofs pp where pp.proof_path = name
  )
  and not exists (
    select 1 from public.family_payment_receipts fr where fr.proof_path = name
  )
);
