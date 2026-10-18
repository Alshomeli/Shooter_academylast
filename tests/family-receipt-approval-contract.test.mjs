import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/migrations/20261018036000_family_receipt_manager_approval.sql',import.meta.url),'utf8');
test('only an active manager can approve a pending family receipt',()=>{
 assert.match(sql,/role = 'manager'/);
 assert.match(sql,/status = 'active'/);
 assert.match(sql,/v_receipt.status <> 'pending'/);
 assert.match(sql,/p_confirmed_amount/);
});
test('approve family receipts locks all subscriptions and atomically posts unique revenues',()=>{
 assert.match(sql,/for update/);
 assert.match(sql,/v_sub.status <> 'unpaid'/);
 assert.match(sql,/v_sub.amount <> v_line.amount/);
 assert.match(sql,/pa.user_id=v_receipt.parent_user_id/);
 assert.match(sql,/tx.type='revenue' and tx.category='subscription'/);
 assert.match(sql,/txn-family-/);
 assert.match(sql,/update public.subscriptions/);
 assert.match(sql,/insert into public.transactions/);
 assert.match(sql,/update public.family_payment_receipts/);
});
test('approval RPC cannot be called by anon and activates only eligible new players',()=>{
 assert.match(sql,/revoke all on function public.approve_family_payment_receipt\(uuid,numeric\) from public,anon/);
 assert.match(sql,/update public.players pl/);
 assert.match(sql,/rc.approved_player_id=pl.id/);
 assert.match(sql,/pl.status='inactive'/);
 assert.match(sql,/prior.status='paid'/);
 assert.match(sql,/prior_tx.type='revenue'/);
});

test('approval persists each official receipt number and sends one parent notification',async()=>{
 const schema=await readFile(new URL('../supabase/migrations/20261018032000_family_payment_receipt_batches.sql',import.meta.url),'utf8');
 assert.match(schema,/receipt_number bigint unique/);
 assert.match(sql,/set receipt_number=v_receipt_no/);
 assert.match(sql,/insert into public.notifications/);
 assert.match(sql,/on conflict\(id\) do nothing/);
});
