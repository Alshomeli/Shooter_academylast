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
 `);await db.exec(sql);
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
