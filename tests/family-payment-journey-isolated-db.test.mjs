import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('isolated family payment journey: approval, activation, receipts, ledger and duplicate prevention', async () => {
 const db = new PGlite();
 try {
  await db.exec(`
   create schema auth;
   create role anon;
   create role authenticated;
   create function auth.uid() returns uuid language sql stable
   as $$ select current_setting('test.user_id', true)::uuid $$;
   create sequence public.payment_receipt_seq;
   create table public.staff(id text primary key,user_id uuid,status text,role text,name text);
   create table public.parents(id text primary key,user_id uuid);
   create table public.players(id text primary key,parent_id text,status text,row_version bigint default 1);
   create table public.registration_children(id uuid primary key,approved_player_id text);
   create table public.subscriptions(id text primary key,player_id text,status text,amount numeric,
     payment_method text,paid_at timestamptz,row_version bigint default 1);
   create table public.payment_proofs(id uuid primary key,subscription_id text,status text);
   create table public.transactions(id text primary key,type text,category text,amount numeric,
     transaction_date date,description text,recorded_by text,subscription_id text,player_id text);
   create table public.notifications(id text primary key,title text,message text,timestamp text,
     type text,read boolean,recipient_user_id uuid);
   create table public.family_payment_receipts(id uuid primary key,parent_user_id uuid,
     status text,expected_amount numeric,reviewed_by text,reviewed_at timestamptz,review_note text);
   create table public.family_payment_receipt_items(receipt_id uuid,subscription_id text,
     player_id text,amount numeric,receipt_number bigint,primary key(receipt_id,subscription_id));
   select set_config('test.user_id','11111111-1111-4111-8111-111111111111',false);
   insert into public.staff values('manager-1','11111111-1111-4111-8111-111111111111','active','manager','Manager');
   insert into public.parents values('parent-1','22222222-2222-4222-8222-222222222222');
   insert into public.players values('player-1','parent-1','inactive',1),('player-2','parent-1','inactive',1);
   insert into public.registration_children values
    ('33333333-3333-4333-8333-333333333333','player-1'),
    ('44444444-4444-4444-8444-444444444444','player-2');
   insert into public.subscriptions(id,player_id,status,amount) values
    ('sub-one','player-1','unpaid',20.000),('sub-two','player-2','unpaid',15.000);
   insert into public.family_payment_receipts values
    ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','pending',35,null,null,null);
   insert into public.family_payment_receipt_items values
    ('55555555-5555-4555-8555-555555555555','sub-one','player-1',20,null),
    ('55555555-5555-4555-8555-555555555555','sub-two','player-2',15,null);
  `);
  const approval = await readFile(new URL('../supabase/migrations/20261018036000_family_receipt_manager_approval.sql', import.meta.url),'utf8');
  await db.exec(approval);
  const id='55555555-5555-4555-8555-555555555555';
  await assert.rejects(db.query('select public.approve_family_payment_receipt($1::uuid,$2::numeric)',[id,34]),/mismatch/i);
  assert.equal((await db.query('select count(*)::int as n from public.transactions')).rows[0].n,0);
  await db.query('select public.approve_family_payment_receipt($1::uuid,$2::numeric)',[id,35]);
  const tx=await db.query('select subscription_id,amount from public.transactions order by subscription_id');
  assert.deepEqual(tx.rows.map(x=>[x.subscription_id,Number(x.amount)]),[['sub-one',20],['sub-two',15]]);
  const subs=await db.query('select status from public.subscriptions');
  assert.ok(subs.rows.every(x=>x.status==='paid'));
  const players=await db.query('select status from public.players');
  assert.ok(players.rows.every(x=>x.status==='active'));
  const items=await db.query('select receipt_number from public.family_payment_receipt_items');
  assert.equal(new Set(items.rows.map(x=>String(x.receipt_number))).size,2);
  assert.equal((await db.query('select count(*)::int as n from public.notifications')).rows[0].n,1);
  await assert.rejects(db.query('select public.approve_family_payment_receipt($1::uuid,$2::numeric)',[id,35]),/not pending/i);
  assert.equal((await db.query('select count(*)::int as n from public.transactions')).rows[0].n,2);
 } finally { await db.close(); }
});
