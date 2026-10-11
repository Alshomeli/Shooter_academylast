import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renewalDraft } from '../src/lib/subscription-dates.ts';
import { academyToday } from '../src/lib/report-dates.ts';
import { assertNewAttendance } from '../src/lib/attendance-identity.ts';
import { mapAttendance, attendanceToRow } from '../src/lib/db-mappers.ts';

test('renewal keeps the old paid object intact and strips payment evidence and row version', () => {
  const old = { id:'old', version:7, playerId:'p', planType:'monthly', amount:35,
    startDate:'2026-01-01', endDate:'2026-02-01', status:'paid', paidAt:'2026-01-01T00:00:00Z', paymentMethod:'cash' };
  const original = structuredClone(old);
  const next = renewalDraft(old,'2026-03-01');
  assert.deepEqual(old, original);
  assert.deepEqual(next, {playerId:'p',planType:'monthly',amount:35,startDate:'2026-03-01',endDate:'2026-04-01',status:'unpaid'});
  assert.equal(renewalDraft(old,'2026-01-15').startDate,'2026-02-02');
  assert.equal(renewalDraft({...old,endDate:'2028-01-30'},'2028-01-31').endDate,'2028-02-29');
});

test('batch attendance rejects existing and within-batch repeats, including a stale date', () => {
  const a = {id:'a',playerId:'p',sessionType:'match',sessionDate:'2026-10-11',matchId:'m1',status:'present'};
  assert.throws(()=>assertNewAttendance([a],[a]),/already recorded/);
  assert.throws(()=>assertNewAttendance([],[a,a]),/already recorded/);
  assert.throws(()=>assertNewAttendance([a],[{...a,sessionDate:'2026-10-12'}]),/already recorded/);
  assert.doesNotThrow(()=>assertNewAttendance([a],[{...a,matchId:'m2'}]));
  assert.doesNotThrow(()=>assertNewAttendance([a],[{...a,playerId:'p2'}]));
  const training = {...a,sessionType:'training',matchId:undefined,trainingId:'training-1'};
  assert.throws(()=>assertNewAttendance([training],[{...training,sessionDate:'2026-10-12'}]),/already recorded/);
  assert.doesNotThrow(()=>assertNewAttendance([training],[{...training,trainingId:'training-2'}]));
});

test('match IDs survive the actual frontend database mapper round trip as text', () => {
  const record = {id:'a',playerId:'p',sessionType:'match',sessionDate:'2026-10-11',matchId:'match-non-uuid',status:'present'};
  const row = attendanceToRow(record);
  assert.equal(row.match_id,'match-non-uuid'); assert.equal(row.training_id,null);
  assert.equal(mapAttendance(row).matchId,record.matchId);
});

test('attendance and renewal business dates follow Bahrain across UTC midnight and year boundaries', () => {
  assert.equal(academyToday(new Date('2026-10-10T21:01:00Z')),'2026-10-11');
  assert.equal(academyToday(new Date('2026-12-31T21:01:00Z')),'2027-01-01');
});
