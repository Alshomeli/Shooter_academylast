import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/migrations/20261018037000_player_recurring_fees.sql',import.meta.url),'utf8');
const adapter=await readFile(new URL('../src/lib/player-recurring-fees.ts',import.meta.url),'utf8');
test('manager controls enduring player price and parents may only see linked player',()=>{
 assert.match(sql,/player_id text primary key/);
 assert.match(sql,/check \(monthly_amount between 0 and 25\)/);
 assert.match(sql,/pa.user_id=\(select auth.uid\(\)\)/);
 assert.match(sql,/role='manager' and st.status='active'/);
});
test('fees apply to future renewal drafts and never rewrite historic subscriptions',()=>{
 assert.doesNotMatch(sql,/update public.subscriptions/i);
 assert.doesNotMatch(sql,/insert into public.transactions/i);
 assert.match(adapter,/familyPaymentsEnabled/);
 assert.match(adapter,/BASE_MONTHLY_FEE_BHD/);
 assert.match(adapter,/upsert/);
});
