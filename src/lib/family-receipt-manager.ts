import {supabase} from './supabase';

/** Staging-only manager review adapter. Not wired into live pages. */
export async function approveFamilyReceiptAfterBankVerification(
  receiptId: string, confirmedBankAmountBhd: number,
): Promise<void> {
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
