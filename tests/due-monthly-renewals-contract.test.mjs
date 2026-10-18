import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/migrations/20261018040000_due_monthly_renewals_batch.sql',import.meta.url),'utf8');
test('due renewal batch is manager-only and never creates a scheduler',()=>{
 assert.match(sql,/role='manager'/);
 assert.match(sql,/issue_player_monthly_renewal/);
 assert.doesNotMatch(sql,/cron\.schedule|pg_cron|create extension/i);
 assert.match(sql,/limit 500/);
});
test('batch cannot backdate arbitrary invoices or change paid subscriptions',()=>{
 assert.match(sql,/p_as_of<>current_date/);
 assert.match(sql,/s.end_date >= p_as_of - 31/);
 assert.match(sql,/s.status='paid'/);
 assert.match(sql,/pl.status='active'/);
 assert.match(sql,/not exists/);
 assert.doesNotMatch(sql,/update public.subscriptions|insert into public.transactions/i);
});
