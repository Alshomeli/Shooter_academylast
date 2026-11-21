import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/academy-home.css', import.meta.url), 'utf8');
function luminance(hex) {
  const channels = hex.slice(1).match(/../g)?.map(value => {
    const c = parseInt(value, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  assert.ok(channels?.length === 3);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
}

test('public homepage small eyebrow text meets AA contrast on its light background', () => {
  const match = css.match(/\.ah-eyebrow\{color:(#[0-9a-fA-F]{6});font-size:12px;/);
  assert.ok(match, 'Explicit accessible eyebrow foreground is required');
  assert.ok(contrast(match[1], '#f8f8f6') >= 4.5);
  assert.ok(contrast(match[1], '#ffffff') >= 4.5);
});
