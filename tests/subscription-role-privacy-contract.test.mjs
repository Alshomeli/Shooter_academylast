import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20261108090000_restrict_subscription_select_to_management_and_parent.sql', import.meta.url), 'utf8');

test('receptionists cannot navigate to or preload subscription records', () => {
  assert.match(app, /receptionist:\s*\[[^\]]*'attendance'/);
  const receptionistViews = app.match(/receptionist:\s*\[([^\]]*)\]/)?.[1] ?? '';
  assert.doesNotMatch(receptionistViews, /subscriptions/);
  assert.match(app, /\(role === 'coach' \|\| role === 'receptionist'\) \? \[\] : db\.getSubscriptions\(\)/);
});

test('subscription SELECT policy grants management/accounting and parent-owned children only', () => {
  assert.match(migration, /internal\.has_role\(array\['manager','accountant'\]/);
  assert.match(migration, /internal\.has_role\(array\['parent'\]/);
  assert.match(migration, /pa\.user_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /'receptionist'|'coach'/);
  assert.match(migration, /drop policy if exists select_subscriptions_authenticated/);
});
