import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { OAuthConsent } from './views/OAuthConsent.tsx';
import './index.css';

const oauthConsent = window.location.pathname === '/oauth/consent';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {oauthConsent ? <OAuthConsent /> : <App />}
  </StrictMode>
);
