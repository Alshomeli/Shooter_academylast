import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const publicConfig = readFileSync(new URL('../src/data/public-academy.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/views/AcademyHome.tsx', import.meta.url), 'utf8');
const base = 'https://shooter-academy-new-1vvk.bolt.host/';

const match = html.match(/<script id="academy-organization-schema" type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error('Public Organization JSON-LD missing from initial response');
const schema = JSON.parse(match[1]);
const [org, website] = schema['@graph'];

test('the public website emits parseable structured data without JS rendering', () => {
  assert.equal((html.match(/type="application\/ld\+json"/g) || []).length, 1);
  assert.equal(schema['@context'], 'https://schema.org');
  assert.equal(org['@type'], 'Organization');
  assert.equal(website['@type'], 'WebSite');
  assert.equal(website.publisher['@id'], org['@id']);
});

test('schema identifies only confirmed academy contact details and original brand', () => {
  assert.equal(org.url, base);
  assert.equal(org.name, 'أكاديمية شوتر لكرة القدم');
  assert.equal(org.alternateName, 'Shooter Academy');
  assert.equal(org.logo.url, base+'1790474303638.jpg');
  assert.ok(home.includes('src="/1790474303638.jpg"'));
  assert.equal(org.email, 'shooter.academy.bh@gmail.com');
  assert.equal(org.telephone, '+97332287776');
  assert.equal(org.address.addressCountry, 'BH');
  assert.equal(org.address.addressLocality, 'Muharraq');
  assert.ok(!('legalName' in org));
  assert.ok(!('taxID' in org));
});

test('public social profiles are aligned with academy links', () => {
  for (const link of org.sameAs) assert.ok(publicConfig.includes(link),link);
  assert.equal(website.url, base);
  assert.deepEqual(website.inLanguage, ['ar', 'en']);
  assert.equal(html.match(/rel="canonical" href="https:\/\/shooter-academy-new-1vvk\.bolt\.host\//g)?.length,1);
});

test('private portal and legal pages remove public organization schema while retaining noindex', () => {
  assert.match(entry, /getElementById\('academy-organization-schema'\)\?\.remove\(\)/);
  assert.match(entry, /'noindex,nofollow'/);
});
