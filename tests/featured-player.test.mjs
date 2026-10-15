import assert from 'node:assert/strict';
import test from 'node:test';
import { featuredImageStyle, featuredPlayerValidationError } from '../src/lib/featured-player.ts';

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

test('contact links alone do not require a featured-player announcement', () => {
  assert.equal(featuredPlayerValidationError({ instagram: 'https://example.org' }), null);
});

test('featured-player details need both a name and an image before publishing', () => {
  assert.match(featuredPlayerValidationError({ featured_name: 'سلمان' }), /صورة اللاعب/);
  assert.match(featuredPlayerValidationError({ featured_image_path: 'media/player.webp' }), /اسم اللاعب/);
  assert.match(featuredPlayerValidationError({ featured_heading: 'لاعب الشهر' }), /اسم اللاعب/);
  assert.equal(featuredPlayerValidationError({ featured_name: ' سلمان ', featured_image_path: 'media/player.webp' }), null);
  assert.equal(featuredPlayerValidationError({ featured_name: 'سلمان', featured_image: '/home/player.png' }), null);
});
