import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../supabase/functions/setup-academy/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace(/^import .*;\n/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function harness() {
  let handler;
  const calls = [];
  const forbidden = operation => () => {
    calls.push(operation);
    throw new Error(`Retired setup must not call ${operation}`);
  };
  vm.runInNewContext(code, {
    Request, Response, console,
    createClient: forbidden('Supabase'),
    fetch: forbidden('network'),
    Deno: {
      env: {
        get: key => {
          calls.push(`env:${key}`);
          return key === 'ALLOW_DESTRUCTIVE_SETUP' ? 'true' : 'synthetic';
        },
      },
      serve: fn => { handler = fn; },
    },
  });
  return {
    calls,
    request: (body, method = 'POST') => handler(new Request('https://example.invalid', {
      method,
      headers: { authorization: 'Bearer synthetic-manager', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    })),
  };
}

test('even confirmed reset cannot re-enable setup or access manager accounts', async () => {
  const h = harness();
  const response = await h.request({ reset: true, confirm_reset: true });
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { error: 'destructive_setup_disabled' });
  assert.deepEqual(h.calls, []);
});

test('legacy seeding and account provisioning are also refused without side effects', async () => {
  const h = harness();
  for (const body of [
    { createUsers: true, staff: [{ email: 'manager@example.invalid', name: 'Synthetic manager', role: 'manager' }] },
    { staff: [{ id: 'manager', role: 'manager' }], academy_settings: [{ id: 'settings' }] },
    { reset: false, createUsers: false },
  ]) {
    const response = await h.request(body);
    assert.equal(response.status, 410);
    assert.equal((await response.json()).error, 'destructive_setup_disabled');
  }
  assert.deepEqual(h.calls, []);
});

test('empty and malformed payloads cannot reach the retired implementation', async () => {
  const h = harness();
  for (const body of [undefined, '', '{broken-json', null]) {
    const response = await h.request(body);
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.deepEqual(h.calls, []);
});

test('CORS preflight succeeds without touching data', async () => {
  const h = harness();
  const response = await h.request(undefined, 'OPTIONS');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal(await response.text(), '');
  assert.deepEqual(h.calls, []);
});

test('unsupported methods are refused without touching data', async () => {
  const h = harness();
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
    const response = await h.request(undefined, method);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST, OPTIONS');
  }
  assert.deepEqual(h.calls, []);
});
