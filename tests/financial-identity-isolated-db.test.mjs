import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migration = await readFile(new URL('../supabase/migrations/20261029121043_preserve_financial_identity.sql', import.meta.url), 'utf8');
const parentA = '11111111-1111-4111-8111-111111111111';
const parentB = '22222222-2222-4222-8222-222222222222';
async function fixture() {
 const db = new PGlite();
 await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema internal; create schema auth;
 grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create table staff(id text,user_id uuid,role text,status text);
 grant select on staff to authenticated;
 create table parents(id text primary key,name text,user_id uuid);
 create table players(id text primary key,name text,parent_id text,parent_name text,archived_at timestamptz);
 create table subscriptions(id text primary key,player_id text,amount numeric,status text);
 create table transactions(id text primary key,player_id text,subscription_id text,amount numeric,type text);
 create table subscription_support(id uuid primary key,player_id text,original_payment_id text,transaction_id text,amount numeric);
 insert into parents values('pa','Original parent','${parentA}'),('pb','Other parent','${parentB}');
 insert into players values('p','Original player','pa','Fallback parent',null),('other','Other child','pb','Other parent',null);
 insert into subscriptions values('old','p',25,'paid');
 insert into transactions values('old-payment','p','old',25,'revenue');
 insert into subscription_support values('33333333-3333-4333-8333-333333333333','p','old-payment','old-refund',5);
 insert into transactions values('old-refund','p',null,5,'expense');
 insert into staff values('m','44444444-4444-4444-8444-444444444444','manager','active');
 `);
 await db.exec(migration);
 return db;
}
test('archiving and renaming leave old financial names and all balances unchanged', async () => {
 const db = await fixture(); try {
  const before = (await db.query('select * from financial_record_identity order by record_kind,record_id')).rows;
  assert.equal(before.length,4);
  assert.ok(before.every(r=>r.player_name==='Original player' && r.parent_name==='Original parent' && r.capture_source==='backfill'));
  await db.exec("update players set archived_at=now(),name='Changed player' where id='p'; update parents set name='Changed parent' where id='pa';");
  assert.deepEqual((await db.query('select * from financial_record_identity order by record_kind,record_id')).rows,before);
  assert.equal(Number((await db.query("select sum(case when type='revenue' then amount else -amount end) net from transactions")).rows[0].net),20);
  await db.exec("insert into subscription_support values('55555555-5555-4555-8555-555555555555','p','old-payment','new-refund',2); insert into transactions values('new-refund','p',null,2,'expense');");
  const refunds=(await db.query("select * from financial_record_identity where record_id in ('55555555-5555-4555-8555-555555555555','new-refund')")).rows;
  assert.equal(refunds.length,2);
  assert.ok(refunds.every(r=>r.player_name==='Original player' && r.parent_name==='Original parent'));
 } finally { await db.close(); }
});
test('new financial records capture identity and unpaid reassignment follows the selected child', async () => {
 const db = await fixture(); try {
  await db.exec("insert into subscriptions values('new','p',30,'unpaid'); insert into transactions values('new-payment','p','new',30,'revenue'); update subscriptions set player_id='other' where id='new';");
  const identity=(await db.query("select * from financial_record_identity where record_id='new'")).rows[0];
  assert.equal(identity.player_name,'Other child');
  assert.equal(identity.parent_name,'Other parent');
  assert.equal(identity.capture_source,'issued');
  assert.equal((await db.query("select player_name from financial_record_identity where record_id='new-payment'")).rows[0].player_name,'Original player');
 } finally { await db.close(); }
});
test('parents see their retained identity only; clients cannot alter snapshots', async () => {
 const db = await fixture(); try {
  await db.exec(`select set_config('test.user','${parentB}',false); set role authenticated;`);
  assert.equal((await db.query('select * from financial_record_identity')).rows.length,0);
  await db.exec(`select set_config('test.user','${parentA}',false);`);
  assert.equal((await db.query('select * from financial_record_identity')).rows.length,4);
  await assert.rejects(db.exec("update financial_record_identity set player_name='Fake'"),/permission denied/);
  await assert.rejects(db.exec("delete from financial_record_identity"),/permission denied/);
  await db.exec("reset role; set role anon;");
  await assert.rejects(db.exec('select * from financial_record_identity'),/permission denied/);
 } finally { await db.close(); }
});
