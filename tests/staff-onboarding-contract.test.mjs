import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/migrations/20260930020528_create_staff_application_workflow.sql', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const login = await readFile(new URL('../src/components/Login.tsx', import.meta.url), 'utf8');
const approvals = await readFile(new URL('../src/views/Approvals.tsx', import.meta.url), 'utf8');
const staffRegistration = await readFile(new URL('../src/views/StaffRegistration.tsx', import.meta.url), 'utf8');

test('staff applicants can request only non-manager roles and approval is manager-gated', () => {
  assert.match(migration, /requested_role in \('coach','accountant','receptionist'\)/);
  assert.doesNotMatch(migration, /requested_role in \([^\)]*manager/);
  assert.match(migration, /internal\.is_academy_admin\(\)/);
  assert.match(migration, /Only pending applications can be approved/);
  assert.match(migration, /status='approved'/);
  assert.match(migration, /status='active'/);
});

test('staff self-onboarding preserves operational staff table until manager approval', () => {
  const approvalStart = migration.indexOf('create or replace function internal.approve_staff_application');
  const approvalEnd = migration.indexOf('create or replace function public.approve_staff_application', approvalStart);
  const approvalBody = migration.slice(approvalStart, approvalEnd);
  assert.ok(approvalStart >= 0);
  assert.match(approvalBody, /v_row\.status <> 'pending'/);
  assert.match(approvalBody, /insert into public\.staff/);
  assert.match(migration, /applicant_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /grant select on public\.staff_applications to authenticated/);
  assert.doesNotMatch(migration, /grant insert on public\.staff_applications to authenticated/);
});

test('staff onboarding supports approve reject and request-changes lifecycle', () => {
  assert.match(migration, /'needs_info'/);
  assert.match(migration, /'rejected'/);
  assert.match(approvals, /Request changes/);
  assert.match(approvals, /approveStaffApplication/);
  assert.match(approvals, /reviewStaffApplication/);
  assert.match(staffRegistration, /Save and resubmit/);
});

test('authentication routes unapproved staff back to staff onboarding without granting role access', () => {
  assert.match(login, /staff-registration/);
  assert.match(app, /currentUser\.registrationOnly && currentUser\.registrationMode === 'staff'/);
  assert.match(app, /StaffRegistration/);
  assert.match(staffRegistration, /No staff permissions are activated before manager approval/);
});


test('manager review writes run through a checked security-definer implementation', async () => {
  const fix = await readFile(new URL('../supabase/migrations/20260930020957_fix_staff_application_review_rpc.sql', import.meta.url), 'utf8');
  assert.match(fix, /create or replace function internal\.review_staff_application/);
  assert.match(fix, /security definer/);
  assert.match(fix, /internal\.is_academy_admin\(\)/);
  assert.match(fix, /select internal\.review_staff_application\(\$1,\$2,\$3\)/);
  assert.match(fix, /grant execute on function public\.review_staff_application\(uuid,text,text\) to authenticated/);
});
