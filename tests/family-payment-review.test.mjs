import assert from 'node:assert/strict';
import test from 'node:test';
import { planFamilyReceiptApproval } from '../src/lib/family-payment-review.ts';
const child=(subscriptionId,playerId,amount,status='unpaid')=>({
  subscriptionId,playerId,parentUserId:'parent-1',amount,status,startDate:'2026-11-01',endDate:'2026-11-30'
});
const receipt=(overrides={})=>({
  id:'receipt-123',parentUserId:'parent-1',status:'pending',
  expectedAmount:42.5,allocations:[child('sub-1','child-1',25),child('sub-2','child-2',17.5)],...overrides
});
test('one family receipt creates stable distinct per-subscription posting instructions',()=>{
  const a=planFamilyReceiptApproval(receipt());
  assert.equal(a.length,2);
  assert.deepEqual(a.map(x=>x.amount),[25,17.5]);
  assert.notEqual(a[0].transactionId,a[1].transactionId);
  assert.deepEqual(planFamilyReceiptApproval(receipt()),a);
});
test('approval plan rejects already-approved or rejected receipts',()=>{
  for(const status of ['approved','rejected','needs_info'])
    assert.throws(()=>planFamilyReceiptApproval(receipt({status})),/not pending/);
});
test('approval plan rejects amount mismatch, duplicate subscriptions, and already paid amounts',()=>{
  assert.throws(()=>planFamilyReceiptApproval(receipt({expectedAmount:45})),/mismatch/);
  assert.throws(()=>planFamilyReceiptApproval(receipt({allocations:[child('same','child-1',25),child('same','child-2',17.5)]})),/Duplicate/);
  assert.throws(()=>planFamilyReceiptApproval(receipt({allocations:[child('sub-1','child-1',25,'paid'),child('sub-2','child-2',17.5)]})),/ownership/);
});
