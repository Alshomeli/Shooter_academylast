import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration=readFileSync(new URL('../supabase/migrations/20261022125000_academy_parent_reviews.sql',import.meta.url),'utf8');
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const id='33333333-3333-4333-8333-333333333333';
test('isolated parent review RLS accepts active guardian and blocks unapproved users',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth; create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
   create table public.parents(user_id uuid,status text);
   create table public.staff(user_id uuid,role text,status text);
   grant usage on schema public,auth to authenticated;
   grant select on public.parents,public.staff to authenticated;
   insert into auth.users values ('${a}'),('${b}');
   insert into public.parents values ('${a}','active'),('${b}','pending');
  `.replaceAll("''","'"));
  await db.exec(migration);
  // Authenticate as a guardian but prevent role escalation by running SQL as the authenticated role.
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
  await db.exec(`insert into public.academy_parent_reviews(parent_user_id,display_name,quote,rating,publication_consent)
    values ('${a}','Guardian','A genuine sample review for isolated role testing.',5,true);`);
  await assert.rejects(db.exec(`insert into public.academy_parent_reviews(parent_user_id,display_name,quote,rating,publication_consent)
    values ('${b}','Other','Attempt to spoof a different guardian identity.',5,true);`));
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
  await assert.rejects(db.exec(`insert into public.academy_parent_reviews(parent_user_id,display_name,quote,rating,publication_consent)
    values ('${b}','Pending','Pending guardian must not be allowed to send this.',5,true);`));
  await assert.rejects(db.exec('select * from public.manager_review_parent_reviews();'));
  await assert.rejects(db.exec(`select public.manager_approve_parent_review('${id}',true);`));
  await db.exec('reset role;');
 } finally {await db.close();}
});
