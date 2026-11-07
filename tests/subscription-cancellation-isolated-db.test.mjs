import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup } from './manager-support-coverage-isolated-db.test.mjs';
const migration = await readFile(new URL('../supabase/migrations/20261027212133_separate_subscription_cancellation_refunds.sql', import.meta.url), 'utf8');
const manager='11111111-1111-4111-8111-111111111111';
const accountant='22222222-2222-4222-8222-222222222222';
const a='77777777-7777-4777-8777-777777777777';
const b='88888888-8888-4888-8888-888888888888';
const c='99999999-9999-4999-8999-999999999999';
async function prepare(){
 const db=await setup();
 await db.exec(`alter table subscriptions add constraint chk_subscriptions_status check(status in ('paid','unpaid','exempt'));
 alter table subscriptions add constraint chk_subscriptions_paid_consistency check(true);
 create function internal.guard_paid_subscription() returns trigger language plpgsql as $$begin return new; end$$;
 create trigger trg_guard_paid_subscription before update or delete on subscriptions for each row execute function internal.guard_paid_subscription();`);
 await db.exec(migration); return db;
}
test('withdrawal preserves receipt, caps shared refunds, records pending balance and is idempotent',async()=>{
 const db=await prepare();try{
  await db.query("select grant_subscription_support($1,'paid',5,'Exemption','cash')",[a]);
  const cancel=()=>db.query("select cancel_subscription($1,'paid',20,'Not joining')",[b]);
  await db.exec(`select set_config('test.user','${accountant}',false)`);
  await assert.rejects(cancel(),/Active manager/);
  await db.exec(`select set_config('test.user','${manager}',false)`);
  await assert.rejects(db.query("select cancel_subscription($1,'paid',21,'Not joining')",[b]),/exceeds/);
  await cancel();await cancel();
  assert.equal((await db.query("select status from subscriptions where id='paid'")).rows[0].status,'cancelled');
  assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,2);
  assert.equal(Number((await db.query("select amount from transactions where id='original'")).rows[0].amount),25);
  await assert.rejects(db.query("select grant_subscription_support($1,'paid',1,'Exemption','cash')",[c]),/state/);
  await assert.rejects(db.exec("update subscriptions set status='paid' where id='paid'"),/immutable/);
  const refund=()=>db.query("select record_withdrawal_refund($1,'paid',20,'Not joining','cash')",[c]);
  await refund();await refund();
  assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,3);
  assert.equal(Number((await db.query("select sum(case when type='revenue' then amount else -amount end) n from transactions")).rows[0].n),0);
  await assert.rejects(db.exec("delete from subscription_cancellations"),/immutable/);
  await assert.rejects(db.exec("delete from subscriptions where id='paid'"),/cannot be deleted/);
  await db.exec('set role authenticated');
  await assert.rejects(db.exec("insert into subscription_cancellations(subscription_id) values('paid')"),/permission denied/);
 }finally{await db.close();}
});
test('unpaid cancellation creates no money and partial refund cannot exceed approved amount',async()=>{
 const db=await prepare();try{
  await db.exec("insert into subscriptions(id,player_id,status,amount,start_date,end_date) values('unpaid','exempt-player','unpaid',25,current_date,current_date+30)");
  await assert.rejects(db.query("select cancel_subscription($1,'unpaid',1,'No payment')",[a]),/exceeds/);
  await db.query("select cancel_subscription($1,'unpaid',0,'No payment')",[a]);
  assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,1);
  await db.query("select cancel_subscription($1,'paid',10,'Partial refund')",[b]);
  await assert.rejects(db.query("select record_withdrawal_refund($1,'paid',11,'Partial refund','cash')",[c]),/approved/);
  for (const amount of [0,-1,'NaN','Infinity',0.0001]) await assert.rejects(db.query("select record_withdrawal_refund($1,'paid',$2,'Partial refund','cash')",[c,amount]));
  await db.query("select record_withdrawal_refund($1,'paid',10,'Partial refund','cash')",[c]);
  assert.equal((await db.query("select status from players where id='exempt-player'")).rows[0].status,'inactive');
  assert.equal((await db.query("select status from players where id='opening-player'")).rows[0].status,'inactive');
  await db.exec('set role anon');
  await assert.rejects(db.query("select cancel_subscription($1,'paid',0,'No access')",[a]),/permission denied/);
 }finally{await db.close();}
});

test('new exemptions require dates and reason and create no cash',async()=>{
 const db=await prepare();try{
  await assert.rejects(db.exec("insert into subscriptions(id,player_id,status,amount) values('new-exempt','exempt-player','exempt',0)"),/period and reason/);
  await db.exec("insert into subscriptions(id,player_id,status,amount,start_date,end_date,exemption_reason) values('new-exempt','exempt-player','exempt',0,current_date,current_date+30,'Manager scholarship')");
  assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,1);
  await assert.rejects(db.exec("update subscriptions set amount=1 where id='new-exempt'"),/zero amount/);
 }finally{await db.close();}
});

test('cancellation keeps other current coverage and sibling records unchanged',async()=>{
 const db=await prepare();try{
  await db.exec("insert into subscriptions(id,player_id,status,amount,start_date,end_date,exemption_reason) values('other','paid-player','exempt',0,current_date,current_date+20,'Scholarship')");
  await db.query("select cancel_subscription($1,'paid',25,'Not joining this plan')",[a]);
  assert.equal((await db.query("select status from players where id='paid-player'")).rows[0].status,'active');
  assert.equal((await db.query("select status from players where id='exempt-player'")).rows[0].status,'active');
  assert.equal((await db.query("select status from subscriptions where id='other'")).rows[0].status,'exempt');
 }finally{await db.close();}
});
