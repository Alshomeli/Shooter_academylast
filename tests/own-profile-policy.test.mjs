import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('inactive user reads only own profile and cannot update or gain roles', async () => {
 const db = new PGlite();
 try {
 await db.exec(`
 create role authenticated;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
 grant usage on schema auth to authenticated;
 create table staff (id text, user_id uuid, status text);
 create table parents (id text, user_id uuid, status text);
 alter table staff enable row level security;
 alter table parents enable row level security;
 grant select,update on staff,parents to authenticated;
 insert into staff values ('self','00000000-0000-0000-0000-000000000001','inactive'),('other','00000000-0000-0000-0000-000000000002','active');
 insert into parents select * from staff;
 `);
 await db.exec(readFileSync('supabase/migrations/20261020060532_fix_own_inactive_profile_read.sql','utf8'));
 await db.exec("set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';");
 for (const table of ['staff','parents']) {
  assert.deepEqual((await db.query('select id,status from '+table)).rows,[{id:'self',status:'inactive'}]);
  assert.equal((await db.query("update "+table+" set status='active' returning id")).rows.length,0);
 }
 } finally { await db.close(); }
});
