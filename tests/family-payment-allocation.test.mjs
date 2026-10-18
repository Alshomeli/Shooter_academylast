import assert from 'node:assert/strict';
import test from 'node:test';
import { createFamilyAllocation } from '../src/lib/family-payment-allocation.ts';

const due=(subscriptionId,playerId,amount,overrides={})=>({
  subscriptionId,playerId,amount,parentUserId:'parent-1',status:'unpaid',
  startDate:'2026-11-01',endDate:'2026-11-30',...overrides,
});
test('one proof can represent several sibling subscriptions with exact 3-decimal totals',()=>{
  assert.deepEqual(createFamilyAllocation('parent-1',[
    due('sub-a','player-a',25),due('sub-b','player-b',17.5),due('sub-c','player-c',19.125),
  ]),{allocations:[
    {subscriptionId:'sub-a',playerId:'player-a',amount:25},
    {subscriptionId:'sub-b',playerId:'player-b',amount:17.5},
    {subscriptionId:'sub-c',playerId:'player-c',amount:19.125},
  ],totalAmount:61.625});
});
test('reject duplicate subscription allocations',()=>{
  assert.throws(()=>createFamilyAllocation('parent-1',[due('a','p1',25),due('a','p1',25)]),/Duplicate/);
});
test('reject another parent or already-paid subscription',()=>{
  assert.throws(()=>createFamilyAllocation('parent-1',[due('a','p1',25,{parentUserId:'parent-2'})]),/ownership/);
  assert.throws(()=>createFamilyAllocation('parent-1',[due('a','p1',25,{status:'paid'})]),/ownership/);
});
test('reject unsupported amounts and empty batches',()=>{
  assert.throws(()=>createFamilyAllocation('parent-1',[]),/At least one/);
  assert.throws(()=>createFamilyAllocation('parent-1',[due('a','p1',0)]),/Zero-value/);
  assert.throws(()=>createFamilyAllocation('parent-1',[due('a','p1',25.0004)]),/three decimals/);
});
