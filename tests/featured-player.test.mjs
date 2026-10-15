import assert from 'node:assert/strict';
import test from 'node:test';
import { featuredImageStyle } from '../src/lib/featured-player.ts';

test('featured player uses stable placement defaults', () => {
  assert.deepEqual(featuredImageStyle({}), {
    '--featured-left': '1%',
    '--featured-width': '50%',
    '--featured-height': '94%',
  });
});

test('featured player placement is bounded when manager moves sliders', () => {
  assert.deepEqual(featuredImageStyle({
    featured_left: '-100',
    featured_width: '200',
    featured_height: '22',
  }), {
    '--featured-left': '-20%',
    '--featured-width': '70%',
    '--featured-height': '50%',
  });
});

test('featured player ignores invalid or non-finite percentages', () => {
  assert.deepEqual(featuredImageStyle({
    featured_left: 'not-a-number',
    featured_width: 'Infinity',
    featured_height: 'NaN',
  }), {
    '--featured-left': '1%',
    '--featured-width': '50%',
    '--featured-height': '94%',
  });
});
