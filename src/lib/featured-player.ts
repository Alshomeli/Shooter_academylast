import type { CSSProperties } from 'react';

/** Clamp manager-controlled percentages before using them in inline CSS. */
function percentage(value: string | undefined, fallback: number, min: number, max: number): string {
  if (!value?.trim()) return `${fallback}%`;
  const number = Number(value);
  return `${Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback}%`;
}

export function featuredImageStyle(payload: Record<string, string>): CSSProperties {
  return {
    '--featured-left': percentage(payload.featured_left, 1, -20, 30),
    '--featured-width': percentage(payload.featured_width, 50, 28, 70),
    '--featured-height': percentage(payload.featured_height, 94, 50, 100),
  } as CSSProperties;
}

/** Avoid publishing an incomplete featured-player announcement. */
export function featuredPlayerValidationError(payload: Record<string, string>): string | null {
  const name = Boolean(payload.featured_name?.trim());
  const image = Boolean(payload.featured_image_path?.trim() || payload.featured_image?.trim());
  const details = Boolean(payload.featured_heading?.trim() || payload.featured_body?.trim());
  if (!(name || image || details)) return null; // A contact-only entry is valid.
  if (!name) return 'أدخل اسم اللاعب قبل نشر بطاقة التكريم.';
  if (!image) return 'ارفع صورة اللاعب قبل نشر بطاقة التكريم.';
  return null;
}
