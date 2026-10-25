import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getInitialTab, getPostLoginTab, getTabUrl, isNavigationTab } from '../src/lib/navigation.ts';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const allowedViewsByRole = {
  manager: ['dashboard', 'subscriptions', 'settings'],
  accountant: ['dashboard', 'subscriptions'],
  coach: ['dashboard', 'attendance'],
  receptionist: ['dashboard', 'subscriptions'],
};

test('loads a validated section from the independent tab parameter', () => {
  assert.equal(getInitialTab('/', '?tab=subscriptions', ''), 'subscriptions');
  assert.equal(getInitialTab('/', '?view=login&tab=subscriptions', ''), 'subscriptions');
  assert.equal(getInitialTab('/', '?tab=not-a-section', ''), 'dashboard');
  assert.equal(getInitialTab('/', '?tab=registration', ''), 'dashboard');
  assert.equal(isNavigationTab('subscriptions'), true);
  assert.equal(isNavigationTab('not-a-section'), false);
  assert.equal(isNavigationTab('registration'), false);
});

test('preserves direct-entry and registration routes ahead of tab values', () => {
  assert.equal(getInitialTab('/parent/', '?tab=subscriptions', ''), 'registration');
  assert.equal(getInitialTab('/coach', '?tab=subscriptions', ''), 'staff-registration');
  assert.equal(getInitialTab('/', '?view=registration&tab=subscriptions', ''), 'registration');
  assert.equal(getInitialTab('/', '?view=staff-registration&tab=subscriptions', ''), 'staff-registration');
  assert.equal(getInitialTab('/', '?view=registration-admin&tab=subscriptions', ''), 'registration-admin');
  assert.equal(getInitialTab('/', '', '#registration'), 'registration');
});

test('updates only tab and preserves login, unrelated query parameters, and hash', () => {
  assert.equal(
    getTabUrl('subscriptions', 'https://academy.example/?view=login&lang=ar#top'),
    '/?view=login&lang=ar&tab=subscriptions#top',
  );
  assert.equal(
    getTabUrl('dashboard', 'https://academy.example/?view=login&tab=staff&lang=ar#top'),
    '/?view=login&lang=ar#top',
  );
  assert.equal(
    getTabUrl('registration', 'https://academy.example/?view=registration&tab=subscriptions'),
    '/?view=registration',
  );
});

test('restores a post-login tab only when the authenticated role may open it', () => {
  const manager = { role: 'manager', registrationOnly: false };
  const coach = { role: 'coach', registrationOnly: false };
  assert.equal(getPostLoginTab(manager, 'login', 'subscriptions', allowedViewsByRole), 'subscriptions');
  assert.equal(getPostLoginTab(coach, 'login', 'attendance', allowedViewsByRole), 'attendance');
  assert.equal(getPostLoginTab(coach, 'login', 'subscriptions', allowedViewsByRole), 'dashboard');
  assert.equal(getPostLoginTab(manager, 'login', 'not-a-section', allowedViewsByRole), 'dashboard');
  assert.equal(getPostLoginTab(manager, 'login', null, allowedViewsByRole), 'dashboard');
});

test('keeps registration-only and parent login choices ahead of tab restoration', () => {
  assert.equal(
    getPostLoginTab({ role: 'manager', registrationOnly: true, registrationMode: 'staff' }, 'login', 'subscriptions', allowedViewsByRole),
    'staff-registration',
  );
  assert.equal(
    getPostLoginTab({ role: 'manager', registrationOnly: true, registrationMode: 'choose' }, 'login', 'subscriptions', allowedViewsByRole),
    'dashboard',
  );
  assert.equal(
    getPostLoginTab({ role: 'manager', registrationOnly: false }, 'registration', 'subscriptions', allowedViewsByRole),
    'registration',
  );
  assert.equal(
    getPostLoginTab({ role: 'parent', registrationOnly: false }, 'login', 'subscriptions', allowedViewsByRole),
    'dashboard',
  );
  assert.equal(
    getPostLoginTab({ role: 'parent', registrationOnly: true, registrationMode: 'parent' }, 'registration', 'subscriptions', allowedViewsByRole),
    'registration',
  );
});

test('App uses the selected login tab together with the authenticated role allowlist', () => {
  assert.match(app, /getInitialTab\(window\.location\.pathname, window\.location\.search, window\.location\.hash\)/);
  assert.match(app, /window\.history\.replaceState\(window\.history\.state, '', getTabUrl\(tab, window\.location\.href\)\)/);
  assert.match(app, /getPostLoginTab\(user, params\.get\('view'\), params\.get\('tab'\), ALLOWED_VIEWS_BY_ROLE\)/);
});

test('URL-selected tabs remain subject to the existing role allowlist', () => {
  assert.match(app, /ALLOWED_VIEWS_BY_ROLE\[activeRole\].*?\.includes\(currentTab\)/s);
  assert.match(app, /ALLOWED_VIEWS_BY_ROLE\[currentUser\.role as Exclude<Role, 'parent'>\]\?\.includes\(currentTab\)/);
});
