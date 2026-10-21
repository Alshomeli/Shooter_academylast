import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migration=await readFile(new URL('../supabase/migrations/20261021025345_link_telegram_payment_approval.sql',import.meta.url),'utf8');
const proof='11111111-1111-4111-8111-111111111111';
async function setup(){
 const db=new PGlite();
 await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema internal; create schema auth;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create table staff(id text primary key,user_id uuid,status text,role text,name text);
 create table subscriptions(id text primary key,player_id text,status text,amount numeric,payment_method text,paid_at timestamptz,row_version bigint default 1);
 create table payment_proofs(id uuid primary key,subscription_id text,player_id text,parent_user_id uuid,amount numeric,status text,receipt_number bigint,reviewed_by text,reviewed_at timestamptz,updated_at timestamptz,row_version bigint default 1);
 create table transactions(id text primary key,type text,category text,amount numeric,transaction_date date,description text,recorded_by text,subscription_id text,player_id text);
 create table notifications(id text primary key,title text,message text,timestamp text,type text,read boolean,recipient_user_id uuid);
 create sequence payment_receipt_seq;
 create table internal.telegram_manager_bindings(chat_id_hash text,staff_id text,active boolean);
 create table internal.telegram_admin_actions(chat_id_hash text,staff_id text,action text,entity_type text,entity_id uuid);
 insert into staff values('m','22222222-2222-4222-8222-222222222222','active','manager','Manager'),('c','33333333-3333-4333-8333-333333333333','active','coach','Coach');
 insert into internal.telegram_manager_bindings values('manager-hash','m',true),('coach-hash','c',true);
 insert into subscriptions(id,player_id,status,amount) values('s','p','unpaid',25);
 insert into payment_proofs(id,subscription_id,player_id,amount,status) values('${proof}','s','p',25,'pending');
 select set_config('test.user','22222222-2222-4222-8222-222222222222',false);
 `);
 await db.exec(migration);return db;
}
for(const first of ['platform','telegram'])test(`${first} approval followed by other channel creates exactly one receipt and transaction`,async()=>{
 const db=await setup();try{
 const platform=()=>db.query('select internal.approve_payment_proof_impl($1)',[proof]);
 const telegram=()=>db.query('select public.telegram_approve_payment_proof($1,$2) as result',[proof,'manager-hash']);
 if(first==='platform'){await platform();assert.equal((await telegram()).rows[0].result.alreadyProcessed,true);}
 else{assert.equal((await telegram()).rows[0].result.success,true);await platform();}
 assert.equal((await telegram()).rows[0].result.alreadyProcessed,true);
 assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,1);
 assert.equal((await db.query('select last_value from payment_receipt_seq')).rows[0].last_value,1);
 assert.equal((await db.query('select status from subscriptions')).rows[0].status,'paid');
 }finally{await db.close();}
});
test('unbound and coach chats cannot approve; privileged helper is not callable by clients',async()=>{
 const db=await setup();try{
 for(const hash of ['unknown','coach-hash'])await assert.rejects(db.query('select public.telegram_approve_payment_proof($1,$2)',[proof,hash]),/not authorized/);
 assert.equal((await db.query("select has_function_privilege('authenticated','internal.approve_payment_proof_as_staff(uuid,text)','EXECUTE') allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.telegram_approve_payment_proof(uuid,text)','EXECUTE') allowed")).rows[0].allowed,false);
 assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,0);
 }finally{await db.close();}
});
test('platform direct settlement makes stale Telegram approval harmless',async()=>{
 const db=await setup();try{
 await db.exec("update subscriptions set status='paid';");
 const r=await db.query('select public.telegram_approve_payment_proof($1,$2) result',[proof,'manager-hash']);
 assert.equal(r.rows[0].result.alreadyProcessed,true);
 assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,0);
 }finally{await db.close();}
});
