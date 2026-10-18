import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/views/AcademyHome.tsx', import.meta.url), 'utf8');
const legal = readFileSync(new URL('../src/views/LegalPage.tsx', import.meta.url), 'utf8');
const parent = readFileSync(new URL('../src/views/ParentPortal.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/academy-home.css', import.meta.url), 'utf8');

test('social icons occur only in the public header and footer', () => {
  assert.equal((home.match(/<SocialLinks links=\{links\}/g) || []).length, 2);
  const contact = home.split('className="ah-contact"')[1]?.split('</section>')[0] || '';
  assert.doesNotMatch(contact, /<SocialLinks/);
  assert.match(home, /className="ah-footer-social"/);
  assert.match(home, /className="ah-social-label-hidden"/);
  assert.match(css, /\.ah-social a:focus-visible/);
});

test('each linked social network has a recognizable symbol and a text alternative', () => {
  for (const platform of ['instagram', 'whatsapp', 'facebook', 'tiktok']) {
    assert.match(home, new RegExp("kind: '" + platform + "'"));
    assert.match(css, new RegExp('\\.ah-social \\.' + platform));
  }
  assert.match(home, /aria-label=\{lang === "en" \? `Shooter Academy on/);
  assert.match(home, /: `حساب أكاديمية شوتر على/);
  assert.match(home, /<rect x="3" y="3" width="18" height="18" rx="5"\/>/);
});

test('the verified official email is consistent across public and parent pages', () => {
  for (const [page, content] of [['home', home], ['legal', legal], ['parent', parent]]) {
    assert.ok(content.includes('shooter.academy.bh@gmail.com'), page);
    assert.ok(!content.includes('football.shooter.academy@gmail.com'), page);
  }
  assert.match(home, /mailto:shooter\.academy\.bh@gmail\.com/);
});
