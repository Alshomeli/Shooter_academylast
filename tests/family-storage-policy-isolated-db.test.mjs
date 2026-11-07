import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('private family receipt storage policy compiles and retains both reference guards',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create schema auth; create schema storage;
   create role anon;create role authenticated;
   create function auth.uid() returns uuid language sql stable
   as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
   create function storage.foldername(text) returns text[] language sql immutable
   as $$select string_to_array($1,'/')$$;
   create table storage.objects(bucket_id text,name text primary key);
   create table public.payment_proofs(proof_path text);
   create table public.family_payment_receipts(proof_path text);
   alter table storage.objects enable row level security;
  `);
  const sql=await readFile(new URL('../supabase/migrations/20261018035000_protect_family_receipt_storage.sql',import.meta.url),'utf8');
  await db.exec(sql);
  const policies=await db.query(`select qual from pg_policies
    where schemaname='storage' and tablename='objects'
    and policyname='payment_proofs_storage_delete_unreferenced'`);
  assert.equal(policies.rows.length,1);
  assert.match(policies.rows[0].qual,/family_payment_receipts/);
  assert.match(policies.rows[0].qual,/payment_proofs/);
 }finally{await db.close();}
});
