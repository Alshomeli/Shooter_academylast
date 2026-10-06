import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const players = await readFile(new URL('../src/views/Players.tsx', import.meta.url), 'utf8');
const parents = await readFile(new URL('../src/views/Parents.tsx', import.meta.url), 'utf8');

test('managers can filter players by parent linkage state', () => {
  assert.match(players, /parentLinkFilter/);
  assert.match(players, /value="unlinked"/);
  assert.match(players, /!p\.parentId/);
  assert.match(players, /بدون ولي أمر مرتبط/);
});

test('managers can filter parent records by account linkage state', () => {
  assert.match(parents, /accountFilter/);
  assert.match(parents, /value="unlinked"/);
  assert.match(parents, /!p\.userId/);
  assert.match(parents, /بدون حساب/);
});
