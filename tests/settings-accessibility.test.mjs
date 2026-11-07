import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Source-only regression checks: no Settings import, data clients, or saves.
const settings = readFileSync(new URL('../src/views/Settings.tsx', import.meta.url), 'utf8');

test('all four fee fields have unique explicit ids and associated labels', () => {
  const ids = [...settings.matchAll(/<FeeField\s+id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, [
    'settings-fee-monthly', 'settings-fee-quarterly',
    'settings-fee-semi-annual', 'settings-fee-yearly',
  ]);
  assert.equal(new Set(ids).size, 4);
  const fee = settings.slice(settings.indexOf('function FeeField('));
  assert.match(fee, /<label htmlFor=\{id\}/);
  assert.match(fee, /<input\s+id=\{id\}\s+type="number"/);
  assert.match(fee, /min=\{0\}[\s\S]*step=\{0\.5\}/);
});

test('settings labels identify the corresponding input or textarea', () => {
  for (const id of ['settings-name', 'settings-logo-url']) {
    assert.ok(settings.includes(`htmlFor="${id}"`));
    assert.ok(settings.includes(`id="${id}"`));
  }
  const fieldIds = [...settings.matchAll(/<Field id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(fieldIds.length, 7);
  assert.equal(new Set(fieldIds).size, fieldIds.length);
  for (const id of fieldIds) {
    assert.match(settings, new RegExp(`<(?:input|textarea)\\s+id="${id}"`));
  }
  const field = settings.slice(settings.indexOf('function Field('), settings.indexOf('function FeeField('));
  assert.match(field, /<label htmlFor=\{id\}/);
});
