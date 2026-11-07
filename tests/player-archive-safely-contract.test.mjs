import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/20261020063000_archive_player_safely.sql', import.meta.url), 'utf8');
const store = await readFile(new URL('../src/lib/store.ts', import.meta.url), 'utf8');
const view = await readFile(new URL('../src/views/Players.tsx', import.meta.url), 'utf8');

test('player archive requires manager authorization and revokes anonymous invocation', () => {
  assert.match(sql, /internal\.has_role\(array\['manager'::text\]\)/);
  assert.match(sql, /revoke all on function public\.archive_player_safely\(text\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.archive_player_safely\(text\) to authenticated/i);
});
test('archive retains financial records and only sets archived status', () => {
  assert.match(sql, /archived_at = coalesce\(archived_at, now\(\)\)/);
  assert.match(sql, /status = 'inactive'/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\./i);
  assert.doesNotMatch(sql, /update\s+public\.(?:subscriptions|transactions|payment_proofs|family_payment_receipts)/i);
});
test('player UI uses archive instead of forced deletion', () => {
  assert.match(store, /supabase\.rpc\('archive_player_safely'/);
  assert.match(view, /await db\.archivePlayer\(deleteId\)/);
  assert.doesNotMatch(view, /forceDeleteUser\('player'/);
});
