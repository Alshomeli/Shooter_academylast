import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/views/AcademyHome.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/academy-home.css', import.meta.url), 'utf8');
const crest = readFileSync(new URL('../public/copilot_image_1776165482483-300x300.png', import.meta.url));

test('homepage uses the existing transparent Shooter Academy logo instead of tiny white-backed JPEG', () => {
  assert.match(home, /className="ah-brand-logo" src="\/copilot_image_1776165482483-300x300\.png"/);
  assert.doesNotMatch(home, /className="ah-brand"><img src="\/1790474303638\.jpg"/);
  assert.ok(crest.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  assert.equal(crest[25], 6, 'PNG must use RGBA (transparent-background capable)');
  assert.ok(statSync(new URL('../public/copilot_image_1776165482483-300x300.png', import.meta.url)).size < 120_000);
});

test('header logo has legible dimensions and red-accented backing at mobile breakpoints', () => {
  assert.match(css, /\.ah-brand \.ah-brand-logo\{/);
  assert.match(css, /width:68px;height:68px/);
  assert.match(css, /width:52px;height:52px/);
  assert.match(css, /border:1px solid #963542/);
  assert.match(css, /\.ah-brand:focus-visible/);
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
