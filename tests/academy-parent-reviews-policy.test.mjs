import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Source-level regression guards. These checks do NOT substitute for live role-based RLS tests.
const sql = readFileSync(new URL('../supabase/migrations/20261022125000_academy_parent_reviews.sql', import.meta.url), 'utf8');
test('review table has RLS and authenticated-only access', () => {
  assert.match(sql, /alter table public\.academy_parent_reviews enable row level security;/i);
  assert.match(sql, /revoke all on public\.academy_parent_reviews from anon;/i);
  assert.match(sql, /grant select,insert on public\.academy_parent_reviews to authenticated;/i);
  assert.doesNotMatch(sql, /grant\s+(?:update|delete|all)\s+on\s+public\.academy_parent_reviews\s+to\s+authenticated/i);
});
test('parent can only insert their own consented review while active', () => {
  assert.match(sql, /parent_user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(sql, /p\.user_id\s*=\s*\(select auth\.uid\(\)\)\s+and\s+p\.status\s*=\s*'active'/i);
  assert.match(sql, /publication_consent\s*=\s*true/i);
  assert.match(sql, /status\s*=\s*'pending'/i);
});
test('manager RPCs require active manager and hide anonymous execution', () => {
  assert.equal((sql.match(/s\.role='manager' and s\.status='active'/g)||[]).length, 2);
  assert.match(sql, /revoke all on function public\.manager_review_parent_reviews\(\) from public, anon;/i);
  assert.match(sql, /revoke all on function public\.manager_approve_parent_review\(uuid,boolean\) from public, anon;/i);
});
test('review status changes only while pending', () => {
  assert.match(sql, /where id=p_review_id and status='pending'/i);
  assert.match(sql, /check \(status in \('pending','approved','rejected'\)\)/i);
});
