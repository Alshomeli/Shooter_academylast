import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../supabase/migrations/20261018035000_protect_family_receipt_storage.sql', import.meta.url), 'utf8');
test('shared receipt storage deletion guard protects individual and family evidence', () => {
  assert.match(sql, /bucket_id = 'payment-proofs'/);
  assert.match(sql, /public\.payment_proofs pp where pp\.proof_path = name/);
  assert.match(sql, /public\.family_payment_receipts fr where fr\.proof_path = name/);
  assert.match(sql, /for delete to authenticated/);
});
