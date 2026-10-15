import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicHome } from '../src/lib/public-entry.ts';

test('public homepage accepts navigation anchors and campaign links', () => {
  assert.equal(isPublicHome('/', '', ''), true);
  assert.equal(isPublicHome('/', '?utm_source=instagram', '#programs'), true);
  assert.equal(isPublicHome('/', '', '#faq'), true);
  assert.equal(isPublicHome('/', '?utm_campaign=parents', '#faq'), true);
});
test('existing platform, registration and auth callbacks reach the app', () => {
  for (const path of ['/parent', '/coach', '/privacy', '/terms', '/oauth/consent']) assert.equal(isPublicHome(path, '', ''), false);
  for (const query of ['?view=login', '?view=registration', '?view=staff-registration', '?code=test', '?type=recovery&token_hash=test', '?oauth_return=/oauth/consent', '?error=access_denied']) assert.equal(isPublicHome('/', query, ''), false);
  for (const hash of ['#access_token=test&type=recovery', '#registration', '#staff-registration']) assert.equal(isPublicHome('/', '', hash), false);
});
