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
