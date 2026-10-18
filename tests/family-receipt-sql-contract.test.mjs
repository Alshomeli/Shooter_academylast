import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/20261018034000_family_receipt_secure_intake.sql', import.meta.url), 'utf8');
test('family receipt intake enforces authenticated parent, locks and ownership', () => {
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /pa\.user_id = v_uid/);
  assert.match(sql, /o\.owner_id = v_uid::text/);
  assert.match(sql, /v_players <> v_count or v_periods <> 1/);
});
test('intake writes only a pending receipt and allocation rows, never payment posting', () => {
  assert.match(sql, /'pending'\) returning id/);
  assert.doesNotMatch(sql, /update\s+public\.subscriptions/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.transactions/i);
  assert.match(sql, /grant execute on function public\.submit_family_payment_receipt.*to authenticated/);
});

test('family receipt intake serializes concurrent requests before row locks', () => {
  const parentLock = sql.indexOf('pg_advisory_xact_lock');
  const subscriptionLock = sql.indexOf('for update;');
  const receiptCheck = sql.indexOf('Payment proof already exists');
  assert.ok(parentLock > 0);
  assert.ok(subscriptionLock > parentLock);
  assert.ok(receiptCheck > subscriptionLock);
});

test('family receipt schema forbids attaching the same proof file to multiple batches', async () => {
  const schema = await readFile(new URL('../supabase/migrations/20261018032000_family_payment_receipt_batches.sql', import.meta.url), 'utf8');
  assert.match(schema, /unique index if not exists family_payment_receipts_unique_proof_path/);
  assert.match(schema, /on public\.family_payment_receipts\(proof_path\)/);
});

test('server validates uploaded evidence MIME and 5 MB size independent of client', () => {
  assert.match(sql, /o\.metadata->>'mimetype' in/);
  assert.match(sql, /image\/jpeg/);
  assert.match(sql, /application\/pdf/);
  assert.match(sql, /\(o\.metadata->>'size'\)::bigint between 1 and 5242880/);
});

test('server requires evidence file extension and content type to agree', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
    assert.ok(sql.includes("o.metadata->>'mimetype' = '"+type+"'"));
  }
  assert.match(sql, /p_proof_path ~\*/);
});
