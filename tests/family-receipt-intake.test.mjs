import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareFamilyReceiptIntake } from '../src/lib/family-receipt-intake.ts';
const due=(id,playerId,amount)=>({subscriptionId:id,playerId,parentUserId:'parent-a',amount,status:'unpaid',startDate:'2026-11-01',endDate:'2026-11-30'});
const file={name:'benefit-receipt.jpg',type:'image/jpeg',size:250000};
test('one receipt for siblings totals charges and preserves separate subscriptions',()=>{
 const result=prepareFamilyReceiptIntake('parent-a',[due('s1','p1',25),due('s2','p2',19)],'2026-11-02',file);
 assert.deepEqual(result.subscriptionIds,['s1','s2']);
 assert.equal(result.expectedAmount,44);
});
test('rejects duplicate subscription, invalid file and different parent',()=>{
 assert.throws(()=>prepareFamilyReceiptIntake('parent-a',[due('s1','p1',25),due('s1','p1',25)],'2026-11-02',file),/Duplicate/);
 assert.throws(()=>prepareFamilyReceiptIntake('parent-b',[due('s1','p1',25)],'2026-11-02',file),/ownership/);
 assert.throws(()=>prepareFamilyReceiptIntake('parent-a',[due('s1','p1',25)],'2026-11-02',{...file,type:'text/html'}),/Unsupported/);
 assert.throws(()=>prepareFamilyReceiptIntake('parent-a',[due('s1','p1',25)],'2026-11-02',{...file,size:6000000}),/5 MB/);
});

test('rejects impossible calendar dates instead of normalizing them',()=>{
  for(const date of ['2026-02-30','2026-13-01','2026-11-31','not-a-date']){
    assert.throws(()=>prepareFamilyReceiptIntake('parent-a',[due('s1','p1',25)],date,file),/Invalid transfer date/);
  }
  assert.equal(prepareFamilyReceiptIntake('parent-a',[due('s1','p1',25)],'2028-02-29',file).transferDate,'2028-02-29');
});

test('rejects duplicate player within one receipt even with different subscriptions',()=>{
 const a=due('s1','p1',25), b=due('s2','p1',25);
 assert.throws(()=>prepareFamilyReceiptIntake('parent-a',[a,b],'2026-11-02',file),/Duplicate player/);
});
test('rejects mixing subscription months and malformed billing ranges',()=>{
 const a=due('s1','p1',25), b={...due('s2','p2',19),startDate:'2026-12-01',endDate:'2026-12-31'};
 assert.throws(()=>prepareFamilyReceiptIntake('parent-a',[a,b],'2026-11-02',file),/Mixed or invalid billing periods/);
 assert.throws(()=>prepareFamilyReceiptIntake('parent-a',[{...a,startDate:'2026-12-01'}],'2026-11-02',file),/Mixed or invalid billing periods/);
});

test('rejects impossible billing-period calendar dates',()=>{
 const bad={...due('s1','p1',25),startDate:'2026-02-30',endDate:'2026-03-30'};
 assert.throws(()=>prepareFamilyReceiptIntake('parent-a',[bad],'2026-11-02',file),/Mixed or invalid billing periods/);
});
