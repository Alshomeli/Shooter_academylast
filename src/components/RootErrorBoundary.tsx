import { Component, type ReactNode } from 'react';
import type { Lang } from '../types';

type Props = { children: ReactNode; lang: Lang };
type State = { hasError: boolean; retrying: boolean };

const RELOAD_GUARD_KEY = 'shooter_root_reload_at';
const RELOAD_GUARD_WINDOW_MS = 60_000;

// A failed dynamic import ("Failed to fetch dynamically imported module",
// "Loading chunk N failed", importScripts errors) is recoverable: the deploy
// published new hashed assets and the document in the tab still points at the
// previous build. Reloading once re-resolves the chunk graph instead of
// stranding the visitor on a dead-end screen.
function isRecoverableLoadError(error: unknown): boolean {
  const message = `${(error as Error)?.name || ''} ${(error as Error)?.message || ''}`.toLowerCase();
  return (
    message.includes('dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('loading css chunk') ||
    message.includes('importing a module script failed') ||
    message.includes('unexpected token') // an HTML error page served where a module was expected
  );
}

function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
    if (Date.now() - last < RELOAD_GUARD_WINDOW_MS) return false; // already retried
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    return false; // no storage: never risk a reload loop
  }
  window.location.reload();
  return true;
}

// This boundary must be eagerly loaded: a boundary inside a lazy chunk cannot
// catch a failure to download that same chunk.
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retrying: false };

  static getDerivedStateFromError(): State {
    return { hasError: true, retrying: false };
  }

  componentDidCatch(error: unknown) {
    if (isRecoverableLoadError(error) && reloadOnce()) {
      this.setState({ hasError: true, retrying: true });
    }
  }

  private retry = () => {
    this.setState({ retrying: true });
    try {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
      /* storage unavailable */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const isAr = this.props.lang === 'ar';
    // The visitor must still be able to reach the academy: no dead end.
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-5 p-8 text-center bg-slate-950 text-white"
        dir={isAr ? 'rtl' : 'ltr'}
        lang={this.props.lang}
      >
        <h1 className="text-2xl font-bold" role="alert">
          {isAr ? 'تعذّر عرض هذه الصفحة' : 'This page could not be displayed'}
        </h1>
        <p className="max-w-xl text-slate-300">
          {isAr
            ? 'موقع الأكاديمية لم يُحمّل بالكامل على هذا الجهاز. جرّب إعادة التحميل، أو تواصل معنا مباشرة — نحن هنا.'
            : 'The academy site did not finish loading on this device. Try reloading, or reach us directly — we are here.'}
        </p>
        <button
          type="button"
          onClick={this.retry}
          disabled={this.state.retrying}
          className="rounded-lg bg-red-600 px-6 py-3 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-60"
        >
          {this.state.retrying
            ? (isAr ? 'جارٍ إعادة التحميل…' : 'Reloading…')
            : (isAr ? 'إعادة تحميل الصفحة' : 'Reload the page')}
        </button>
        <section className="mt-2 w-full max-w-md rounded-xl border border-slate-700 p-4 text-start">
          <h2 className="mb-3 text-sm font-bold text-slate-200">
            {isAr ? 'تواصل مع الأكاديمية' : 'Contact the academy'}
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a className="underline text-slate-100" href="tel:+97332287776">
                {isAr ? 'اتصال: ' : 'Call: '}
                <bdi>+973 3228 7776</bdi>
              </a>
            </li>
            <li>
              <a
                className="underline text-slate-100"
                href="https://wa.me/97332287776"
                target="_blank"
                rel="noopener noreferrer"
              >
                {isAr ? 'واتساب الأكاديمية' : 'Academy WhatsApp'}
              </a>
            </li>
            <li>
              <a className="underline text-slate-100" href="mailto:shooter.academy.bh@gmail.com">
                shooter.academy.bh@gmail.com
              </a>
            </li>
            <li>
              <a className="underline text-slate-100" href="https://www.instagram.com/shooter.academy.bh/" target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            </li>
          </ul>
        </section>
        <p className="text-xs text-slate-500">
          {isAr
            ? 'شارع 28، حالة النعيم، المحرق — مملكة البحرين'
            : 'Road 28, Halat Naim, Muharraq — Kingdom of Bahrain'}
        </p>
      </main>
    );
  }
}
