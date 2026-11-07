import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../supabase/migrations/', import.meta.url);
const read = name => readFile(new URL(name, dir), 'utf8');
const manager = '10000000-0000-4000-8000-000000000001';
const accountant = '10000000-0000-4000-8000-000000000002';
const parentA = '10000000-0000-4000-8000-000000000003';
const parentB = '10000000-0000-4000-8000-000000000004';
const proof = '20000000-0000-4000-8000-000000000001';
const refund = '30000000-0000-4000-8000-000000000001';
const cancel = '40000000-0000-4000-8000-000000000001';

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema internal; create schema auth;
    grant usage on schema auth,internal to authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create table staff(id text primary key,user_id uuid,name text,role text,status text);
    alter table staff enable row level security;
    grant select on staff to authenticated;
    create policy staff_own on staff for select to authenticated using(user_id=auth.uid());
    create function internal.is_academy_admin() returns boolean language sql security definer set search_path='' as
      $$select exists(select 1 from public.staff where user_id=auth.uid() and role='manager' and status='active')$$;
    create table parents(id text primary key,user_id uuid,status text,email text);
    create table teams(id text primary key,name text,age_group text,status text,category_kind text);
    create table players(id text primary key,parent_id text,status text,birth_date date,team_id text,jersey_number int not null default 0,
      archived_at timestamptz,parent_email text,notes text);
    create unique index uq_players_team_jersey on players(team_id,jersey_number)
      where team_id is not null and jersey_number is not null;
    create table subscriptions(id text primary key,player_id text,plan_type text,amount numeric,
      start_date date,end_date date,status text,payment_method text,paid_at timestamptz,row_version bigint default 1,
      constraint chk_subscriptions_status check(status in ('paid','unpaid','exempt')),
      constraint chk_subscriptions_paid_consistency check(true));
    create function internal.guard_paid_subscription() returns trigger language plpgsql as $$begin return new; end$$;
    create trigger trg_guard_paid_subscription before update or delete on subscriptions
      for each row execute function internal.guard_paid_subscription();
    create table transactions(id text primary key,player_id text,subscription_id text,type text,category text,
      amount numeric,transaction_date date,description text,recorded_by text);
    create table audit_logs(id text primary key,action text,timestamp text,user_role text,user_name text,details text);
    create table notifications(id text primary key,title text,message text,timestamp text,type text,read boolean,recipient_user_id uuid);
    create table payment_proofs(id uuid primary key,subscription_id text,player_id text,parent_user_id uuid,amount numeric,
      status text,receipt_number bigint,reviewed_by text,reviewed_at timestamptz,updated_at timestamptz,row_version bigint default 1);
    create sequence payment_receipt_seq;
    create table family_payment_receipts(id uuid primary key,status text);
    create table internal.telegram_manager_bindings(chat_id_hash text,staff_id text,active boolean);
    create table internal.telegram_admin_actions(chat_id_hash text,staff_id text,action text,entity_type text,entity_id uuid);
    insert into staff values('manager','${manager}','Manager','manager','active'),('accountant','${accountant}','Accountant','accountant','active');
    insert into parents values('pa','${parentA}','active','a@example.invalid'),('pb','${parentB}','active','b@example.invalid');
    insert into teams values('age','فئة ٢٠١٥/٢٠١٤','U-11 & 12','active','team'),
      ('gk','Goalkeepers 2015','U-open','active','goalkeeper'),('old','2015','U-11','inactive','team');
    insert into players(id,parent_id,status,birth_date) values('single','pa','inactive','2015-01-01'),
      ('sibling-a','pb','inactive','2015-01-01'),('sibling-b','pb','inactive','2014-01-01');
    insert into subscriptions(id,player_id,plan_type,amount,start_date,end_date,status) values
      ('single-sub','single','monthly',25,current_date,current_date+30,'unpaid'),
      ('sibling-sub','sibling-a','monthly',25,current_date,current_date+30,'unpaid');
    insert into internal.telegram_manager_bindings values('manager-chat','manager',true);
  `);
  await db.exec(await read('20261019082642_manager_subscription_support.sql'));
  await db.exec(await read('20261027212133_separate_subscription_cancellation_refunds.sql'));
  await db.exec(await read('20261021025345_link_telegram_payment_approval.sql'));
  await db.exec(await read('20260930111922_notify_managers_on_payment_proof_submission.sql'));
  const file = (await readdir(dir)).find(n => n.endsWith('_automate_payment_activation_and_refund_receipts.sql'));
  await db.exec(await read(file));
  await db.exec(`create trigger player_sensitive before update on players
    for each row execute function internal.guard_player_sensitive_columns();`);
  const asUser = async (uid, sql, args = []) => {
    await db.query("select set_config('test.user',$1,false)", [uid]);
    await db.exec('set role authenticated');
    try { return await db.query(sql, args); }
    finally { await db.exec('reset role'); }
  };
  const submit = async (subscription = 'single-sub', player = 'single', parent = parentA) => db.query(
    "insert into payment_proofs(id,subscription_id,player_id,parent_user_id,amount,status) values($1,$2,$3,$4,25,'pending')",
    [proof, subscription, player, parent]);
  const approve = () => asUser(accountant, 'select internal.approve_payment_proof_impl($1)', [proof]);
  return {db, asUser, submit, approve};
}

test('proof notification, accountant approval, exact birth-year assignment and activation are atomic', async () => {
  const {db, asUser, submit, approve} = await fixture();
  try {
    await submit();
    assert.equal((await db.query("select count(*)::int n from notifications where recipient_user_id=$1", [manager])).rows[0].n, 1);
    await db.exec("update payment_proofs set status='pending'");
    assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n, 1);
    await approve(); await approve();
    await db.exec("update subscriptions set status='paid',paid_at=now(),payment_method='cash' where id='sibling-sub'");
    assert.equal((await db.query("select count(*)::int n from players where team_id='age' and jersey_number=0")).rows[0].n, 2);
    await db.exec("update players set jersey_number=7 where id='single'");
    await assert.rejects(db.exec("update players set jersey_number=7 where id='sibling-a'"), e => e.code === '23505');
    assert.deepEqual((await db.query("select status,team_id from players where id='single'")).rows[0], {status:'active',team_id:'age'});
    assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n, 1);
    // The guard exception is available only to a nested paid-subscription trigger.
    await db.exec('grant select,update on players to authenticated');
    await assert.rejects(asUser(accountant, "update players set team_id='old' where id='single'"), /Only managers/);
  } finally { await db.close(); }
});

test('missing or ambiguous category rolls approval back; Telegram shares the same activation', async () => {
  const {db, submit} = await fixture();
  try {
    await submit();
    await db.exec("update teams set status='inactive' where id='age'");
    await assert.rejects(db.query('select telegram_approve_payment_proof($1,$2)', [proof,'manager-chat']), /unique active birth-year category/);
    assert.equal((await db.query("select status from subscriptions where id='single-sub'")).rows[0].status, 'unpaid');
    assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n, 0);
    await db.exec("update teams set status='active' where id='age'; insert into teams values('duplicate','2015','U-11','active','team')");
    await assert.rejects(db.query('select telegram_approve_payment_proof($1,$2)', [proof,'manager-chat']), /unique active birth-year category/);
    await db.exec("delete from teams where id='duplicate'");
    await db.query('select telegram_approve_payment_proof($1,$2)', [proof,'manager-chat']);
    assert.deepEqual((await db.query("select status,team_id from players where id='single'")).rows[0], {status:'active',team_id:'age'});
  } finally { await db.close(); }
});

test('withdrawal creates one immutable numbered refund, suspends sole parent, and preserves original payment', async () => {
  const {db, asUser, submit, approve} = await fixture();
  try {
    await submit(); await approve();
    await asUser(manager, "select cancel_subscription($1,'single-sub',25,'Not joining')", [cancel]);
    assert.equal((await db.query("select status from parents where id='pa'")).rows[0].status, 'active', 'Cancellation is not a delivered refund');
    await assert.rejects(asUser(parentA, "select record_withdrawal_refund($1,'single-sub',25,'Not joining','benefit')", [refund]), /Active manager/);
    const call = () => asUser(manager, "select record_withdrawal_refund($1,'single-sub',25,'Not joining','benefit')", [refund]);
    await call(); await call();
    const receipt = (await db.query('select refund_receipt_number,amount,original_payment_id from subscription_support')).rows;
    assert.equal(receipt.length, 1); assert.ok(Number(receipt[0].refund_receipt_number)>0);
    assert.equal(Number(receipt[0].amount), 25);
    assert.equal((await db.query("select status from parents where id='pa'")).rows[0].status, 'inactive');
    assert.equal((await db.query("select status from players where id='single'")).rows[0].status, 'inactive');
    assert.equal(Number((await db.query("select amount from transactions where type='revenue'")).rows[0].amount), 25);
    assert.equal((await asUser(parentA, 'select * from subscription_support')).rows.length, 1, 'Owner retains receipt row access');
    assert.equal((await asUser(parentB, 'select * from subscription_support')).rows.length, 0);
    await assert.rejects(db.exec('update subscription_support set refund_receipt_number=DEFAULT'), /immutable/);
  } finally { await db.close(); }
});

test('withdrawal preserves sibling/parent account; family proof submission and correction notify manager once', async () => {
  const {db, asUser, submit, approve} = await fixture();
  try {
    await submit('sibling-sub','sibling-a',parentB); await approve();
    await asUser(manager, "select cancel_subscription($1,'sibling-sub',25,'Not joining')", [cancel]);
    await asUser(manager, "select record_withdrawal_refund($1,'sibling-sub',25,'Not joining','cash')", [refund]);
    assert.equal((await db.query("select status from parents where id='pb'")).rows[0].status, 'active');
    assert.equal((await db.query("select status from players where id='sibling-b'")).rows[0].status, 'inactive');
    const id = '50000000-0000-4000-8000-000000000001';
    const count = async () => (await db.query("select count(*)::int n from notifications where title='إثبات دفع أشقاء بانتظار المراجعة'")).rows[0].n;
    await db.query("insert into family_payment_receipts values($1,'pending')", [id]);
    assert.equal(await count(), 1);
    await db.exec("update family_payment_receipts set status='pending'"); assert.equal(await count(), 1);
    await db.exec("update family_payment_receipts set status='needs_info'; update family_payment_receipts set status='pending'");
    assert.equal(await count(), 2);
  } finally { await db.close(); }
});
