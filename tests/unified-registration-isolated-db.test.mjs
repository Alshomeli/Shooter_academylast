import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const manager = '10000000-0000-4000-8000-000000000001';
const parent = '10000000-0000-4000-8000-000000000002';
const application = '20000000-0000-4000-8000-000000000001';
const children = ['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002'];

// Real approval/issuance SQL over minimal synthetic tables. This verifies the
// transaction and role boundaries, not hosted Auth, Storage, or the full chain.
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema internal;
    grant usage on schema auth,internal to authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table staff(id text primary key,user_id uuid,role text,status text,name text);
    create function internal.is_academy_admin() returns boolean language sql security definer
      set search_path='' as $$select exists(select 1 from public.staff where user_id=auth.uid()
        and role='manager' and status='active')$$;
    create table parents(id text primary key,name text,national_id text,nationality text,
      phone text,whatsapp_phone text,email text,address text,occupation text,workplace text,
      status text,notes text,joined_date date,user_id uuid);
    create table players(id text primary key,name text,national_id text unique,birth_date date,
      blood_type text,jersey_number int,position text,team_id text,parent_name text,parent_phone text,
      parent_email text,parent_id text references parents(id),status text,notes text,joined_date date);
    create function public.get_parent_private() returns setof public.parents language sql as $$select * from public.parents$$;
    create function public.get_player_identity_private() returns setof public.players language sql as $$select * from public.players$$;
    create table registration_applications(id uuid primary key,applicant_user_id uuid,
      parent_full_name text,parent_national_id text,parent_phone text,parent_whatsapp text,
      parent_email text,parent_nationality text,parent_occupation text,parent_workplace text,
      parent_address text,parent_notes text,status text,reviewed_at timestamptz,
      reviewed_by_staff_id text,approved_parent_id text,updated_at timestamptz);
    create table registration_children(id uuid primary key,application_id uuid references registration_applications(id),
      full_name text,national_id text,birth_date date,blood_type text,parent_notes text,
      approved_player_id text references players(id),created_at timestamptz default now());
    create table registration_documents(child_id uuid,file_category text,approved_player_id text);
    create table registration_child_fees(child_id uuid primary key,monthly_amount numeric not null,
      updated_by uuid,updated_at timestamptz);
    create table subscriptions(id text primary key,player_id text references players(id),plan_type text,
      amount numeric not null,start_date date,end_date date,status text,payment_method text,
      paid_at timestamptz,exemption_reason text);
    create table notifications(id text primary key,title text,message text,timestamp text,
      type text,read boolean,recipient_user_id uuid);
    create table audit_logs(id text primary key,action text,timestamp text,user_role text,user_name text,details text);
    insert into staff values('synthetic-manager','${manager}','manager','active','Synthetic manager');
    insert into registration_applications(id,applicant_user_id,parent_full_name,parent_national_id,
      parent_phone,parent_email,status) values('${application}','${parent}','Synthetic parent',
      'synthetic-parent-id','00000000','parent@example.invalid','pending');
    insert into registration_children(id,application_id,full_name,national_id,birth_date) values
      ('${children[0]}','${application}','Synthetic child A','synthetic-child-a','2015-01-01'),
      ('${children[1]}','${application}','Synthetic child B','synthetic-child-b','2017-01-01');
    insert into registration_documents(child_id,file_category) values
      ('${children[0]}','photo'),('${children[1]}','photo');
  `);
  const approval = await read('20260930065420_remove_telegram_auth_impersonation_from_registration_approval.sql');
  await db.exec(approval.slice(0, approval.indexOf('create or replace function internal.telegram_approve_registration_application')));
  await db.exec(await read('20261002002137_fix_registration_approval_internal_execute.sql'));
  await db.exec(await read('20261028042000_issue_registration_subscription.sql'));
  await db.exec(await read('20261028070000_unified_registration_subscription_decisions.sql'));
  await db.exec(`alter function public.issue_registration_subscription(uuid,text) set schema internal;
    create function public.issue_registration_subscription(uuid,text default null) returns text
    language sql security invoker set search_path='' as $$select internal.issue_registration_subscription($1,$2)$$;
    alter function public.approve_registration_with_subscriptions(uuid,jsonb) set schema internal;
    create function public.approve_registration_with_subscriptions(uuid,jsonb) returns jsonb
    language sql security invoker set search_path='' as $$select internal.approve_registration_with_subscriptions($1,$2)$$;
    revoke all on function public.issue_registration_subscription(uuid,text),
      public.approve_registration_with_subscriptions(uuid,jsonb) from public,anon;
    grant execute on function public.issue_registration_subscription(uuid,text),
      public.approve_registration_with_subscriptions(uuid,jsonb) to authenticated;`);
  const call = async (uid, decisions, role = 'authenticated') => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
    await db.exec(`set role ${role}`);
    try { return await db.query('select public.approve_registration_with_subscriptions($1,$2::jsonb) result',
      [application, JSON.stringify(decisions)]); }
    finally { await db.exec('reset role'); }
  };
  return {db, call};
}
const decisions = () => ({[children[0]]: {amount: 20}, [children[1]]: {amount: 0, reason: 'Synthetic exemption'}});

test('unified approval: siblings receive exact fees; exemption is not recorded as a payment; retry denied', async () => {
  const {db, call} = await fixture();
  try {
    for (const [uid,role] of [[parent,'authenticated'],['','anon']])
      await assert.rejects(call(uid, decisions(), role), e => e.code === '42501');
    const result = (await call(manager, decisions())).rows[0].result;
    assert.equal(result.success, true);
    const subs = (await db.query('select amount,status,payment_method,paid_at,exemption_reason from subscriptions order by amount')).rows;
    assert.deepEqual(subs.map(s => [Number(s.amount),s.status]), [[0,'exempt'],[20,'unpaid']]);
    assert.ok(subs.every(s => s.paid_at === null && s.payment_method === null));
    assert.equal(subs[0].exemption_reason, 'Synthetic exemption');
    assert.equal((await db.query('select count(*)::int n from players')).rows[0].n, 2);
    assert.equal((await db.query("select count(*)::int n from players where status='active'")).rows[0].n, 1);
    const notifications = (await db.query('select count(*)::int n from notifications')).rows[0].n;
    await assert.rejects(call(manager, decisions()), /not awaiting approval/);
    assert.equal((await db.query('select count(*)::int n from subscriptions')).rows[0].n, 2);
    assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n, notifications);
  } finally { await db.close(); }
});

test('unified approval validates all sibling decisions and rolls back a later issuance failure', async () => {
  const {db, call} = await fixture();
  try {
    for (const invalid of [
      {[children[0]]: {amount: 20}},
      {...decisions(), [children[1]]: {amount: 0}},
      {...decisions(), [children[1]]: {amount: -1}},
      {...decisions(), [children[1]]: {amount: 26}},
      {...decisions(), [children[1]]: {amount: '0', reason: 'Forged'}},
      {...decisions(), [children[1]]: {amount: 0.0001}},
    ]) await assert.rejects(call(manager, invalid));
    await db.exec(`create function public.synthetic_fail_second_subscription() returns trigger language plpgsql as $$
      begin if new.id='sub-registration-${children[1]}' then raise exception 'synthetic second child failure'; end if;
      return new; end$$;
      create trigger synthetic_fail_second_subscription before insert on subscriptions
      for each row execute function public.synthetic_fail_second_subscription();`);
    await assert.rejects(call(manager, decisions()), /synthetic second child failure/);
    for (const table of ['parents','players','subscriptions','notifications','audit_logs','registration_child_fees'])
      assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0, table + ' must roll back');
    assert.equal((await db.query('select status from registration_applications')).rows[0].status, 'pending');
    assert.ok((await db.query('select approved_player_id from registration_children')).rows.every(r => r.approved_player_id === null));
    await db.exec('drop trigger synthetic_fail_second_subscription on subscriptions');
    assert.equal((await call(manager, decisions())).rows[0].result.success, true);
  } finally { await db.close(); }
});
