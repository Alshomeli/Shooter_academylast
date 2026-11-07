import assert from 'node:assert/strict';
import test from 'node:test';
import { BASE_MONTHLY_FEE_BHD, priceChildren, familyAmount } from '../src/lib/family-payment.ts';

test('base fee is BHD 25 per player without automatic sibling discount', () => {
  const prices = priceChildren(['a','b','c']);
  assert.equal(BASE_MONTHLY_FEE_BHD,25);
  assert.deepEqual(prices.map(p=>p.approvedAmount),[25,25,25]);
  assert.equal(familyAmount(prices),75);
});
test('manager-defined per-player discount changes total for siblings', () => {
  const prices=priceChildren(['a','b','c'],{b:19.5,c:22});
  assert.deepEqual(prices.map(p=>p.approvedAmount),[25,19.5,22]);
  assert.equal(familyAmount(prices),66.5);
});
test('reject invalid, negative and greater-than-base fees', () => {
  for(const fee of [-1,25.001,Number.NaN,Number.POSITIVE_INFINITY,7.1111])
    assert.throws(()=>priceChildren(['a'],{a:fee}),/Invalid/);
});
