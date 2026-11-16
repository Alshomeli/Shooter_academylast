import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const sql=await readFile(new URL('../supabase/migrations/20261021025817_daily_due_reminders.sql',import.meta.url),'utf8');
async function setup(){
 const db=new PGlite();await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema internal; create schema auth; create schema cron;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
 create table parents(id text primary key,user_id uuid,status text,name text);
 create table players(id text primary key,parent_id text,name text,archived_at timestamptz);
 create table staff(id text primary key,user_id uuid,status text,role text,name text,created_at timestamptz default now());
 create table subscriptions(id text primary key,player_id text,status text,amount numeric,start_date date);
 create table notifications(id text primary key,title text,message text,timestamp text,type text,read boolean,recipient_user_id uuid);
 create table payment_proofs(id uuid primary key,subscription_id text,status text,created_at timestamptz);
 create table telegram_user_links(user_id uuid primary key,chat_id bigint unique,role text constraint telegram_user_links_role_check check(role in ('manager','coach')),is_active boolean,telegram_user_code text,linked_at timestamptz,last_seen_at timestamptz);
 create table telegram_link_codes(id uuid primary key,user_id uuid,code_hash text,role text constraint telegram_link_codes_role_check check(role in ('manager','coach')),expires_at timestamptz,consumed_at timestamptz,created_at timestamptz);
 create policy telegram_link_codes_insert_own_staff_role on telegram_link_codes for insert to authenticated with check(false);
 create table internal.telegram_manager_bindings(staff_id text,active boolean,telegram_chat_id bigint);
 insert into parents values('pa','11111111-1111-4111-8111-111111111111','active','Parent');
 insert into players values('p','pa','Player',null),('archived','pa','Archived',now());
 insert into staff values('m','22222222-2222-4222-8222-222222222222','active','manager','Manager',now());
 insert into internal.telegram_manager_bindings values('m',true,42);
 insert into subscriptions values('due','p','unpaid',25,current_date-1),('paid','p','paid',25,current_date-1),('future','p','unpaid',25,current_date+2),('archived','archived','unpaid',25,current_date-1);
 `);await db.exec(sql);await db.exec(await readFile(new URL('../supabase/migrations/20261021030454_preserve_unpaid_subscription_replacement.sql',import.meta.url),'utf8'));
 await db.exec("insert into telegram_user_links(user_id,chat_id,role,is_active) values('11111111-1111-4111-8111-111111111111',99,'parent',true)");
 return db;
}
test('daily queue repeats safely and only unpaid due nonarchived subscriptions are reminded',async()=>{
 const db=await setup();try{
 await db.exec('select internal.queue_daily_subscription_reminders(); select internal.queue_daily_subscription_reminders();');
 assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from internal.subscription_telegram_reminders')).rows[0].n,2);
 const claimed=(await db.query('select * from public.telegram_claim_subscription_reminders(50)')).rows;
 assert.equal(claimed.length,2);assert.deepEqual(claimed.map(x=>x.recipient_role).sort(),['manager','parent']);
 assert.equal((await db.query('select * from public.telegram_claim_subscription_reminders(50)')).rows.length,0);
 await db.exec('select internal.queue_daily_subscription_reminders();');
 assert.equal((await db.query('select * from public.telegram_claim_subscription_reminders(50)')).rows.length,0);
 }finally{await db.close();}
});
test('payment from either channel cancels pending reminders and prevents another reminder',async()=>{
 const db=await setup();try{
 await db.exec("select internal.queue_daily_subscription_reminders(); update subscriptions set status='paid' where id='due'; select internal.queue_daily_subscription_reminders();");
 assert.equal((await db.query('select * from public.telegram_claim_subscription_reminders(50)')).rows.length,0);
 assert.ok((await db.query('select status from internal.subscription_telegram_reminders')).rows.every(x=>x.status==='cancelled'));
 assert.equal((await db.query('select read from notifications')).rows[0].read,true);
 }finally{await db.close();}
});
test('disconnected parent and inactive manager cannot receive queued messages',async()=>{
 const db=await setup();try{
 await db.exec("select internal.queue_daily_subscription_reminders(); update telegram_user_links set is_active=false; update staff set status='inactive';");
 assert.equal((await db.query('select * from public.telegram_claim_subscription_reminders(50)')).rows.length,0);
 }finally{await db.close();}
});
test('parent identity remains parent; sensitive queue functions are service-only',async()=>{
 const db=await setup();try{
 await db.exec("select set_config('test.user','11111111-1111-4111-8111-111111111111',false)");
 assert.equal((await db.query('select public.my_telegram_staff_role() role')).rows[0].role,'parent');
 assert.equal((await db.query('select * from internal.telegram_identity(99)')).rows[0].role,'parent');
 assert.equal((await db.query("select has_function_privilege('authenticated','public.telegram_claim_subscription_reminders(integer)','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

test('reminder bookkeeping does not block existing manager replacement of an unpaid draft',async()=>{
 const db=await setup();try{
 await db.exec("select internal.queue_daily_subscription_reminders(); delete from subscriptions where id='due';");
 assert.equal((await db.query('select count(*)::int n from internal.subscription_reminder_days')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from internal.subscription_telegram_reminders')).rows[0].n,0);
 }finally{await db.close();}
});

test('scheduled renewals issue once and pace parent reminders across Bahrain dates',async()=>{
 const db=await setup();try{
  await db.exec(
   "create schema test_clock;" +
   "create function test_clock.now() returns timestamptz language sql stable as $$ select current_setting('test.clock')::timestamptz $$;" +
   "create table cron.job(jobid bigint primary key,jobname text,schedule text,command text,active boolean);" +
   "create or replace function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job values(1,$1,$2,$3,true); select 1::bigint $$;" +
   "create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$ update cron.job set active=$2 where jobid=$1 $$;" +
   "alter table players add column status text not null default 'active';" +
   "alter table subscriptions add column plan_type text not null default 'monthly',add column end_date date;" +
   "create table player_recurring_fees(player_id text primary key,monthly_amount numeric);" +
   "insert into player_recurring_fees values ('p',19.5);" +
   "delete from subscriptions;" +
   "insert into players(id,parent_id,name,status) values('exempt','pa','Exempt','active'),('inactive','pa','Inactive','inactive'),('cancelled','pa','Cancelled','active'),('existing','pa','Existing','active'),('zero','pa','Zero fee','active');" +
   "insert into player_recurring_fees values ('zero',0);" +
   "insert into subscriptions(id,player_id,status,amount,start_date,end_date) values" +
   "('old-paid','p','paid',25,'2026-11-01','2026-11-30')," +
   "('old-exempt','exempt','exempt',0,'2026-11-01','2026-11-30')," +
   "('old-inactive','inactive','paid',25,'2026-11-01','2026-11-30')," +
   "('old-archived','archived','paid',25,'2026-11-01','2026-11-30')," +
   "('old-cancelled','cancelled','cancelled',25,'2026-11-01','2026-11-30')," +
   "('old-zero','zero','paid',25,'2026-11-01','2026-11-30')," +
   "('old-existing','existing','paid',25,'2026-11-01','2026-11-30')," +
   "('already-unpaid','existing','unpaid',25,'2026-12-01','2027-01-01');"
  );
  const setClock=(value)=>db.query("select set_config('test.clock',$1,false)",[value]);
  await setClock('2026-11-30T20:59:00Z');
  const migration=await readFile(new URL('../supabase/migrations/20261114224232_schedule_monthly_renewals_and_parent_reminders.sql',import.meta.url),'utf8');
  await db.exec(migration.replace(/\bnow\(\)/g,'test_clock.now()'));
  const job=(await db.query('select jobname,schedule,command,active from cron.job')).rows[0];
  assert.deepEqual(job,{
   jobname:'automatic-monthly-renewals',schedule:'45 5 * * *',
   command:'select internal.issue_scheduled_monthly_renewals();',active:false,
  });
  for(const role of ['anon','authenticated','service_role']){
   const privileges=(await db.query("select has_function_privilege($1,'internal.issue_scheduled_monthly_renewals()','execute') scheduled,has_function_privilege($1,'internal.issue_player_monthly_renewal(text,date,boolean)','execute') core",[role])).rows[0];
   assert.deepEqual(privileges,{scheduled:false,core:false});
  }
  const run=async()=>(await db.query(job.command)).rows[0].issue_scheduled_monthly_renewals;
  assert.equal(await run(),0);

  // Midnight in Bahrain, while it is still November in UTC.
  await setClock('2026-11-30T21:01:00Z');
  await assert.rejects(db.query("select public.issue_player_monthly_renewal('p','2026-12-01')"),/Manager authorization required/);
  assert.equal(await run(),1);
  assert.equal(await run(),0);
  const issued=(await db.query("select id,player_id,amount::text,start_date::text,status from subscriptions where id like 'sub-renew-%'")).rows;
  assert.equal(issued.length,1);
  const [{id,...renewal}]=issued;
  assert.deepEqual(renewal,{player_id:'p',amount:'19.500',start_date:'2026-12-01',status:'unpaid'});
  assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n,0);

  const queue=()=>db.exec('select internal.queue_daily_subscription_reminders(); select internal.queue_daily_subscription_reminders()');
  await queue();
  await setClock('2026-12-01T21:01:00Z');
  await queue();
  await setClock('2026-12-02T21:01:00Z');
  await queue();
  const appDays=async()=>(await db.query('select reminder_day::text from internal.subscription_reminder_days where subscription_id=$1 order by reminder_day',[id])).rows.map((row)=>row.reminder_day);
  const telegramDays=async(role)=>(await db.query('select reminder_day::text from internal.subscription_telegram_reminders where subscription_id=$1 and recipient_role=$2 order by reminder_day',[id,role])).rows.map((row)=>row.reminder_day);
  assert.deepEqual(await appDays(),['2026-12-01','2026-12-03']);
  assert.deepEqual(await telegramDays('parent'),['2026-12-01','2026-12-03']);
  assert.deepEqual(await telegramDays('manager'),['2026-12-01','2026-12-02','2026-12-03']);
  assert.equal((await db.query("select count(*)::int n from notifications where id like 'due-daily-'||$1||'-%'",[id])).rows[0].n,2);

  await db.query("update subscriptions set status='paid' where id=$1",[id]);
  await setClock('2026-12-04T21:01:00Z');
  await queue();
  assert.deepEqual(await appDays(),['2026-12-01','2026-12-03']);
  assert.equal((await db.query("select count(*)::int n from internal.subscription_telegram_reminders where subscription_id=$1 and status='queued'",[id])).rows[0].n,0);

  await db.exec("select set_config('test.user','22222222-2222-4222-8222-222222222222',false)");
  const existing=(await db.query("select public.issue_player_monthly_renewal('p','2026-12-01') as id")).rows[0].id;
  assert.equal(existing,id);
 }finally{await db.close();}
});
