import { Home } from 'lucide-react';

export function PublicHomeLink({ lang, darkMode = false }: { lang: string; darkMode?: boolean }) {
  return <a href="/" title={lang === 'ar' ? 'العودة إلى موقع الأكاديمية' : 'Return to the academy website'} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ${darkMode ? 'border-slate-600 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100'}`}>
    <Home className="h-4 w-4 shrink-0" aria-hidden="true"/>
    <span>{lang === 'ar' ? 'الصفحة الرئيسية' : 'Academy home'}</span>
  </a>;
}
