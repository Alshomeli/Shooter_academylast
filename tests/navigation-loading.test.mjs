import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Source-only checks: importing App would initialize the real auth/data clients.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('section identity resets Suspense instead of keeping an unrelated view visible', () => {
  assert.match(app, /<Suspense key=\{`\$\{activeRole\}:\$\{safeCurrentTab\}`\} fallback=\{<ViewLoader lang=\{lang\} \/>\}>/);
  assert.match(app, /<ContextualShooterAI page=\{safeCurrentTab\}[\s\S]*?\{renderView\(\)\}[\s\S]*?<\/Suspense>/);
});

test('a failed section boundary resets when the account, role, or section changes', () => {
  assert.match(app, /<ErrorBoundary key=\{`\$\{currentUser\.authUserId\}:\$\{activeRole\}:\$\{safeCurrentTab\}`\} lang=\{lang\}>/);
});

test('the loading fallback has a localized visible and accessible status', () => {
  const loader = app.slice(app.indexOf('function ViewLoader('), app.indexOf('type DataState'));
  assert.match(loader, /role="status"/);
  assert.match(loader, /<Loader2 aria-hidden="true"/);
  assert.match(loader, /\{tr\(lang\)\.loading\}/);
  assert.match(loader, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/);
  assert.doesNotMatch(app, /<ViewLoader\s*\/>/);
});
