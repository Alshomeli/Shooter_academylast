import assert from 'node:assert/strict';
import test from 'node:test';
import { planFamilyReceiptApproval } from '../src/lib/family-payment-review.ts';
const due=(id,player,amount,overrides={})=>({subscriptionId:id,playerId:player,parentUserId:'parent-1',amount,status:'unpaid',startDate:'2026-11-01',endDate:'2026-11-30',...overrides});
const batch=(overrides={})=>({id:'receipt-1',parentUserId:'parent-1',status:'pending',expectedAmount:42.5,allocations:[due('sub-1','a',25),due('sub-2','b',17.5)],...overrides});
test('sibling receipt has two stable, unique transaction instructions',()=>{
 const first=planFamilyReceiptApproval(batch());
 assert.deepEqual(first.map(x=>x.amount),[25,17.5]);
 assert.equal(new Set(first.map(x=>x.transactionId)).size,2);
 assert.deepEqual(first,planFamilyReceiptApproval(batch()));
});
test('re-review of approved, rejected, or incomplete proof is blocked',()=>{
 for(const status of ['approved','rejected','needs_info'])
   assert.throws(()=>planFamilyReceiptApproval(batch({status})),/not pending/);
});
test('amount and subscription consistency are validated before review',()=>{
 assert.throws(()=>planFamilyReceiptApproval(batch({expectedAmount:43})),/mismatch/);
 assert.throws(()=>planFamilyReceiptApproval(batch({expectedAmount:NaN})),/mismatch/);
 assert.throws(()=>planFamilyReceiptApproval(batch({allocations:[due('x','a',25),due('x','b',17.5)]})),/Duplicate/);
 assert.throws(()=>planFamilyReceiptApproval(batch({allocations:[due('sub-1','a',25,{status:'paid'}),due('sub-2','b',17.5)]})),/ownership/);
});
