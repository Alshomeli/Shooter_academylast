import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const migrationPath = 'supabase/migrations/20261011035703_attendance_match_identity_rpc.sql';
const db = new PGlite(); // In-memory PostgreSQL only; no network/project credentials.
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async n => {
  await db.exec('reset role');
  await db.query("select set_config('test.uid', $1, false)", [n ? uid(n) : '']);
  await db.exec('set role authenticated');
};
const record = (player = 'p1', type = 'match', match = 'm1', training = null, status = 'present', date = '2026-10-11') =>
  db.query('select * from public.record_attendance_entry($1,$2,$3,$4,$5,$6,$7)',
    [player, date, type, status, 'test note', training, match]);
const count = async () => {
  await db.exec('reset role');
  return (await db.query('select count(*)::int n from public.attendance')).rows[0].n;
};

before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema internal;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid', true),'')::uuid$$;
    grant usage on schema public,auth,internal to anon,authenticated;`);
  await db.exec(await read('tests/fixtures/live-tables.sql'));
  await db.exec(await read('tests/fixtures/live-constraints.sql'));
  await db.exec(await read('supabase/migrations/20260915033418_bind_authorization_strictly_to_auth_user_id.sql'));
  await db.exec(await read('supabase/migrations/20260914235227_normalize_attendance_date_and_trigger.sql'));
  await db.exec(`create unique index uq_attendance_training_player on public.attendance(training_id,player_id)
    where training_id is not null and player_id is not null;
    create unique index attendance_unique_player_session on public.attendance
      (player_id,session_date,session_type,coalesce(training_id,''));
    insert into auth.users values ('${uid(1)}','manager@example.invalid'),('${uid(2)}','coach@example.invalid'),
      ('${uid(3)}','parent@example.invalid'),('${uid(4)}','inactive@example.invalid'),('${uid(5)}','accountant@example.invalid');
    insert into public.staff(id,user_id,name,email,role,status,joined_date) values
      ('manager','${uid(1)}','Manager','manager@example.invalid','manager','active','2026-01-01'),
      ('coach','${uid(2)}','Coach','coach@example.invalid','coach','active','2026-01-01'),
      ('inactive','${uid(4)}','Inactive','inactive@example.invalid','coach','inactive','2026-01-01'),
      ('accountant','${uid(5)}','Accountant','accountant@example.invalid','accountant','active','2026-01-01');
    insert into public.parents(id,user_id,name,joined_date) values ('parent','${uid(3)}','Parent','2026-01-01');
    insert into public.teams(id,name,coach_id) values ('t1','Team 1','coach'),('t2','Team 2','inactive');
    insert into public.players(id,name,birth_date,joined_date,parent_id,team_id) values
      ('p1','Player 1','2015-01-01','2026-01-01','parent','t1'),('p2','Player 2','2015-01-01','2026-01-01',null,'t2');
    insert into public.trainings(id,team_id,session_date) values ('training-1','t1','2026-10-11'),('training-2','t1','2026-10-11');
    insert into public.matches(id,team_id,match_date) values ('m1','t1','2026-10-11'),('m2','t1','2026-10-11'),('m3','t2','2026-10-11');
    insert into public.attendance(id,player_id,session_date,session_type,status) values ('legacy','p1','2026-10-10','match','present');
    alter table public.attendance enable row level security;`);
  // Exercise the actual old RPC body. The historical export lacks terminators
  // between top-level statements, so extract only this complete function here.
  const original = await read('supabase/migrations/20260926095644_ai_attendance_operation.sql');
  const match = original.match(/create or replace function internal\.record_attendance_entry_impl[\s\S]*?\$\$;?\s*\n\s*create or replace function public/);
  assert.ok(match, 'Historical attendance RPC definition must be present');
  const body = match[0].slice(0, match[0].lastIndexOf('create or replace function public')).trim();
  await db.exec(body.replace(/;+$/, '') + ';');
});
after(() => db.close());

test('reproduces PR 117 index-only RPC failure, then migrates without changing historical rows', async () => {
  const columns = await db.query("select data_type from information_schema.columns where table_name='attendance' and column_name='match_id'");
  assert.equal(columns.rows.length, 0, 'baseline fixture lacks match_id');
  // PR 117 by itself assumes match_id exists and leaves the old conflict target.
  await db.exec(`alter table public.attendance add column match_id text;
    drop index public.attendance_unique_player_session;
    create unique index attendance_unique_player_session on public.attendance
      (player_id,session_date,session_type,coalesce(training_id,''),coalesce(match_id,''));`);
  await asUser(1);
  await assert.rejects(db.query("select internal.record_attendance_entry_impl('p1','2026-10-11','training','present',null,null)"),
    /no unique or exclusion constraint matching the ON CONFLICT specification/);
  await db.exec('reset role');
  const beforeRows = (await db.query('select * from attendance order by id')).rows;
  await db.exec(await read(migrationPath));
  assert.deepEqual((await db.query('select * from attendance order by id')).rows, beforeRows);
  assert.equal((await db.query("select data_type from information_schema.columns where table_name='attendance' and column_name='match_id'")).rows[0].data_type, 'text');
  assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='record_attendance_entry'")).rows[0].n, 1);
});

test('actual authenticated RPC records two distinct matches and retries update exactly one row', async () => {
  await asUser(1);
  const a = (await record()).rows[0];
  const b = (await record('p1', 'match', 'm2')).rows[0];
  assert.notEqual(a.id, b.id);
  assert.equal(a.match_id, 'm1'); assert.equal(b.match_id, 'm2');
  const retry = (await record('p1', 'match', 'm1', null, 'absent')).rows[0];
  assert.equal(retry.id, a.id); assert.equal(retry.status, 'absent');
  assert.equal(await count(), 3);
});

test('direct inserts reject duplicate linked matches and preserve per-training uniqueness', async () => {
  await db.exec('reset role');
  await assert.rejects(db.exec("insert into attendance(id,player_id,session_date,session_type,match_id) values('duplicate','p1','2026-10-11','match','m1')"), /duplicate key/);
  await asUser(1);
  const a = (await record('p1', 'training', null, 'training-1')).rows[0];
  const retry = (await record('p1', 'training', null, 'training-1', 'excused')).rows[0];
  assert.equal(a.id, retry.id); assert.equal(retry.status, 'excused');
  await record('p1', 'training', null, 'training-2');
  await db.exec('reset role');
  await assert.rejects(db.exec("insert into attendance(id,player_id,session_date,training_id) values('dup-training','p1','2026-10-11','training-1')"), /duplicate key/);
  assert.equal(await count(), 5);
});

test('linked match checks reject wrong dates, teams, missing matches and mixed session types', async () => {
  const previous = await count();
  await asUser(1);
  await assert.rejects(record('p1', 'match', 'm1', null, 'present', '2026-10-12'), /linked match date/);
  await assert.rejects(record('p1', 'match', 'm3'), /match team/);
  await assert.rejects(record('p1', 'match', 'missing'), /valid match/);
  await assert.rejects(record('p1', 'match', 'm1', 'training-1'), /session type/);
  await assert.rejects(record('p1', 'training', 'm1'), /session type/);
  await assert.rejects(record('p1', null, null), /Invalid session type/);
  await assert.rejects(record('p1', 'match', 'm1', null, null), /Invalid attendance status/);
  await db.exec('reset role');
  await assert.rejects(db.exec("insert into attendance(id,player_id,session_date,session_type,match_id) values('bad-direct','p2','2026-10-11','match','m1')"), /match team/);
  assert.equal(await count(), previous);
});

test('coach is restricted to own team; parent, accountant, inactive, unknown and anonymous are denied', async () => {
  await asUser(2); await record();
  await assert.rejects(record('p2', 'match', 'm3'), /own team/);
  const previous = await count();
  for (const user of [3,4,5,99,0]) {
    await asUser(user);
    await assert.rejects(record(), /Only manager or coach|Authentication required/);
    await assert.rejects(db.query("select internal.record_attendance_entry_impl('p1','2026-10-11')"), /Only manager or coach|Authentication required/);
  }
  await db.exec('reset role; set role anon');
  await assert.rejects(record(), /permission denied/);
  await assert.rejects(db.query("select internal.record_attendance_entry_impl('p1','2026-10-11')"), /permission denied/);
  assert.equal(await count(), previous);
});

test('six-argument training and unlinked legacy callers remain compatible and idempotent', async () => {
  await asUser(1);
  const sql = "select * from public.record_attendance_entry('p1','2026-10-12','training','present',null,null)";
  const first = (await db.query(sql)).rows[0];
  assert.equal((await db.query(sql)).rows[0].id, first.id);
  const legacy = (await record('p1', 'match', null, null, 'excused', '2026-10-10')).rows[0];
  assert.equal(legacy.id, 'legacy'); assert.equal(legacy.match_id, null);
});

test('migration handles an absent match_id and rejects a mismatched type atomically', async () => {
  const isolated = new PGlite();
  try {
    await isolated.exec(`create role anon; create role authenticated; create schema internal;
      create table matches(id text primary key, team_id text, match_date date);
      create table players(id text primary key, team_id text);
      create table attendance(id text primary key,player_id text,session_date date,session_type text,
        training_id text,status text,notes text,match_id uuid);`);
    await assert.rejects(isolated.exec(await read(migrationPath)), /must both be text/);
    await isolated.exec('rollback');
    assert.equal((await isolated.query("select data_type from information_schema.columns where table_name='attendance' and column_name='match_id'")).rows[0].data_type, 'uuid');
    await isolated.exec('alter table attendance drop column match_id');
    await isolated.exec(await read(migrationPath));
    assert.equal((await isolated.query("select data_type from information_schema.columns where table_name='attendance' and column_name='match_id'")).rows[0].data_type, 'text');
  } finally { await isolated.close(); }
});
