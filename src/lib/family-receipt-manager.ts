import { familyPaymentsEnabled } from './family-receipt-queue';
import {supabase} from './supabase';

/** Staging-only manager review adapter. Not wired into live pages. */
export async function approveFamilyReceiptAfterBankVerification(
  receiptId: string, confirmedBankAmountBhd: number,
): Promise<void> {
  if (!familyPaymentsEnabled) throw new Error('Family receipt approvals are disabled');
  if (!/^[0-9a-f-]{36}$/i.test(receiptId) ||
      !Number.isFinite(confirmedBankAmountBhd) ||
      confirmedBankAmountBhd <= 0 ||
      Math.abs(confirmedBankAmountBhd * 1000 - Math.round(confirmedBankAmountBhd * 1000)) > 0.000001
  ) throw new Error('Invalid verified family transfer');
  const {error} = await supabase.rpc('approve_family_payment_receipt', {
    p_receipt_id: receiptId,
    p_confirmed_amount: confirmedBankAmountBhd,
  });
  if (error) throw error;
}

export async function reviewFamilyReceipt(receiptId: string, decision: 'needs_info'|'rejected', note: string): Promise<void> {
  if (!familyPaymentsEnabled) throw new Error('Family receipt reviews are disabled');
  if (!/^[0-9a-f-]{36}$/i.test(receiptId) || note.trim().length < 5 || note.length > 1000) {
    throw new Error('A review reason of 5 to 1000 characters is required');
  }
  const {error}=await supabase.rpc('review_family_payment_receipt',{
    p_receipt_id:receiptId,p_decision:decision,p_note:note.trim()
  });
  if(error) throw error;
}
