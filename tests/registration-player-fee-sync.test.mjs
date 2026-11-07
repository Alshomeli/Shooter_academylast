import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/migrations/20261018038000_sync_approved_registration_prices.sql',import.meta.url),'utf8');
test('approved application child discount follows linked player',()=>{
 assert.match(sql,/after update of approved_player_id on public.registration_children/);
 assert.match(sql,/after insert or update of monthly_amount on public.registration_child_fees/);
 assert.match(sql,/insert into public.player_recurring_fees/);
 assert.match(sql,/on conflict\(player_id\) do update/);
});
test('registration fee sync does not alter past subscription invoices',()=>{
 assert.doesNotMatch(sql,/update public.subscriptions/i);
 assert.doesNotMatch(sql,/insert into public.transactions/i);
});
