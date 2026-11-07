import type { Lang } from '@/types';

const PREFIX = 'shooter_';
function read(key: string) {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* Use the current state when browser storage is unavailable. */ }
}
// Shared between the public site and portal; contains no auth or database imports.
export const prefs = {
  getLang: (): Lang => read('lang') === 'en' ? 'en' : 'ar',
  saveLang: (value: Lang) => write('lang', value),
  getDarkMode: (): boolean => read('red_identity_mode') !== 'false',
  saveDarkMode: (value: boolean) => write('red_identity_mode', String(value)),
};
