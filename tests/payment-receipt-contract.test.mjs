import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const receipt = await readFile(new URL('../src/components/PaymentReceipt.tsx', import.meta.url), 'utf8');
const subscriptions = await readFile(new URL('../src/views/Subscriptions.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

test('payment receipt uses linked parent identity and transaction reference', () => {
  assert.match(receipt, /parents\.find/);
  assert.match(receipt, /const payer = subscription\.parentNameSnapshot/);
  assert.match(receipt, /Transaction reference/);
  assert.match(receipt, /مرجع العملية/);
  assert.match(receipt, /rawReference/);
});

test('payment receipt shows explicit payment method boxes and academy footer', () => {
  assert.match(receipt, /Benefit \/ Transfer/);
  assert.match(receipt, /بنفت \/ تحويل/);
  assert.match(receipt, /settings\?\.address/);
  assert.match(receipt, /settings\?\.phone/);
  assert.match(receipt, /settings\?\.email/);
});

test('subscriptions passes parent data and printing stays receipt-only', () => {
  assert.match(subscriptions, /parents=\{parents\}/);
  assert.match(css, /body\.receipt-printing \*/);
  assert.match(css, /receipt-print-root/);
  assert.match(css, /receipt-no-print/);
});


test('approved transfer receipts print the official SA sequence number', () => {
  assert.match(receipt, /officialReceiptNumber/);
  assert.match(receipt, /SA-/);
  assert.match(subscriptions, /proof\.status === 'approved'/);
  assert.match(subscriptions, /officialReceiptNumber=/);
});


test('printed receipt retains archived names without current player or parent records', async () => {
  const { execFileSync } = await import('node:child_process');
  const script = `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { PaymentReceipt } from './src/components/PaymentReceipt.tsx';
    const subscription = { id:'s',playerId:'p',amount:25,planType:'monthly',status:'paid',
      playerNameSnapshot:'Archived player',parentNameSnapshot:'Archived parent' };
    const html = renderToStaticMarkup(createElement(PaymentReceipt, {
      subscription, transactions:[], players:[], parents:[], lang:'en', onClose() {},
    }));
    if (!html.includes('Archived player') || !html.includes('Archived parent')) throw Error('Missing archived names');
  `;
  execFileSync(process.execPath, ['--import','tsx','--input-type=module','-e',script], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, TSX_TSCONFIG_PATH:'tsconfig.app.json' },
  });
});
