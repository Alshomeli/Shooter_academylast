import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gateway = readFileSync(new URL('../supabase/functions/ai-operations-gateway/index.ts', import.meta.url), 'utf8');
const openapi = readFileSync(new URL('../docs/chatgpt-operations-openapi.yaml', import.meta.url), 'utf8');

function gatewayOperations() {
  const match = gateway.match(/type Operation = ([^;]+);/);
  assert.ok(match, 'gateway Operation union should exist');
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]).sort();
}

function openApiOperations() {
  const match = openapi.match(/Operation:\n\s+type: string\n\s+enum:\n((?:\s+- [^\n]+\n?)+)/);
  assert.ok(match, 'OpenAPI Operation enum should exist');
  return match[1].split('\n').map((line) => line.trim()).filter((line) => line.startsWith('- ')).map((line) => line.slice(2)).sort();
}

test('AI operations OpenAPI stays synchronized with the gateway allow-list', () => {
  assert.deepEqual(openApiOperations(), gatewayOperations());
});

test('connector contract exposes the complete safe action lifecycle', () => {
  for (const mode of ['prepare', 'execute', 'cancel', 'history', 'snapshot']) {
    assert.match(gateway, new RegExp('"' + mode + '"'));
    assert.match(openapi, new RegExp('const: ' + mode));
  }
  assert.match(openapi, /bearerAuth:/);
  assert.match(openapi, /SnapshotResponse:/);
});

test('snapshot remains aggregate and role-scoped', () => {
  assert.match(gateway, /const canPayments = \["manager", "accountant"\]/);
  assert.match(gateway, /const canEvaluations = \["manager", "coach"\]/);
  assert.match(gateway, /const canRegistrations = staff\.role === "manager"/);
  assert.match(gateway, /unpaidSubscriptions:/);
  assert.match(gateway, /activePlayers:/);
  assert.match(gateway, /draftEvaluations:/);
  assert.match(gateway, /applicationsNeedingAction:/);
});
