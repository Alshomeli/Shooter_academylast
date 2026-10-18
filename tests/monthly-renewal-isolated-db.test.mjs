import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('monthly renewal SQL runs on isolated PostgreSQL, with manager guard, price and no duplicates',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 create schema auth;
 create role anon;
 create role authenticated;
 create function auth.uid() returns uuid language sql stable
 as $$ select current_setting('test.user_id',true)::uuid $$;
 `);
 await db.exec(`
 create table public.staff(id text primary key,user_id uuid,status text,role text);
 create table public.players(id text primary key,status text,parent_id text);
 create table public.parents(id text primary key,user_id uuid);
 create table public.player_recurring_fees(player_id text primary key,monthly_amount numeric);
 create table public.subscriptions(id text primary key,player_id text,plan_type text,amount numeric,start_date date,end_date date,status text);
 create table public.notifications(id text primary key,title text,message text,timestamp text,type text,read boolean,recipient_user_id uuid);
 `);
 const today=(await db.query("select (now() at time zone 'Asia/Bahrain')::date::text as d")).rows[0].d;
 await db.exec(`select set_config('test.user_id','11111111-1111-4111-8111-111111111111',false);
 insert into staff values('manager-1','11111111-1111-4111-8111-111111111111','active','manager');
 insert into parents values('parent-1','22222222-2222-4222-8222-222222222222');
 insert into players values('player-1','active','parent-1');
 insert into player_recurring_fees values('player-1',19.5);
 `);
 const renewalSql=await readFile(new URL('../supabase/migrations/20261018039000_issue_monthly_renewal.sql',import.meta.url),'utf8');
 await db.exec(renewalSql);
 const first=await db.query('select public.issue_player_monthly_renewal($1,$2::date) as id',['player-1',today]);
 const second=await db.query('select public.issue_player_monthly_renewal($1,$2::date) as id',['player-1',today]);
 assert.equal(first.rows[0].id,second.rows[0].id);
 const subs=await db.query("select amount,status from subscriptions where player_id='player-1'");
 assert.equal(subs.rows.length,1);
 assert.equal(Number(subs.rows[0].amount),19.5);
 assert.equal(subs.rows[0].status,'unpaid');
 const notice=await db.query('select * from notifications');
 assert.equal(notice.rows.length,1);
 await db.exec("select set_config('test.user_id','33333333-3333-4333-8333-333333333333',false)");
 await assert.rejects(db.query('select public.issue_player_monthly_renewal($1,$2::date)',['player-1',today]),/Manager authorization required/);
 } finally{await db.close();}
});
