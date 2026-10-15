import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { isPublicHome } from './lib/public-entry';
import './index.css';

const App = lazy(() => import('./App.tsx'));
const AcademyHome = lazy(() => import('./views/AcademyHome.tsx'));
const OAuthConsent = lazy(() => import('./views/OAuthConsent.tsx').then(module => ({ default: module.OAuthConsent })));
const LegalPage = lazy(() => import('./views/LegalPage.tsx').then(module => ({ default: module.LegalPage })));
const legalPath = window.location.pathname.replace(/\/+$/, '') || '/';
const legal = legalPath === '/privacy' || legalPath === '/terms';
const oauthConsent = window.location.pathname === '/oauth/consent';
const home = isPublicHome(window.location.pathname, window.location.search, window.location.hash);

// Keep authenticated areas out of search results. Public legal text stays
// accessible without login but is not indexed until the academy approves it.
const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.createElement('meta');
robots.name = 'robots';
robots.content = home && !legal && !oauthConsent ? 'index,follow' : 'noindex,nofollow';
if (!robots.parentNode) document.head.appendChild(robots);

if (home && !legal && !oauthConsent) {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = new URL('/', window.location.origin).toString();
  if (!canonical.parentNode) document.head.appendChild(canonical);
} else {
  // The same HTML template serves the member portal and legal pages.
  // Remove public-home search identity tags from restricted/non-home routes.
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.remove();
  document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]').forEach(link => link.remove());
  // Organization/WebSite data describes the public academy, not a private account view.
  document.getElementById('academy-organization-schema')?.remove();
}
if (legal) {
  document.title = legalPath === '/privacy' ? 'سياسة الخصوصية | أكاديمية شوتر' : 'الشروط والأحكام | أكاديمية شوتر';
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute(
    'content',
    legalPath === '/privacy'
      ? 'سياسة الخصوصية وحماية البيانات في أكاديمية شوتر لكرة القدم.'
      : 'الشروط والأحكام والتسجيل والاشتراكات في أكاديمية شوتر لكرة القدم.'
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p role="status" className="p-8 text-center">جارٍ التحميل…</p>}>
      {legal ? <LegalPage page={legalPath === '/privacy' ? 'privacy' : 'terms'}/> : oauthConsent ? <OAuthConsent /> : home ? <AcademyHome /> : <App />}
    </Suspense>
  </StrictMode>
);

