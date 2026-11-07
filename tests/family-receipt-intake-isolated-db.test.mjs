import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('isolated family intake verifies parent, siblings, one period, proof ownership, and duplicate claims',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create schema auth; create schema storage;
   create role anon; create role authenticated;
   create function auth.uid() returns uuid language sql stable as $$select current_setting('test.user_id',true)::uuid$$;
   create table public.parents(id text primary key,user_id uuid);
   create table public.players(id text primary key,parent_id text);
   create table public.subscriptions(id text primary key,player_id text,status text,amount numeric,start_date date,end_date date);
   create table public.payment_proofs(subscription_id text,status text);
   create table public.family_payment_receipts(id uuid primary key default gen_random_uuid(),parent_user_id uuid,
      proof_path text unique,transfer_date date,expected_amount numeric,status text);
   create table public.family_payment_receipt_items(receipt_id uuid,subscription_id text unique,player_id text,amount numeric);
   create table storage.objects(bucket_id text,name text,owner_id text,metadata jsonb);
   select set_config('test.user_id','11111111-1111-4111-8111-111111111111',false);
   insert into parents values('parent-1','11111111-1111-4111-8111-111111111111'),('parent-2','22222222-2222-4222-8222-222222222222');
   insert into players values('p1','parent-1'),('p2','parent-1'),('foreign','parent-2');
   insert into subscriptions values
    ('sub1','p1','unpaid',20,'2026-10-01','2026-11-01'),
    ('sub2','p2','unpaid',15,'2026-10-01','2026-11-01'),
    ('foreign-sub','foreign','unpaid',25,'2026-10-01','2026-11-01');
   insert into storage.objects values
    ('payment-proofs','11111111-1111-4111-8111-111111111111/family/33333333-3333-4333-8333-333333333333.pdf',
    '11111111-1111-4111-8111-111111111111','{"mimetype":"application/pdf","size":"20000"}');
  `);
  const sql=await readFile(new URL('../supabase/migrations/20261018034000_family_receipt_secure_intake.sql',import.meta.url),'utf8');
  await db.exec(sql);
  const proof='11111111-1111-4111-8111-111111111111/family/33333333-3333-4333-8333-333333333333.pdf';
  const send=(ids)=>db.query('select public.submit_family_payment_receipt($1::text[],$2::text,$3::date) as id',[ids,proof,'2026-10-18']);
  await assert.rejects(send(['sub1','foreign-sub']),/not eligible/i);
  await assert.rejects(send(['sub1','sub1']),/Invalid subscription selection/);
  const ok=await send(['sub1','sub2']);assert.ok(ok.rows[0].id);
  assert.equal((await db.query('select count(*)::int n from family_payment_receipt_items')).rows[0].n,2);
  await assert.rejects(send(['sub1','sub2']),/already exists|duplicate key/i);
  assert.equal((await db.query('select count(*)::int n from family_payment_receipts')).rows[0].n,1);
 } finally {await db.close();}
});
