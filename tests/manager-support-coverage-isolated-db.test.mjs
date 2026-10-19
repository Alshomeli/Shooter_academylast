import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const manager='11111111-1111-4111-8111-111111111111';
const accountant='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const sqlFile=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated;create schema auth;create schema internal;
 grant usage on schema auth,internal to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
 create table staff(id text primary key,user_id uuid,name text,status text,role text);
 create table parents(id text primary key,user_id uuid);
 create table players(id text primary key,parent_id text,status text);
 create table subscriptions(id text primary key,player_id text references players,plan_type text,amount numeric,start_date date,end_date date,status text,payment_method text,paid_at timestamptz);
 create table transactions(id text primary key,player_id text references players,subscription_id text references subscriptions,type text,category text,amount numeric,transaction_date date,description text,recorded_by text);
 create table audit_logs(id text primary key,action text,timestamp text,user_role text,user_name text,details text);
 create table payment_proofs(id uuid primary key,player_id text);
 create table family_payment_receipt_items(player_id text);
 create table player_recurring_fees(player_id text primary key,monthly_amount numeric check(monthly_amount<=25),updated_by uuid,updated_at timestamptz);
 insert into staff values('manager','${manager}','Manager','active','manager'),('accountant','${accountant}','Accountant','active','accountant');
 insert into parents values('parent','44444444-4444-4444-8444-444444444444');
 insert into players values('paid-player','parent','active'),('opening-player','parent','inactive'),('exempt-player','parent','active');
 insert into subscriptions values('paid','paid-player','monthly',25,current_date-5,current_date+25,'paid','cash',now());
 insert into transactions values('original','paid-player','paid','revenue','subscription',25,current_date,'Original','Manager');
 select set_config('test.user','${manager}',false);`);
 await db.exec(await sqlFile('tests/fixtures/production-payment-integrity-guards.sql'));
 await db.exec(await sqlFile('supabase/migrations/20261019082642_manager_subscription_support.sql'));
 await db.exec(await sqlFile('supabase/migrations/20261019083004_manager_preplatform_coverage.sql'));
 return db;
}
test('manager support is linked, immutable, idempotent, capped and changes cash net once',async()=>{
 const db=await setup();try{
  const grant=(id,amount,reason='Player support')=>db.query('select public.grant_subscription_support($1::uuid,$2,$3::numeric,$4,$5)',[id,'paid',amount,reason,'cash']);
  await db.exec(`select set_config('test.user','${accountant}',false)`);
  await assert.rejects(grant(request,5),/Active manager/);
  await db.exec(`select set_config('test.user','${manager}',false)`);
  for(const value of [0,-1,26,'NaN','Infinity','0.0001'])await assert.rejects(grant(request,value));
  await grant(request,5);await grant(request,5);
  await assert.rejects(grant(request,6),/different details/);
  assert.equal((await db.query('select count(*)::int n from subscription_support')).rows[0].n,1);
  assert.equal(Number((await db.query("select sum(case when type='revenue' then amount else -amount end) net from transactions")).rows[0].net),20);
  assert.equal(Number((await db.query("select amount from transactions where id='original'")).rows[0].amount),25);
  await assert.rejects(db.exec("delete from transactions where category='subscription_support'"),/immutable/);
  await assert.rejects(db.exec("update transactions set amount=1 where category='subscription_support'"),/immutable/);
  await assert.rejects(db.exec('delete from subscription_support'),/immutable/);
  await assert.rejects(grant('55555555-5555-4555-8555-555555555555',20.001),/exceeds/);
  await grant('55555555-5555-4555-8555-555555555555',20);
  await assert.rejects(grant('66666666-6666-4666-8666-666666666666',0.001),/exceeds/);
  await assert.rejects(db.exec("insert into transactions(id,type,category,amount,player_id) values('fake','expense','subscription_support',1,'paid-player')"),/manager support/);
  await db.exec('set role authenticated');
  await assert.rejects(db.exec("insert into subscription_support(id) values(gen_random_uuid())"),/permission denied/);
 }finally{await db.close();}
});
test('previous coverage activates without cash and schedules the first future bill; exemptions produce no cash',async()=>{
 const db=await setup();try{
  await db.exec("insert into subscriptions(id,player_id,status,amount,start_date,end_date) values('old-unpaid','opening-player','unpaid',25,current_date-5,current_date+5)");
  const approve=()=>db.query("select public.approve_preplatform_coverage('opening-player',current_date-10,current_date+10,20,'Existing academy receipt')");
  await db.exec(`select set_config('test.user','${accountant}',false)`);
  await assert.rejects(approve(),/Active manager/);
  await db.exec(`select set_config('test.user','${manager}',false)`);
  await approve();await approve();
  assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,1);
  assert.equal((await db.query("select status from players where id='opening-player'")).rows[0].status,'active');
  const subs=(await db.query("select * from subscriptions where player_id='opening-player'")).rows;
  assert.equal(subs.length,1);assert.equal(subs[0].status,'unpaid');assert.equal(Number(subs[0].amount),20);
  await assert.rejects(db.exec("update subscriptions set status='paid',paid_at=now(),payment_method='cash' where player_id='opening-player'"),/not due/);
  await assert.rejects(db.exec("insert into subscriptions(id,player_id,status,amount,start_date,end_date) values('overlap','opening-player','unpaid',25,current_date,current_date+5)"),/overlaps/);
  await assert.rejects(db.query("select public.approve_preplatform_coverage('paid-player',current_date-10,current_date+10,20,'Existing receipt')"),/Existing billing/);
  await db.exec("insert into subscriptions(id,player_id,status,amount) values('exempt','exempt-player','exempt',0)");
  assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,1);
  await assert.rejects(db.exec("update subscriptions set amount=25 where id='exempt'"),/zero amount/);
  await assert.rejects(db.query('select public.grant_subscription_support($1::uuid,$2,5,$3,$4)',[request,'exempt','Reason','cash']),/paid subscription/);
  await db.exec('set role authenticated');
  await assert.rejects(db.exec("insert into preplatform_coverage(player_id) values('exempt-player')"),/permission denied/);
 }finally{await db.close();}
});
