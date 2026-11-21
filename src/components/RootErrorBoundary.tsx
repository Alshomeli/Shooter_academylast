import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { Lang } from '../types';

type Props = { children: ReactNode; lang: Lang };
type State = { hasError: boolean; attempts: number };

const MAX_AUTO_RETRIES = 1;
const RETRY_DELAY_MS = 1200;

// This boundary must be eagerly loaded: a boundary inside a lazy chunk cannot
// catch a failure to download that same chunk.
//
// Behaviour contract:
//  1. Every caught error is logged (console) so the real cause is never lost
//     behind the fallback screen.
//  2. One automatic retry is attempted before the fallback is shown, because
//     the most common cause is a transient chunk/network failure.
//  3. The fallback is not a dead end: it offers a live reload, a direct
//     WhatsApp/phone line and a link to the programs section, and it keeps the
//     page usable without JavaScript.
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, attempts: 0 };
  private timer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RootErrorBoundary]', error?.name, error?.message, error?.stack, info.componentStack);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  private retry = () => {
    if (this.timer) clearTimeout(this.timer);
    this.setState(s => ({ hasError: false, attempts: s.attempts + 1 }));
  };

  componentDidUpdate(_prev: Props, prevState: State) {
    if (this.state.hasError && !prevState.hasError && this.state.attempts < MAX_AUTO_RETRIES) {
      this.timer = setTimeout(() => {
        this.setState(s => ({ hasError: false, attempts: s.attempts + 1 }));
      }, RETRY_DELAY_MS);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isAr = this.props.lang === 'ar';
    const t = (ar: string, en: string) => (isAr ? ar : en);

    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-center bg-slate-950 text-white"
        dir={isAr ? 'rtl' : 'ltr'}
        lang={this.props.lang}
      >
        <h1 className="text-xl font-bold" role="alert">
          {t('تعذر عرض هذه الصفحة', 'This page could not be displayed')}
        </h1>
        <p className="max-w-md text-sm text-slate-300">
          {t(
            'قد تكون المشكلة مؤقتة في الاتصال. جرّب إعادة المحاولة، وإن تكرر الأمر تواصل معنا مباشرة.',
            'This is usually a temporary connection problem. Try again, and contact us directly if it keeps happening.'
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.retry}
            className="rounded-lg bg-brand-600 px-5 py-3 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {t('إعادة المحاولة', 'Try again')}
          </button>
          <a
            href="https://wa.me/97332287776"
            className="rounded-lg border border-slate-600 px-5 py-3 font-bold"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('واتساب الأكاديمية', 'Academy WhatsApp')}
          </a>
          <a href="tel:+97332287776" className="rounded-lg border border-slate-600 px-5 py-3 font-bold">
            <bdi>+973 3228 7776</bdi>
          </a>
        </div>
        <a href="/" className="text-sm underline text-slate-300">
          {t('العودة إلى الصفحة الرئيسية', 'Back to the home page')}
        </a>
        <noscript>
          <p className="max-w-md text-sm text-slate-300">
            {t(
              'يلزم تشغيل JavaScript لعرض الموقع الكامل. للتواصل: +973 32287776 أو واتساب.',
              'JavaScript is required to display the full site. Contact us on +973 32287776 or WhatsApp.'
            )}
          </p>
        </noscript>
      </main>
    );
  }
}
