import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/academy-home.css', import.meta.url), 'utf8');

function relativeLuminance(hex) {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map(part => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test('public WhatsApp social icon has at least 4.5:1 contrast with white', () => {
  const match = css.match(/\.ah-social \.whatsapp\{background:(#[0-9a-fA-F]{6})\}/);
  assert.ok(match, 'WhatsApp social background CSS should be present');
  const backgroundLuminance = relativeLuminance(match[1].slice(1));
  assert.ok((1.05 / (backgroundLuminance + 0.05)) >= 4.5);
});
