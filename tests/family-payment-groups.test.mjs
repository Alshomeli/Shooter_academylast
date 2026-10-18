import assert from 'node:assert/strict';
import test from 'node:test';
import { siblingPaymentGroups } from '../src/lib/family-payment-groups.ts';
const s=(id,playerId,startDate='2026-11-01',endDate='2026-11-30')=>({id,playerId,startDate,endDate,status:'unpaid',amount:25});
test('groups sibling payments only for same billing period',()=>{
 const groups=siblingPaymentGroups([s('a','p1'),s('b','p2'),s('c','p1','2026-12-01','2026-12-31')],['p1','p2'],[]);
 assert.equal(groups.length,1);
 assert.deepEqual(groups[0].subscriptions.map(x=>x.id),['a','b']);
 assert.equal(groups[0].amount,50);
});
test('excludes previously submitted, foreign, paid and duplicate player subscription',()=>{
 const rows=[s('a','p1'),s('dup','p1'),s('b','p2'),s('c','p3'),{...s('d','p4'),status:'paid'}];
 const groups=siblingPaymentGroups(rows,['p1','p2'],['c']);
 assert.deepEqual(groups[0].subscriptions.map(x=>x.id),['a','b']);
 assert.deepEqual(siblingPaymentGroups(rows,['p1','p2'],['b']),[]);
});

test('ignores amounts with excess precision and non-finite values',()=>{
 const rows=[s('a','p1'),{...s('bad','p2'),amount:25.0001},{...s('inf','p3'),amount:Infinity},s('b','p4')];
 const groups=siblingPaymentGroups(rows,['p1','p2','p3','p4'],[]);
 assert.deepEqual(groups[0].subscriptions.map(x=>x.id),['a','b']);
 assert.equal(groups[0].amount,50);
});
