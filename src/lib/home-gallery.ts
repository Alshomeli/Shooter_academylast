/** Group only known academy festival photos when older CMS records lack an album. */
const festivalPaths = new Set([
  '/home/festival-team.jpg',
  '/home/festival-stands.jpg',
  '/home/festival-medals.jpg',
]);

export const festivalAlbumName = 'مهرجان الاتحاد الآسيوي لمواليد 2014';

export function isAcademyFestivalPhoto(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const path = new URL(value, 'https://shooter-academy-new-1vvk.bolt.host').pathname;
    return festivalPaths.has(decodeURIComponent(path).toLowerCase());
  } catch {
    return false;
  }
}

export function galleryAlbum(value: string | undefined, savedAlbum: string | undefined): string | undefined {
  return savedAlbum?.trim() || (isAcademyFestivalPhoto(value) ? festivalAlbumName : undefined);
}

/** Preserve editorial associations and infer only the known festival news link. */
export function galleryNewsId(
  value: string | undefined,
  savedNewsId: string | undefined,
  news: ReadonlyArray<{ id: string; title: string }>,
): string | undefined {
  if (savedNewsId?.trim()) return savedNewsId.trim();
  if (!isAcademyFestivalPhoto(value)) return undefined;
  return news.find(item => /مهرجان الاتحاد الآسيوي|AFC Festival/i.test(item.title))?.id;
}
