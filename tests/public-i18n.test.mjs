import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { publicLanguage, publicText, publicEnglish } from '../src/lib/public-i18n.ts';
import { galleryNewsId } from '../src/lib/home-gallery.ts';
import { isPublicHome } from '../src/lib/public-entry.ts';

test('English and Arabic homepage language can be bookmarked and persisted', () => {
  assert.equal(publicLanguage('?lang=en', 'ar'), 'en');
  assert.equal(publicLanguage('?utm_source=instagram&lang=ar', 'en'), 'ar');
  assert.equal(publicLanguage('?lang=invalid', 'en'), 'en');
  assert.equal(publicLanguage('', 'ar'), 'ar');
  assert.equal(isPublicHome('/', '?lang=en', ''), true);
  assert.equal(isPublicHome('/', '?lang=en&view=login', ''), false);
});

test('all public text translates only when selected and prefers manager approved translation', () => {
  assert.equal(publicText('الشروط والأحكام', 'en'), 'Terms & Conditions');
  assert.equal(publicText('الشروط والأحكام', 'ar'), 'الشروط والأحكام');
  assert.equal(publicText('خبر جديد', 'en', 'New Story'), 'New Story');
  assert.equal(publicText('خبر جديد', 'en', '  '), 'خبر جديد');
  assert.equal(publicText('خبر جديد', 'ar', 'New Story'), 'خبر جديد');
  assert.equal(publicText(undefined, 'en'), '');
  assert.equal(publicText('مهرجان الاتحاد الآسيوي لمواليد 2014', 'en'), 'AFC Festival — 2014 Age Group');
});

test('each static homepage text node has a deliberate English translation', () => {
  const home = readFileSync(new URL('../src/views/AcademyHome.tsx', import.meta.url), 'utf8');
  const staticLabels = [...home.matchAll(/\{tr\("([^"]+)"\)\}/g)].map(m => m[1]);
  assert.ok(staticLabels.length > 70, 'expected all static JSX sections to use translations');
  for (const label of staticLabels) assert.ok(publicEnglish[label], 'English text missing for: ' + label);
  assert.match(home, /className="ah-language-toggle"/);
  assert.match(home, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/);
  assert.match(home, /<AcademyGallery photos=\{publicGallery\} lang=\{lang\}\/>/);
});

test('legal pages preserve all text in both languages and section hash IDs', () => {
  const policy = readFileSync(new URL('../src/views/LegalPage.tsx', import.meta.url), 'utf8');
  for (const heading of ['Information We Collect', 'Registration and Admission', 'Cancellation and Refunds', 'Privacy & Data Protection']) {
    assert.ok(policy.includes(heading), heading);
  }
  assert.ok(policy.includes("id: 'payments'"));
  assert.ok(policy.includes("id: 'refunds'"));
  assert.ok(policy.includes("aria-label={english ? 'Legal navigation'"));
});

test('festival images remain attached to their news when English is selected', () => {
  const enNews = [{ id: 'story-1', title: '2014 Age Group at the AFC Festival' }];
  assert.equal(galleryNewsId('/home/festival-team.jpg', undefined, enNews), 'story-1');
  assert.equal(galleryNewsId('/home/festival-team.jpg', 'explicit-story', enNews), 'explicit-story');
});
