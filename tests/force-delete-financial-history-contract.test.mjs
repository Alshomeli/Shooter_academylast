import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/20261020060000_guard_force_delete_financial_history.sql', import.meta.url), 'utf8');

test('force-delete migration does not reference stale table names', () => {
  for (const stale of ['parent_payment_proofs', 'family_payment_receipt_batches', 'manager_subscription_support', 'manager_preplatform_coverage']) {
    assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), new RegExp('public\\.' + stale + '\\b'));
  }
});
test('financial evidence is protected for staff and player deletion', () => {
  for (const table of ['payment_proofs', 'family_payment_receipts', 'family_payment_receipt_items', 'player_recurring_fees', 'subscription_support', 'preplatform_coverage']) {
    assert.match(sql, new RegExp('public\\.' + table + '\\b'));
    assert.doesNotMatch(sql, new RegExp('delete\\s+from\\s+public\\.' + table + '\\b', 'i'));
  }
});
test('manager authorization and self deletion guard remain active', () => {
  assert.match(sql, /internal\.has_role\(array\['manager'::text\]\)/);
  assert.match(sql, /p_target_id = v_current_staff_id/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path to ''/);
});
test('financial references must refuse deletion instead of severing audit links', () => {
  assert.match(sql, /Cannot delete staff with financial or approval history/);
  assert.match(sql, /Cannot delete player with financial or approval history/);
  assert.doesNotMatch(sql, /update\s+public\.payment_proofs\s+set\s+reviewed_by\s*=\s*null/i);
});
