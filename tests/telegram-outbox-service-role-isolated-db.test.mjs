import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const directory = new URL('../supabase/migrations/', import.meta.url);
const source = name => readFile(new URL(name, directory), 'utf8');

test('Telegram service-role outbox calls work under SECURITY DEFINER; browser roles remain denied', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema internal;
      create table public.registration_applications(id uuid primary key, parent_full_name text,
        submitted_at timestamptz default now(), status text);
      create table public.login_audit_logs(id text primary key,action text,user_role text,
        user_name text,details text,timestamp text);
      create table internal.telegram_staff_application_outbox(status text,attempts int);
    `);
    await db.exec(await source('20260930050824_telegram_registration_outbox.sql'));
    await db.exec(await source('20261018143155_telegram_login_notifications_outbox.sql'));
    const callAs = async (role, sql) => {
      await db.exec(`set role ${role}`);
      try { return await db.query(sql); }
      finally { await db.exec('reset role'); }
    };
    await assert.rejects(callAs('service_role',
      'select * from public.telegram_claim_registration_notifications(10)'),
      e => e.code === '42501' && /service role required/.test(e.message));
    const file = (await readdir(directory)).find(n => n.endsWith('_repair_telegram_outbox_service_role_and_login_join.sql'));
    assert.ok(file, 'Forward-only repair must exist');
    const repair = await source(file);
    await db.exec(repair);
    await db.exec(repair);
    const registrationId = '10000000-0000-4000-8000-000000000001';
    await db.query(`insert into public.registration_applications(id,parent_full_name,status)
      values ($1,'Synthetic parent','pending')`, [registrationId]);
    await db.exec(`insert into public.login_audit_logs values
      ('audit-synthetic-login','login','coach','Synthetic coach','Synthetic login','2026-10-29');`);
    const registrations = await callAs('service_role',
      'select * from public.telegram_claim_registration_notifications(10)');
    assert.equal(registrations.rows.length, 1);
    assert.equal(registrations.rows[0].application_id, registrationId);
    assert.equal((await callAs('service_role',
      'select * from public.telegram_claim_registration_notifications(10)')).rows.length, 0);
    await callAs('service_role', `select public.telegram_finish_registration_notification('${registrationId}',true,null)`);
    assert.equal((await db.query('select status from internal.telegram_registration_outbox')).rows[0].status, 'sent');
    const logins = await callAs('service_role', 'select * from public.telegram_claim_login_notifications(10)');
    assert.equal(logins.rows.length, 1, 'Outbox UUID must join through login_audit_id, not audit text id');
    assert.equal(logins.rows[0].audit_user_name, 'Synthetic coach');
    assert.equal((await callAs('service_role', 'select * from public.telegram_claim_login_notifications(10)')).rows.length, 0);
    const outboxId = logins.rows[0].outbox_id;
    await callAs('service_role', `select public.telegram_finish_login_notification('${outboxId}',false,'synthetic retry')`);
    assert.equal((await callAs('service_role', 'select * from public.telegram_claim_login_notifications(10)')).rows.length, 1);
    await callAs('service_role', `select public.telegram_finish_login_notification('${outboxId}',true,null)`);
    assert.equal((await db.query('select status from internal.telegram_login_outbox')).rows[0].status, 'sent');
    for (const role of ['anon', 'authenticated']) {
      for (const sql of [
        'select * from public.telegram_claim_registration_notifications(10)',
        'select * from public.telegram_claim_login_notifications(10)',
        `select public.telegram_finish_registration_notification('${registrationId}',true,null)`,
        `select public.telegram_finish_login_notification('${outboxId}',true,null)`,
      ]) await assert.rejects(callAs(role, sql), e => e.code === '42501');
    }
    // Even if an unrelated role were accidentally granted EXECUTE later, the
    // session-role guard still denies it inside the privileged function.
    await db.exec('grant execute on function public.telegram_claim_login_notifications(integer) to authenticated');
    await assert.rejects(callAs('authenticated', 'select * from public.telegram_claim_login_notifications(10)'),
      e => e.code === '42501' && /service role required/.test(e.message));
    await db.exec(repair);
    const acl = await db.query(`select p.proname,
      has_function_privilege('service_role',p.oid,'execute') as backend,
      has_function_privilege('authenticated',p.oid,'execute') as browser
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in
      ('telegram_claim_registration_notifications','telegram_finish_registration_notification',
       'telegram_claim_login_notifications','telegram_finish_login_notification')`);
    assert.equal(acl.rows.length, 4);
    assert.ok(acl.rows.every(r => r.backend && !r.browser));
  } finally { await db.close(); }
});
