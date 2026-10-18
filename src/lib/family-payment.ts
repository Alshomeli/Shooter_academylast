import { supabase } from './supabase';
/** Draft pricing rules for registration review. Financial writes must be server-authorized. */
export const BASE_MONTHLY_FEE_BHD = 25;
export type ChildPrice = { childId: string; baseAmount: number; approvedAmount: number };
export function priceChildren(childIds: string[], overrides: Record<string,number> = {}): ChildPrice[] {
  return childIds.map(childId => {
    const override = overrides[childId];
    const approvedAmount = override === undefined ? BASE_MONTHLY_FEE_BHD : override;
    if (!Number.isFinite(approvedAmount) || approvedAmount < 0 || approvedAmount > BASE_MONTHLY_FEE_BHD || Math.round(approvedAmount*1000)!==approvedAmount*1000) {
      throw new Error('Invalid manager-approved fee');
    }
    return {childId,baseAmount:BASE_MONTHLY_FEE_BHD,approvedAmount};
  });
}
export function familyAmount(prices: ChildPrice[]): number {
  return Math.round(prices.reduce((sum, item) => sum + item.approvedAmount, 0)*1000)/1000;
}
/** Verification of uploaded transfer screenshots is advisory only:
 * never activate a player or mark a subscription paid based on OCR.
 * Only the academy's authorized review RPC may approve and post a payment. */

export async function readChildFeeOverrides(childIds: string[]): Promise<Record<string, number>> {
  if (!childIds.length) return {};
  const { data, error } = await supabase.from('registration_child_fees')
    .select('child_id,monthly_amount').in('child_id',childIds);
  if (error) throw error;
  return Object.fromEntries((data || []).map(row => [row.child_id, Number(row.monthly_amount)]));
}
export async function saveManagerChildFee(childId: string, monthlyAmount: number): Promise<void> {
  priceChildren([childId], { [childId]: monthlyAmount });
  const { data: identity, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!identity.user) throw new Error('Authentication required');
  const { error } = await supabase.from('registration_child_fees').upsert({
    child_id: childId, monthly_amount: monthlyAmount, updated_by: identity.user.id,
  }, { onConflict: 'child_id' });
  if (error) throw error;
}
