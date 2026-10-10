import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const seeded = '00000000-0000-4000-8000-00000000f001';
const keeper = '00000000-0000-4000-8000-00000000f002';

const as = async role => {
  await db.exec('reset role');
  if (role) await db.exec(`set role ${role}`);
};
const row = async (sql, params = []) => (await db.query(sql, params)).rows[0];

before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema internal; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create table storage.objects(bucket_id text, name text, metadata jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema public, auth, internal to anon, authenticated, service_role;
  `);
  await db.exec(await read('tests/fixtures/live-tables.sql'));
  await db.exec(await read('tests/fixtures/live-constraints.sql'));
  // Mirror the Supabase platform defaults: service_role owns no tables but is
  // granted everything on public, and auth.users is writable by it.
  await db.exec(`grant all on all tables in schema public to service_role;
    grant all on table auth.users to service_role;`);
  await db.exec(await read('supabase/migrations/20261009090000_stress_test_monitoring.sql'));

  // Two auth users: one seeded throwaway, one real account that must survive.
  await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [
    seeded, 'student_1@shooter-academy.com',
    keeper, 'manager@shooter-academy.com',
  ]);
  await db.query(
    `insert into public.parents(id,name,email,status,joined_date,user_id)
     values ('parent-seed','Student Test 1','student_1@shooter-academy.com','active',now(),$1),
            ('parent-real','Real Parent','parent@shooter-academy.com','active',now(),$2)`,
    [seeded, keeper],
  );
  await db.query(
    `insert into public.staff(id,name,email,phone,role,status,joined_date,user_id)
     values ('staff-seed','Student Test 2','student_2@shooter-academy.com','0000000','coach','active',now(),$1)`,
    [seeded],
  );
});

test('performance_audit_logs denies anon and authenticated even though RLS has no policies', async () => {
  await as('service_role');
  await db.query(
    `insert into public.performance_audit_logs(action_name,duration_ms) values ('login',120),('login',180)`,
  );

  await as('authenticated');
  await assert.rejects(
    () => db.query('select count(*) from public.performance_audit_logs'),
    /permission denied for table performance_audit_logs/,
  );
  await as('anon');
  await assert.rejects(
    () => db.query('select count(*) from public.performance_audit_logs'),
    /permission denied for table performance_audit_logs/,
  );
  await as(null);
});

test('purge_performance_audit_logs only removes rows past the retention window', async () => {
  await as('service_role');
  await db.query(
    `insert into public.performance_audit_logs(action_name,duration_ms,recorded_at)
     values ('login',90, now() - interval '30 days')`,
  );
  const purged = await row('select public.purge_performance_audit_logs(interval \'7 days\') as removed');
  assert.equal(purged.removed, 1);
  const remaining = await row('select count(*)::int as total from public.performance_audit_logs');
  assert.equal(remaining.total, 2);
  await as(null);
});

test('teardown functions are not executable by authenticated clients', async () => {
  await as('authenticated');
  await assert.rejects(
    () => db.query(`select public.clean_stress_test_accounts('student_%@shooter-academy.com')`),
    /permission denied for function clean_stress_test_accounts/,
  );
  await as(null);
});

test('clean_stress_test_accounts clears public rows first and leaves auth users alone by default', async () => {
  await as('service_role');
  const summary = await row(
    `select public.clean_stress_test_accounts('student_%@shooter-academy.com') as s`,
  );
  assert.equal(summary.s.parents, 1);
  assert.equal(summary.s.staff, 1);
  assert.equal(summary.s.auth_users, 0);

  const authRows = await row('select count(*)::int as total from auth.users');
  assert.equal(authRows.total, 2, 'auth users must survive unless delete_auth_users is set');

  const kept = await row(
    `select count(*)::int as total from public.parents where user_id is not null`,
  );
  assert.equal(kept.total, 1, 'the real parent row must not be touched');

  // The seeded rows are gone entirely, not orphaned with a nulled user_id.
  const orphans = await row(
    `select count(*)::int as total from public.parents where user_id is null`,
  );
  assert.equal(orphans.total, 0);
  await as(null);
});

test('clean_stress_test_accounts removes auth users when asked to', async () => {
  await as('service_role');
  const summary = await row(
    `select public.clean_stress_test_accounts('student_%@shooter-academy.com', true) as s`,
  );
  assert.equal(summary.s.auth_users, 1);
  const remaining = await row(
    `select email from auth.users where id = $1`,
    [seeded],
  );
  assert.equal(remaining, undefined);
  const keeperRow = await row(`select email from auth.users where id = $1`, [keeper]);
  assert.equal(keeperRow.email, 'manager@shooter-academy.com');
  await as(null);
});
