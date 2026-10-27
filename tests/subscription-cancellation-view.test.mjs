import test from 'node:test';
import assert from 'node:assert/strict';
import { getLifecycleStatus } from '../src/lib/report-dates.ts';
import { getSubscriptionReminders } from '../src/lib/reminders.ts';
import { hasOverlappingSubscriptionPeriod } from '../src/lib/subscription-dates.ts';
import { mapSubscription, subscriptionToRow } from '../src/lib/db-mappers.ts';
const sub={id:'cancelled',playerId:'p',planType:'monthly',amount:25,startDate:'2026-10-01',endDate:'2026-10-31',status:'cancelled',paidAt:'2026-10-01T00:00:00Z',paymentMethod:'cash'};
test('cancelled subscriptions retain receipt metadata but cannot trigger reminders or block a new period',()=>{
 assert.equal(getLifecycleStatus(sub,'2026-10-28'),'cancelled');
 assert.deepEqual(getSubscriptionReminders([sub],[],[],new Date('2026-10-28T12:00:00Z')),[]);
 assert.equal(hasOverlappingSubscriptionPeriod([sub],{playerId:'p',startDate:'2026-10-01',endDate:'2026-10-31'}),false);
 assert.equal(mapSubscription(subscriptionToRow(sub)).paidAt,sub.paidAt);
});
test('dated exemptions expire and their reason survives database mapping',()=>{
 const exempt={...sub,status:'exempt',amount:0,exemptionReason:'Scholarship',paidAt:undefined,paymentMethod:undefined};
 assert.equal(getLifecycleStatus(exempt,'2026-11-01'),'expired');
 assert.equal(mapSubscription(subscriptionToRow(exempt)).exemptionReason,'Scholarship');
 assert.equal(subscriptionToRow(exempt).paid_at,null);
});
