import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapApplication } from '../src/lib/registration-mappers.ts';
import { completeRegistrationUpload, registrationFilePath } from '../src/lib/registration-upload.ts';
import { academyToday, getDateRange, getLifecycleStatus } from '../src/lib/report-dates.ts';

test('registration schema fields preserve parent name, child notes, type and resume identifiers', () => {
  const app = mapApplication({
    id: 'application', registration_type: 'initial_onboarding', status: 'needs_info',
    parent_full_name: 'Test parent', parent_email: 'parent@example.invalid',
    registration_children: [{ id: 'child', client_key: 'stable-key', approved_player_id: 'approved-child', full_name: 'Test child', parent_notes: 'Needs glasses', birth_date: '2015-01-01' }],
    registration_documents: [{ id: 'doc', child_id: 'child', file_category: 'photo', storage_path: 'applications/application/child/photo.webp', mime_type: 'image/webp', file_size: 100 }],
  });
  assert.equal(app.children[0].playerId, 'approved-child');
  assert.equal(app.parentName, 'Test parent');
  assert.equal(app.registrationType, 'initial_onboarding');
  assert.equal(app.children[0].notes, 'Needs glasses');
  assert.equal(app.children[0].clientKey, 'stable-key');
  assert.equal(app.documents[0].childId, app.children[0].id);
});

test('retry after metadata failure reuses the uploaded object exactly once', async () => {
  const job = { path: 'applications/app/child/photo.webp', uploaded: false };
  const uploaded = [], registered = [];
  const upload = async path => uploaded.push(path);
  const register = async path => { registered.push(path); if (registered.length === 1) throw new Error('connection interrupted'); };
  await assert.rejects(completeRegistrationUpload(job, upload, register), /interrupted/);
  await completeRegistrationUpload(job, upload, register);
  assert.deepEqual(uploaded, [job.path]);
  assert.deepEqual(registered, [job.path, job.path]);
});

test('upload failure prevents metadata registration and permits a retry', async () => {
  const job = { path: 'applications/app/child/photo.webp', uploaded: false };
  let registrations = 0;
  const register = async () => { registrations++; };
  await assert.rejects(completeRegistrationUpload(job, async () => { throw new Error('offline'); }, register), /offline/);
  assert.equal(job.uploaded, false); assert.equal(registrations, 0);
  await completeRegistrationUpload(job, async () => {}, register);
  assert.equal(registrations, 1);
});

test('storage paths use random names and match actual file MIME types', () => {
  assert.match(registrationFilePath('app', 'child', 'image/webp'), /^applications\/app\/child\/[0-9a-f-]+\.webp$/);
  assert.match(registrationFilePath('app', 'child', 'application/pdf'), /\.pdf$/);
  assert.throws(() => registrationFilePath('app', 'child', 'text/html'), /Use JPG/);
});

test('Bahrain dates and report presets cover year boundaries without time-zone drift', () => {
  assert.equal(academyToday(new Date('2026-09-21T22:00:00Z')), '2026-09-22');
  assert.deepEqual(getDateRange('last_month', '2026-01-02'), ['2025-12-01', '2025-12-31']);
  assert.deepEqual(getDateRange('last_3_months', '2026-01-02'), ['2025-11-01', '2026-01-02']);
  assert.deepEqual(getDateRange('this_month', '2024-02-15'), ['2024-02-01', '2024-02-29']);
});

test('subscription lifecycle includes both boundary dates and ignores payment status', () => {
  assert.equal(getLifecycleStatus({ startDate: '2026-09-22', endDate: '2026-10-22', status: 'unpaid' }, '2026-09-22'), 'active');
  assert.equal(getLifecycleStatus({ startDate: '2026-09-01', endDate: '2026-09-22', status: 'paid' }, '2026-09-22'), 'expiring');
  assert.equal(getLifecycleStatus({ startDate: '2026-09-01', endDate: '2026-09-21' }, '2026-09-22'), 'expired');
  assert.equal(getLifecycleStatus({ startDate: '2026-09-23', endDate: '2026-10-23' }, '2026-09-22'), 'future');
});
