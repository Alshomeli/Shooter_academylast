import { Component, type ReactNode } from 'react';
import type { Lang } from '../types';

type Props = { children: ReactNode; lang: Lang };
type State = { hasError: boolean };

// This boundary must be eagerly loaded: a boundary inside a lazy chunk cannot
// catch a failure to download that same chunk.
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const isAr = this.props.lang === 'ar';
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-slate-950 text-white" dir={isAr ? 'rtl' : 'ltr'} lang={this.props.lang}>
        <h1 className="text-xl font-bold" role="alert">
          {isAr ? 'تعذر عرض الصفحة' : 'Unable to display this page'}
        </h1>
        <p>{isAr ? 'تحقق من اتصالك بالإنترنت ثم أعد تحميل الصفحة.' : 'Check your internet connection, then reload the page.'}</p>
        <button type="button" className="rounded-lg bg-brand-600 px-5 py-3 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" onClick={() => window.location.reload()}>
          {isAr ? 'إعادة تحميل الصفحة' : 'Reload page'}
        </button>
      </main>
    );
  }
}
