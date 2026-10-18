import { familyPaymentsEnabled } from './family-receipt-queue';
import { supabase } from './supabase';
import { familyReceiptStoragePath, prepareFamilyReceiptIntake } from './family-receipt-intake';
import type { FamilySubscriptionDue } from './family-payment-allocation';

/**
 * Staging-only integration. Do not wire this to production UI until SQL migrations
 * and storage/RLS policies are validated against an isolated Supabase project.
 * A submission creates a pending review; it never posts or approves money.
 */
export async function submitFamilyReceiptForReview(
  dues: FamilySubscriptionDue[],
  transferDate: string,
  file: File,
): Promise<string> {
  if (!familyPaymentsEnabled) throw new Error('Family receipt submissions are disabled');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw authError || new Error('Authentication required');

  const draft = prepareFamilyReceiptIntake(user.id, dues, transferDate, file);
  const path = familyReceiptStoragePath(user.id, crypto.randomUUID(), file.type);
  const { error: uploadError } = await supabase.storage
    .from('payment-proofs').upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.rpc('submit_family_payment_receipt', {
    p_subscription_ids: draft.subscriptionIds,
    p_proof_path: path,
    p_transfer_date: draft.transferDate,
  });
  // An RPC can commit even if the network response is lost. Never delete the
  // uploaded evidence on an ambiguous failure: it may now be referenced.
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Receipt submission could not be confirmed');
  return data;
}

export async function resubmitFamilyReceiptForReview(receiptId: string, transferDate: string, file: File): Promise<void> {
 if(!familyPaymentsEnabled) throw new Error('Family receipt corrections are disabled');
 if(!/^[0-9a-f-]{36}$/i.test(receiptId)) throw new Error('Invalid receipt');
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user) throw authError||new Error('Authentication required');
 if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(transferDate)) throw new Error('Invalid transfer date');
 if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type) || file.size<1 || file.size>5242880)
  throw new Error('Unsupported receipt format or size');
 const path=familyReceiptStoragePath(user.id,crypto.randomUUID(),file.type);
 const {error:uploadError}=await supabase.storage.from('payment-proofs').upload(path,file,{upsert:false,contentType:file.type});
 if(uploadError) throw uploadError;
 const {error}=await supabase.rpc('resubmit_family_payment_receipt',{
  p_receipt_id:receiptId,p_proof_path:path,p_transfer_date:transferDate
 });
 if(error) throw error;
}
