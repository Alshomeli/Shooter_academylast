import { supabase } from './supabase';
export const familyPaymentsEnabled = import.meta.env.VITE_ENABLE_FAMILY_RECEIPTS === 'true';
export interface FamilyReceiptQueueItem {
 id: string; parent_user_id: string; proof_path: string; transfer_date: string;
 expected_amount: number; status: 'pending'|'needs_info'|'rejected'|'approved';
 created_at: string; review_note: string|null;
}
export async function getFamilyReceiptReviewQueue(): Promise<FamilyReceiptQueueItem[]> {
 if (!familyPaymentsEnabled) return [];
 const { data, error } = await supabase.from('family_payment_receipts')
  .select('id,parent_user_id,proof_path,transfer_date,expected_amount,status,created_at,review_note')
  .order('created_at',{ascending:false});
 if(error) throw error;
 return (data || []) as FamilyReceiptQueueItem[];
}

export async function getClaimedFamilySubscriptionIds(): Promise<string[]> {
 if (!familyPaymentsEnabled) return [];
 // RLS on header limits parents to their own batches. The item policy
 // inherits that visibility, so one parent's claims never reveal another's.
 const {data,error} = await supabase.from('family_payment_receipt_items').select('subscription_id');
 if(error) throw error;
 return [...new Set((data||[]).map(row=>row.subscription_id as string))];
}
