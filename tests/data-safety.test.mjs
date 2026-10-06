import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionChanges } from '../src/lib/collection-diff.ts';
import { playerToRow, parentToRow, staffToRow, subscriptionToRow, mapStaff } from '../src/lib/db-mappers.ts';
import { calcEndDate } from '../src/lib/subscription-dates.ts';
import { planLabel, roleLabel, statusLabel, tr } from '../src/lib/i18n.ts';

test('editing one record never deletes records missing from the displayed snapshot', () => {
  const before = [{ id: 'a', name: 'A', version: 3 }, { id: 'b', name: 'B', version: 8 }];
  const next = [before[0], { ...before[1], name: 'Updated' }];
  assert.deepEqual(collectionChanges(before, next, x => x), [{ kind: 'update', id: 'b', version: 8, patch: { name: 'Updated' } }]);
  assert.deepEqual(collectionChanges(before, [before[1]], x => x), [{ kind: 'delete', id: 'a', version: 3 }]);
});
test('an editor retaining an older version conflicts after a background refresh', () => {
  assert.throws(() => collectionChanges([{ id: 'a', name: 'Fresh', version: 2 }], [{ id: 'a', name: 'Stale edit', version: 1 }], x => x), /STALE_RECORD/);
});
test('unloaded private values are omitted from the write payload', () => {
  assert.equal(Object.hasOwn(playerToRow({ id: 'a', privateFieldsLoaded: false, notes: '' }), 'notes'), false);
  assert.equal(Object.hasOwn(parentToRow({ id: 'a', privateFieldsLoaded: false, nationalId: '' }), 'national_id'), false);
  const staff = mapStaff({ id: 'a', salary: 0, private_fields_loaded: false, row_version: 4 });
  assert.equal(staff.privateFieldsLoaded, false); assert.equal(staff.version, 4);
  assert.equal(Object.hasOwn(staffToRow(staff), 'salary'), false);
  assert.equal(Object.hasOwn(staffToRow(staff), 'national_id'), false);
});
test('unlinked foreign keys and unpaid payment metadata use null', () => {
  const player = playerToRow({ id: 'a', parentId: '', teamId: '' });
  assert.equal(player.parent_id, null); assert.equal(player.team_id, null);
  const subscription = subscriptionToRow({ id: 'a', status: 'unpaid', paymentMethod: 'cash', paidAt: '2026-09-01' });
  assert.equal(subscription.payment_method, null); assert.equal(subscription.paid_at, null);
});
test('calendar plans cover annual/semi-annual periods and clamp month ends', () => {
  assert.equal(calcEndDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(calcEndDate('2024-02-29', 'annual'), '2025-02-28');
  assert.equal(calcEndDate('2026-08-31', 'semi_annual'), '2027-02-28');
  assert.equal(calcEndDate('2026-09-22', 'quarterly'), '2026-12-22');
  assert.equal(calcEndDate('', 'monthly'), '');
});
test('Arabic and English role/status/plan labels remain translated', () => {
  assert.equal(planLabel('annual', 'ar'), tr('ar').yearly);
  assert.equal(planLabel('semi_annual', 'en'), 'Semi-annual');
  assert.equal(roleLabel('manager', 'ar'), tr('ar').manager);
  assert.equal(statusLabel('paid', 'en'), tr('en').paid);
});
