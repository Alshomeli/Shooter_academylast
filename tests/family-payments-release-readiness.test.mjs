import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationFiles=[
 '20261018030000_registration_child_recurring_fees.sql',
 '20261018032000_family_payment_receipt_batches.sql',
 '20261018034000_family_receipt_secure_intake.sql',
 '20261018035000_protect_family_receipt_storage.sql',
 '20261018036000_family_receipt_manager_approval.sql',
 '20261018037000_player_recurring_fees.sql',
 '20261018038000_sync_approved_registration_prices.sql',
 '20261018039000_issue_monthly_renewal.sql',
 '20261018040000_due_monthly_renewals_batch.sql'
];
const sql=await Promise.all(migrationFiles.map(name=>
 readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')));
const [fees,receipts,intake,storage,approval,recurring,sync,renewal,batch]=sql;

test('staging release requires all nine ordered migrations, client opt-in, and live auth checks',async()=>{
 assert.equal(sql.length,9);
 assert.match(fees,/enable row level security/i);
 assert.match(receipts,/enable row level security/i);
 assert.match(intake,/auth\.uid\(\)/);
 assert.match(approval,/auth\.uid\(\)/);
 assert.match(approval,/role\s*=\s*'manager'/);
 assert.match(recurring,/enable row level security/i);
 assert.match(sync,/registration_child_fees/);
 assert.match(renewal,/player_recurring_fees/);
 assert.match(batch,/issue_player_monthly_renewal/);
 const gate=await readFile(new URL('../src/lib/family-receipt-queue.ts',import.meta.url),'utf8');
 assert.match(gate,/VITE_ENABLE_FAMILY_RECEIPTS === 'true'/);
});

test('no new automatic settlement, open receipt access or database scheduler',()=>{
 assert.doesNotMatch(intake,/insert into public.transactions/i);
 assert.doesNotMatch(intake,/update public.subscriptions/i);
 assert.match(storage,/storage\.objects/);
 assert.match(receipts,/for select to authenticated/i);
 assert.doesNotMatch(batch,/cron\.schedule|pg_cron/i);
 assert.doesNotMatch(renewal,/set status='paid'/i);
 assert.match(approval,/set status='paid'/);
});

test('approval must keep posted revenue atomic and reconcile exact manager-confirmed amount',()=>{
 assert.match(approval,/v_sum\s*<>\s*p_confirmed_amount/);
 assert.match(approval,/for update/i);
 assert.match(approval,/insert into public.transactions/i);
 assert.match(approval,/receipt_number=v_receipt_no/);
 assert.match(approval,/registration_children/);
});
