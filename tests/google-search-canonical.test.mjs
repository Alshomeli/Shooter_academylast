import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/views/AcademyHome.tsx', import.meta.url), 'utf8');
const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
const notes = readFileSync(new URL('../docs/google-search-and-domain-transition-2026-10-15.md', import.meta.url), 'utf8');
const official = 'https://shooter-academy-new-1vvk.bolt.host/';

test('official homepage has one static canonical at the Bolt host', () => {
  assert.equal((index.match(/rel="canonical"/g)||[]).length,1);
  assert.ok(index.includes('rel="canonical" href="' + official + '"'));
  assert.match(index, /meta property="og:url" content="https:\/\/shooter-academy-new-1vvk\.bolt\.host\//);
  assert.ok(!index.includes('rel="canonical" href="https://shooter.academy/'));
});

test('shared app entry does not force indexing of authentication or legal routes', () => {
  assert.ok(!index.includes('<meta name="robots" content="index,follow'));
  assert.ok(!index.includes('google-site-verification'));
});

test('Arabic and English variants have consistent hreflang navigation', () => {
  for (const lang of ['ar','en','x-default']) {
    assert.match(index, new RegExp('rel="alternate" hreflang="' + lang + '"'));
    assert.match(sitemap, new RegExp('hreflang="' + lang + '"'));
  }
  assert.ok(sitemap.includes('<loc>' + official + '</loc>'));
  assert.ok(sitemap.includes('<loc>' + official + '?lang=en</loc>'));
  assert.match(home, /canonical\.href = new URL\(lang === 'en' \? '\/\?lang=en' : '\/'/);
});

test('English/Arabic public page updates its share metadata without claiming Google ownership', () => {
  assert.ok(home.includes('meta[property="og:locale"]'));
  assert.ok(home.includes('meta[property="og:url"]'));
  assert.ok(home.includes('meta[name="twitter:title"]'));
  assert.ok(!index.includes('name="google-site-verification"'));
  assert.ok(notes.includes('URL prefix'));
  assert.ok(notes.includes('HTML tag verification'));
});

test('public sitemap advertised without ever blocking the whole Bolt website', () => {
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.ok(robots.includes('Sitemap: '+official+'sitemap.xml'));
  assert.ok(!robots.includes('Disallow: /\n'));
  assert.ok(notes.includes('If the academy does NOT control'));
});
