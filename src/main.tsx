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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p role="status" className="p-8 text-center">جارٍ التحميل…</p>}>
      {legal ? <LegalPage page={legalPath === '/privacy' ? 'privacy' : 'terms'}/> : oauthConsent ? <OAuthConsent /> : home ? <AcademyHome /> : <App />}
    </Suspense>
  </StrictMode>
);

