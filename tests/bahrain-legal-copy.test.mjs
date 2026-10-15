import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const policy = readFileSync(new URL('../src/views/LegalPage.tsx', import.meta.url), 'utf8');
const review = readFileSync(new URL('../docs/bahrain-legal-and-launch-review-2026-10-15.md', import.meta.url), 'utf8');

test('draft Bahrain privacy notice covers guardian publicity, transfers and access in Arabic and English', () => {
  for (const word of [
    'بيانات اللاعبين القُصّر وموافقة ولي الأمر', 'Young Players and Guardian Consent',
    'الصور والفيديو والنشر العام', 'Photos, Videos and Publicity',
    'المعالجة أو التخزين خارج البحرين', 'Processing Outside Bahrain',
    'الاحتفاظ والحذف', 'Retention and Deletion',
    'حقوق أصحاب البيانات والتسويق', 'Data Rights and Direct Marketing',
  ]) assert.ok(policy.includes(word), word);
});

test('consumer wording separates bank transfer evidence from approval and preserves statutory refunds', () => {
  assert.match(policy, /التحويل البنكي أو حقوق المستهلك بشأن أي مبلغ دُفع/);
  assert.match(policy, /This does not negate the bank transfer itself/);
  assert.match(policy, /Cancellation, Refunds and Service Quality/);
  assert.match(policy, /حقوق المستهلك بشأن أي مبلغ/);
  assert.ok(!policy.includes('all subscriptions are non-refundable'));
});

test('both language versions keep the contract and cancellation anchors', () => {
  assert.equal((policy.match(/id: "payments"/g) || []).length, 2);
  assert.equal((policy.match(/id: "refunds"/g) || []).length, 2);
  assert.match(policy, /policySections\[page\]\[lang\]/);
});

test('legal review documentation identifies outstanding business facts and statutes', () => {
  for(const marker of ['Law No. (30) of 2018', 'Law No. (35) of 2012', 'Law No. (28) of 2026',
    'Consent record for minors', 'Subscription terms', 'Refund/cancellation rule',
    'Cross-border', 'NOT legal certification']) assert.ok(review.includes(marker),marker);
});
