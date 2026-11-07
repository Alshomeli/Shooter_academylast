// Preserve all existing deep links and authentication callbacks.
export function isPublicHome(pathname: string, search: string, hash: string): boolean {
  if ((pathname.replace(/\/+$/, '') || '/') !== '/') return false;
  const query = new URLSearchParams(search);
  if (['view', 'tab', 'code', 'error', 'token_hash', 'type', 'authorization_id', 'oauth_return'].some(key => query.has(key))) return false;
  return !hash || ['#about', '#programs', '#coaches', '#media', '#news', '#contact', '#faq', '#top'].includes(hash);
}
