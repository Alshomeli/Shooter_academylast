import { supabase } from './supabase';
import { BASE_MONTHLY_FEE_BHD } from './family-payment';
import { familyPaymentsEnabled } from './family-receipt-queue';

/** Read-only draft renewal pricing. Does not generate billing or post payments. */
export async function getRenewalPrices(playerIds: string[]): Promise<Record<string,number>> {
 if (!familyPaymentsEnabled || !playerIds.length) return {};
 const ids = [...new Set(playerIds)];
 const {data,error} = await supabase.from('player_recurring_fees')
   .select('player_id,monthly_amount').in('player_id', ids);
 if(error) throw error;
 const prices: Record<string,number> = Object.fromEntries(ids.map(id=>[id,BASE_MONTHLY_FEE_BHD]));
 for (const row of data || []) {
   const amount=Number(row.monthly_amount);
   if (!Number.isFinite(amount) || amount<0 || amount>BASE_MONTHLY_FEE_BHD ||
       Math.abs(amount*1000-Math.round(amount*1000))>0.000001) {
     throw new Error('Invalid recurring fee from database');
   }
   prices[row.player_id]=amount;
 }
 return prices;
}
export async function saveManagerRecurringPlayerFee(playerId: string, amount: number): Promise<void> {
 if (!familyPaymentsEnabled) throw new Error('Recurring fees are not enabled');
 if (!playerId || !Number.isFinite(amount) || amount < 0 || amount > BASE_MONTHLY_FEE_BHD ||
     Math.abs(amount*1000-Math.round(amount*1000))>0.000001) throw new Error('Invalid manager fee');
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError || !user) throw authError || new Error('Authentication required');
 const {error}=await supabase.from('player_recurring_fees').upsert({
   player_id:playerId,monthly_amount:amount,updated_by:user.id,updated_at:new Date().toISOString()
 },{onConflict:'player_id'});
 if(error) throw error;
}
