import type { SyntheticEvent } from 'react';

export const DEFAULT_ACADEMY_LOGO = '/shooter-logo-transparent.png';

export function academyLogoSource(value?: string): string {
  const source = value?.trim() || '';
  if (!source || /^\/?(?:public\/)?shooter-logo\.(?:svg|png)$/i.test(source)) return DEFAULT_ACADEMY_LOGO;
  if (/^(https?:\/\/|data:image\/|\/)/i.test(source)) return source;
  if (/\.(?:png|jpe?g|webp|svg)$/i.test(source)) return '/' + source.replace(/^public\//i, '');
  return DEFAULT_ACADEMY_LOGO;
}

export function handleAcademyLogoError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  // Do not retry forever if even the bundled fallback cannot load.
  if (image.getAttribute('src') !== DEFAULT_ACADEMY_LOGO) {
    image.src = DEFAULT_ACADEMY_LOGO;
  }
}
