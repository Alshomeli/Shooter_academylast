import assert from 'node:assert/strict';
import test from 'node:test';
import { galleryAlbum, galleryNewsId, festivalAlbumName, isAcademyFestivalPhoto } from '../src/lib/home-gallery.ts';

test('groups the three existing festival images under one album', () => {
  for (const name of ['team', 'stands', 'medals']) {
    const path = '/home/festival-' + name + '.jpg';
    assert.equal(galleryAlbum(path, undefined), festivalAlbumName);
    assert.equal(galleryAlbum('https://shooter-academy-new-1vvk.bolt.host' + path, ''), festivalAlbumName);
  }
});

test('preserves editorial albums and never mislabels unrelated activities', () => {
  assert.equal(galleryAlbum('/home/festival-team.jpg', 'نشاط آخر'), 'نشاط آخر');
  assert.equal(galleryAlbum('/home/skills.jpg', ''), undefined);
  assert.equal(isAcademyFestivalPhoto('/home/festival-team.jpg?mode=full'), true);
  assert.equal(isAcademyFestivalPhoto('https://other.example.test/gallery.jpg'), false);
});

test('festival media associates with the matching festival news without replacing editorial choices', () => {
  const news = [{ id: 'news1', title: 'مشاركة مواليد 2014 في مهرجان الاتحاد الآسيوي' }, { id:'news2', title:'تدريبات الأسبوع' }];
  assert.equal(galleryNewsId('/home/festival-medals.jpg', undefined, news), 'news1');
  assert.equal(galleryNewsId('/home/festival-team.jpg', 'news2', news), 'news2');
  assert.equal(galleryNewsId('/home/skills.jpg', undefined, news), undefined);
  assert.equal(galleryNewsId('/home/festival-team.jpg', '', []), undefined);
});
