import { supabase } from './supabase';
import { priceChildren } from './family-payment';
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
