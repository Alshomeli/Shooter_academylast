import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/views/AcademyHome.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/academy-home.css', import.meta.url), 'utf8');

test('home header preserves the owner-approved original Shooter Academy badge', () => {
  assert.match(home, /className="ah-brand"><img src="\/1790474303638\.jpg" width="54" height="60"/);
  assert.ok(!home.includes('className="ah-brand-logo"'));
  assert.ok(!home.includes('src="/copilot_image_1776165482483-300x300.png"'));
  assert.ok(statSync(new URL('../public/1790474303638.jpg', import.meta.url)).size > 1000);
});

test('restores original brand CSS and does not add alternate crest frame', () => {
  assert.match(css, /\.ah-brand img\{width:48px;height:54px/);
  assert.match(css, /\.ah-brand img\{width:39px;height:44px/);
  assert.ok(!css.includes('.ah-brand .ah-brand-logo'));
});

test('coaching principle cards have visible large descriptions and both color modes', () => {
  assert.match(css, /\.ah-principles\{display:grid;gap:12px\}/);
  assert.match(css, /\.ah-principles p\{font-size:15px/);
  assert.match(css, /\.ah-dark \.ah-principles>div\{/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test('social links remain only at the top and bottom of the public website', () => {
  assert.equal((home.match(/<SocialLinks links=\{links\}/g) || []).length, 2);
});
