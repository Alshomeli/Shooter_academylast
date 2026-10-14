import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration=readFileSync(new URL('../supabase/migrations/20261014185958_manager_public_content.sql',import.meta.url),'utf8');
test('public snapshots keep drafts private; publishing requires active manager and matching version',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create schema internal; create schema storage;
      create table auth.users(id uuid primary key);
      insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.staff(user_id uuid, role text, status text);
      insert into public.staff values('00000000-0000-4000-8000-000000000001','manager','active'),('00000000-0000-4000-8000-000000000002','coach','active');
      create function internal.has_role(roles text[]) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.staff where user_id=auth.uid() and status='active' and role=any(roles))$$;
      grant usage on schema public,auth,internal,storage to anon,authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
    `);
    await db.exec(migration);
    const id='00000000-0000-4000-8000-000000000010';
    await db.exec(`set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
      insert into public.academy_content_drafts(id,kind,payload) values('${id}','news','{"title":"draft only","body":"private"}');`);
    await db.exec('reset role; set role anon;');
    assert.equal((await db.query(`select * from public.academy_content_public where id='${id}'`)).rows.length,0);
    await assert.rejects(db.query('select * from public.academy_content_drafts'),/permission denied/);
    await assert.rejects(db.query('select * from public.academy_content_revisions'),/permission denied/);
    await assert.rejects(db.query(`select public.publish_academy_content('${id}',1,true)`),/permission denied/);
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';`);
    assert.equal((await db.query('select * from public.academy_content_drafts')).rows.length,0);
    await assert.rejects(db.query(`select public.publish_academy_content('${id}',1,true)`),/Manager access required/);
    await db.exec(`set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';`);
    await db.query(`select public.publish_academy_content('${id}',1,true)`);
    await db.query(`update public.academy_content_drafts set payload='{"title":"edited private"}' where id='${id}' and version=2`);
    assert.equal((await db.query(`select payload->>'title' as title from public.academy_content_public where id='${id}'`)).rows[0].title,'draft only');
    await assert.rejects(db.query(`select public.publish_academy_content('${id}',2,true)`),/Content changed/);
    await db.query(`select public.publish_academy_content('${id}',3,false)`);
    assert.equal((await db.query(`select * from public.academy_content_public where id='${id}'`)).rows.length,0);
    const history=(await db.query(`select version,action,changed_by from public.academy_content_revisions where content_id='${id}' order by version`)).rows;
    assert.deepEqual(history.map(h=>h.action),['created','published','saved','hidden']);
    assert.ok(history.every(h=>h.changed_by==='00000000-0000-4000-8000-000000000001'));
    await assert.rejects(db.query(`delete from public.academy_content_revisions`),/permission denied/);
    // Private uploads are unreadable to visitors until referenced by a published item.
    await db.query(`insert into storage.objects(bucket_id,name) values('academy-content','private.jpg'),('academy-content','visible.jpg')`);
    await db.query(`update public.academy_content_drafts set payload='{"title":"image news","image_path":"visible.jpg"}' where id='${id}'`);
    await db.query(`select public.publish_academy_content('${id}',5,true)`);
    await db.exec('reset role; set role anon;');
    assert.deepEqual((await db.query(`select name from storage.objects where bucket_id='academy-content'`)).rows.map(r=>r.name),['visible.jpg']);
    await db.exec(`reset role; update public.staff set status='inactive' where role='manager'; set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';`);
    await assert.rejects(db.query(`select public.publish_academy_content('${id}',6,true)`),/Manager access required/);
  } finally {await db.close();}
});
