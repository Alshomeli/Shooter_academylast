import assert from 'node:assert/strict';
import test from 'node:test';
import { isRecognizedChild } from '../src/lib/player-recognition.ts';

test('congratulates only the guardian of the identified player', () => {
  assert.equal(isRecognizedChild('player-a', ['player-a','player-b']), true);
  assert.equal(isRecognizedChild('player-a', ['player-c']), false);
});
test('missing or empty player ID never triggers a private congratulation', () => {
  assert.equal(isRecognizedChild(undefined, ['player-a']), false);
  assert.equal(isRecognizedChild('', ['player-a']), false);
  assert.equal(isRecognizedChild('   ', ['player-a']), false);
});
test('player IDs require an exact match', () => {
  assert.equal(isRecognizedChild('player-1', ['player-10']), false);
  assert.equal(isRecognizedChild('player-1', []), false);
});
