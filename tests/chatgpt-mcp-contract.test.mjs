import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mcp = readFileSync(new URL('../supabase/functions/chatgpt-mcp/index.ts', import.meta.url), 'utf8');

test('remote MCP delegates business mutations to the safe gateway', () => {
  assert.match(mcp, /ai-operations-gateway/);
  assert.match(mcp, /mode: "prepare"/);
  assert.match(mcp, /mode: "execute"/);
  assert.match(mcp, /confirm: true/);
  assert.doesNotMatch(mcp, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('remote MCP exposes OAuth protection and a non-sensitive health endpoint', () => {
  assert.match(mcp, /oauth-protected-resource/);
  assert.match(mcp, /WWW-Authenticate/);
  assert.match(mcp, /authorization_servers/);
  assert.match(mcp, /chatgpt-mcp\/health/);
  assert.match(mcp, /authentication: "supabase-oauth"/);
  assert.doesNotMatch(mcp, /@supabase\/server/);
});

test('remote MCP provides only allow-listed administrative preparation tools', () => {
  for (const tool of [
    'prepare_subscription_payment',
    'prepare_attendance',
    'prepare_evaluation_publish',
    'prepare_subscription_create',
    'prepare_registration_approval',
    'prepare_registration_review',
  ]) {
    assert.match(mcp, new RegExp('"' + tool + '"'));
  }
  assert.match(mcp, /execute_prepared_admin_action/);
  assert.match(mcp, /cancel_prepared_admin_action/);
});
