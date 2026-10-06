import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../supabase/functions/setup-academy/index.ts', import.meta.url), 'utf8');

test('destructive setup is disabled by default in production code', () => {
  assert.match(source, /ALLOW_DESTRUCTIVE_SETUP/);
  assert.match(source, /!== "true"/);
  assert.match(source, /destructive_setup_disabled/);
});

test('launch guard runs before reset and seeding logic', () => {
  const guard = source.indexOf('ALLOW_DESTRUCTIVE_SETUP');
  const reset = source.indexOf('if (reset)');
  const seed = source.indexOf('const isEmpty');
  assert.ok(guard >= 0);
  assert.ok(reset > guard);
  assert.ok(seed > guard);
});
