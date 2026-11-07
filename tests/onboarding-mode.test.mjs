import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOnboardingMode } from '../src/lib/onboarding-mode.ts';
test('Google return preserves the selected application, including switched tabs', () => {
  assert.equal(resolveOnboardingMode(undefined, '?view=staff-registration'), 'staff');
  assert.equal(resolveOnboardingMode('parent', '?view=staff-registration'), 'staff');
  assert.equal(resolveOnboardingMode('staff', '?view=registration'), 'parent');
});
test('normal sign-in keeps recorded intent and asks unknown accounts', () => {
  assert.equal(resolveOnboardingMode('staff', '?view=login'), 'staff');
  assert.equal(resolveOnboardingMode('parent', ''), 'parent');
  for (const value of [undefined, null, '', 'manager', 'invalid']) {
    assert.equal(resolveOnboardingMode(value, '?view=login'), 'choose');
  }
});
