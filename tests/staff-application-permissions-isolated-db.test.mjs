import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// In-memory PostgreSQL only: no Docker, pg_cron, network, or real identities.
const source = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const uidA = '10000000-0000-0000-0000-000000000001';
const uidB = '10000000-0000-0000-0000-000000000002';
const uidManager = '10000000-0000-0000-0000-000000000003';

test('staff RPC internal grants: reproduce denied access, repair, and preserve authorization', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create schema internal;
      grant usage on schema auth, internal to authenticated;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      create table public.staff (
        id text primary key, user_id uuid unique, name text, email text,
        phone text, role text, salary numeric, specialization text, status text,
        joined_date date, avatar_url text, national_id text, licenses text[],
        experience_years integer, rating numeric, tactical_style text, notes text
      );
      create function internal.is_academy_admin() returns boolean
        language sql security definer set search_path='' as $$
          select exists(select 1 from public.staff
            where user_id=auth.uid() and role='manager' and status='active')
        $$;
      insert into auth.users values
        ('${uidA}','staff-a@example.invalid'),
        ('${uidB}','staff-b@example.invalid'),
        ('${uidManager}','manager@example.invalid');
      insert into public.staff(id,user_id,role,status)
        values ('fixture-manager','${uidManager}','manager','active');
      -- Same restrictive defaults established by the earlier hardening migration.
      alter default privileges in schema public revoke execute on functions from public;
      alter default privileges in schema internal revoke execute on functions from public;
    `);
    await db.exec(await source('20260930020528_create_staff_application_workflow.sql'));
    await db.exec(await source('20260930020957_fix_staff_application_review_rpc.sql'));
    const asUser = async (uid, sql) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
      await db.exec('set role authenticated');
      try { return await db.query(sql); }
      finally { await db.exec('reset role'); }
    };
    const create = "select id from public.create_or_update_staff_application('coach','Synthetic Applicant','00000000')";
    await assert.rejects(asUser(uidA, create),
      e => e.code === '42501' && /internal|create_or_update_staff_application/i.test(e.message));
    assert.equal((await db.query('select count(*)::int n from public.staff_applications')).rows[0].n, 0);

    const repair = await source('20261029035926_restore_staff_application_internal_execute.sql');
    await db.exec(repair);
    await db.exec(repair); // Upgrade is safe when production already has the grant.
    const acl = await db.query(`
      select n.nspname,p.proname,p.prosecdef,
        has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,
        has_function_privilege('anon',p.oid,'execute') anon_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','internal') and p.proname in (
        'create_or_update_staff_application','submit_staff_application',
        'review_staff_application','approve_staff_application')
    `);
    assert.equal(acl.rows.length, 8);
    for (const row of acl.rows) {
      assert.equal(row.authenticated_execute, true);
      assert.equal(row.anon_execute, false);
      assert.equal(row.prosecdef, row.nspname === 'internal');
    }
    const id = (await asUser(uidA, create)).rows[0].id;
    assert.equal((await asUser(uidA, create)).rows[0].id, id, 'Draft save must reuse application');
    await assert.rejects(asUser(uidB, `select public.submit_staff_application('${id}')`),
      /Application not found/);
    assert.equal((await asUser(uidB, 'select * from public.staff_applications')).rows.length, 0,
      'RLS must hide another applicant');
    await asUser(uidA, `select public.submit_staff_application('${id}')`);
    await assert.rejects(asUser(uidA, `select public.approve_staff_application('${id}')`),
      /Manager authorization required/);
    await assert.rejects(asUser(uidA, `select public.review_staff_application('${id}','rejected','forged')`),
      /Manager authorization required/);
    await asUser(uidManager, `select public.review_staff_application('${id}','needs_info','More details')`);
    await asUser(uidA, create);
    await asUser(uidA, `select public.submit_staff_application('${id}')`);
    await asUser(uidManager, `select public.approve_staff_application('${id}')`);
    await assert.rejects(asUser(uidManager, `select public.approve_staff_application('${id}')`),
      /Only pending applications/);
    assert.equal((await db.query("select count(*)::int n from public.staff where user_id=$1", [uidA])).rows[0].n, 1);
    assert.equal((await db.query("select status from public.staff_applications where id=$1", [id])).rows[0].status, 'approved');
    await db.exec('set role anon');
    try { await assert.rejects(db.query(create), e => e.code === '42501'); }
    finally { await db.exec('reset role'); }
  } finally { await db.close(); }
});

