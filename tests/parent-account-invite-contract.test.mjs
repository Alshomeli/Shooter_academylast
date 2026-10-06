import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const edge = await readFile(new URL('../supabase/functions/parent-account-invite/index.ts', import.meta.url), 'utf8');
const parents = await readFile(new URL('../src/views/Parents.tsx', import.meta.url), 'utf8');
const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');

test('parent account invitation is manager-only and requires explicit confirmation', () => {
  assert.match(edge, /staff\.role !== "manager"/);
  assert.match(edge, /body\.confirm !== true/);
  assert.match(edge, /explicit_confirmation_required/);
  assert.match(edge, /parent\.user_id/);
  assert.match(edge, /parent_already_linked/);
  assert.match(config, /\[functions\.parent-account-invite\][\s\S]*verify_jwt\s*=\s*true/);
});

test('parent invitation uses server-side Auth admin and never exposes the service key to the browser', () => {
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /auth\.admin\.inviteUserByEmail/);
  assert.match(edge, /auth\.admin\.listUsers/);
  assert.doesNotMatch(parents, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(parents, /inviteUserByEmail/);
});

test('existing auth accounts are linkable only by exact email and staff accounts are rejected', () => {
  assert.match(edge, /toLowerCase\(\) === email/);
  assert.match(edge, /auth_user_is_staff/);
  assert.match(edge, /duplicate_auth_email/);
  assert.match(edge, /\.is\("user_id", null\)/);
});

test('UI prepares the invite before showing the explicit send confirmation', () => {
  assert.match(parents, /prepareParentInvite/);
  assert.match(parents, /sendParentInvite/);
  assert.match(parents, /setInviteTarget/);
  assert.match(parents, /لن تُرسل أي دعوة قبل تأكيدك/);
  assert.match(parents, /activeRole === 'manager'/);
});
