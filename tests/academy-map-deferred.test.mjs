import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/views/AcademyHome.tsx', import.meta.url), 'utf8');
const map = readFileSync(new URL('../src/components/DeferredAcademyMap.tsx', import.meta.url), 'utf8');

test('academy map defers the external iframe until it is near the viewport', () => {
  assert.match(home, /<DeferredAcademyMap[\s\S]*fallbackHref=\{links\.maps\}/);
  assert.doesNotMatch(home, /<iframe\b/);
  assert.match(map, /new IntersectionObserver/);
  assert.match(map, /rootMargin: '400px 0px'/);
  assert.match(map, /loading="lazy"/);
  assert.match(map, /setShouldLoad\(true\)/);
});

test('deferred academy map keeps a visible loading status and Google Maps fallback', () => {
  assert.match(map, /role="status"/);
  assert.match(map, /aria-live="polite"/);
  assert.match(map, /fallbackHref/);
  assert.match(map, /target="_blank" rel="noopener noreferrer"/);
  assert.match(home, /fallbackLabel=\{lang === 'ar' \? 'فتح الموقع في خرائط Google' : 'Open location in Google Maps'\}/);
  assert.match(home, /loadingLabel=\{lang === 'ar' \? 'سيتم تحميل الخريطة عند الاقتراب منها' : 'The map will load as you approach it'\}/);
});
