import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/migrations/20261018039000_issue_monthly_renewal.sql',import.meta.url),'utf8');
test('monthly renewal uses saved player fee and manager authorization',()=>{
 assert.match(sql,/role='manager'/);
 assert.match(sql,/player_recurring_fees/);
 assert.match(sql,/25\.000/);
 assert.match(sql,/status='active'/);
});
test('renewal serialization is idempotent, never posts revenue and blocks overlaps',()=>{
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/start_date=p_start_date and end_date=v_end/);
 assert.match(sql,/Renewal overlaps another subscription period/);
 assert.match(sql,/return v_existing/);
 assert.doesNotMatch(sql,/insert into public.transactions/i);
 assert.doesNotMatch(sql,/update public.subscriptions/i);
});
