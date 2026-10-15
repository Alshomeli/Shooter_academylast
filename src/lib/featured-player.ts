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
