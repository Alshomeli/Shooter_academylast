import assert from 'node:assert/strict';
import test from 'node:test';
import { hasReviewedCurrentDraft } from '../src/lib/content-review.ts';

const draft = { id: 'article-1', sort_order: 4, payload: { title: 'خبر الأكاديمية', image_path: 'media/player.webp', image: '', body: 'الأصل' } };
const signedPreview = { id: 'article-1', sort_order: 4, payload: { ...draft.payload, image: 'https://example.org/signed-player.webp' } };

test('drafts must be previewed before publishing', () => {
  assert.equal(hasReviewedCurrentDraft(draft, null), false);
  assert.equal(hasReviewedCurrentDraft(null, signedPreview), false);
  assert.equal(hasReviewedCurrentDraft(draft, signedPreview), true);
});

test('a changed title, body, file path, order or selected item invalidates a preview', () => {
  assert.equal(hasReviewedCurrentDraft({ ...draft, payload: { ...draft.payload, body: 'نص جديد' } }, signedPreview), false);
  assert.equal(hasReviewedCurrentDraft({ ...draft, payload: { ...draft.payload, title: 'عنوان آخر' } }, signedPreview), false);
  assert.equal(hasReviewedCurrentDraft({ ...draft, payload: { ...draft.payload, image_path: 'media/another.webp' } }, signedPreview), false);
  assert.equal(hasReviewedCurrentDraft({ ...draft, sort_order: 7 }, signedPreview), false);
  assert.equal(hasReviewedCurrentDraft({ ...draft, id: 'another-id' }, signedPreview), false);
});

test('direct media URLs must still match the exact reviewed version', () => {
  const direct = { id: 'news', sort_order: 1, payload: { image: '/home/a.jpg', title: 'مباشر' } };
  assert.equal(hasReviewedCurrentDraft(direct, { ...direct, payload: { ...direct.payload } }), true);
  assert.equal(hasReviewedCurrentDraft(direct, { ...direct, payload: { ...direct.payload, image: '/home/b.jpg' } }), false);
});
