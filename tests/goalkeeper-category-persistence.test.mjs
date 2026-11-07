import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryPlayers, canAssignCategory } from '../src/lib/goalkeepers.ts';

const team = { id: 'age-new', categoryKind: 'team', status: 'active' };
const keepers = { id: 'keeper-new', categoryKind: 'goalkeeper', status: 'active' };
const players = [
  { id: 'one', teamId: 'age-new', position: 'حارس مرمى' },
  { id: 'two', teamId: 'age-other', position: 'GK' },
  { id: 'three', teamId: 'age-new', position: 'خط وسط' },
];

test('a new goalkeeper category remains empty after sample players are removed', () => {
  assert.deepEqual(categoryPlayers(keepers, []), []);
});

test('new real goalkeepers appear across age categories without reassigning them', () => {
  assert.deepEqual(categoryPlayers(keepers, players).map(p => p.id), ['one', 'two']);
  assert.deepEqual(categoryPlayers(team, players).map(p => p.id), ['one', 'three']);
  assert.equal(players[0].teamId, 'age-new');
  assert.equal(players[1].teamId, 'age-other');
});

test('goalkeeper category is not available for direct player assignment', () => {
  assert.equal(canAssignCategory(keepers), false);
  assert.equal(canAssignCategory(team), true);
});
