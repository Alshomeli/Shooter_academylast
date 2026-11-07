import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlayerParentLink } from '../src/lib/validation.ts';

const parents = ['parent-a', 'parent-b'];

test('manual creation requires a selected parent, even if contact details were entered separately', () => {
  for (const parentId of ['', '   ']) {
    assert.equal(validatePlayerParentLink(parentId, parents).valid, false);
  }
});

test('a new player can be linked only to an available parent', () => {
  assert.equal(validatePlayerParentLink('parent-a', parents).valid, true);
  assert.equal(validatePlayerParentLink('removed-parent', parents).valid, false);
  assert.equal(validatePlayerParentLink('parent-a', []).valid, false);
});

test('editing a linked player cannot silently remove their parent', () => {
  assert.equal(validatePlayerParentLink('', parents, 'parent-a').valid, false);
  assert.equal(validatePlayerParentLink('parent-a', parents, 'parent-a').valid, true);
  assert.equal(validatePlayerParentLink('parent-b', parents, 'parent-a').valid, true);
});

test('an existing unlinked record can receive unrelated corrections without guessing a parent', () => {
  assert.equal(validatePlayerParentLink('', parents, '').valid, true);
  assert.equal(validatePlayerParentLink('', [], '').valid, true);
  assert.equal(validatePlayerParentLink('parent-b', parents, '').valid, true);
  assert.equal(validatePlayerParentLink('removed-parent', parents, '').valid, false);
});

test('parent-link errors are available in Arabic and English', () => {
  const ar = validatePlayerParentLink('', parents, undefined, 'ar');
  const en = validatePlayerParentLink('', parents, undefined, 'en');
  assert.match(ar.message, /ولي الأمر/);
  assert.match(en.message, /Select a parent/);
  assert.match(validatePlayerParentLink('removed', parents, undefined, 'en').message, /unavailable/);
});
