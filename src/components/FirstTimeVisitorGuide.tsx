import { useEffect, useState, useCallback } from 'react';
import type { Lang } from '@/types';

type Step = {
  ar: string;
  en: string;
  target?: string;
  placement?: 'top' | 'bottom' | 'start' | 'end';
};

const STEPS: Step[] = [
  {
    ar: 'مرحبًا بك في أكاديمية شوتر! سأرشدك خطوة بخطوة للبدء. اضغط "التالي" للمتابعة.',
    en: 'Welcome to Shooter Academy! I will guide you step by step. Press "Next" to continue.',
  },
  {
    ar: 'هذا زر تسجيل الدخول. اضغط عليه بعد إدخال بريدك وكلمة المرور للدخول إلى حسابك.',
    en: 'This is the sign-in button. Press it after entering your email and password to access your account.',
    target: 'ftg-login-btn',
    placement: 'top',
  },
  {
    ar: 'هنا تكتب بريدك الإلكتروني المسجل في الأكاديمية.',
    en: 'Here you type the email registered with the academy.',
    target: 'ftg-email',
    placement: 'bottom',
  },
  {
    ar: 'هنا تكتب كلمة المرور الخاصة بحسابك. يمكنك إظهارها أو إخفاؤها بالأيقونة المجاورة.',
    en: 'Here you type your account password. You can show or hide it with the adjacent icon.',
    target: 'ftg-password',
    placement: 'bottom',
  },
  {
    ar: 'إذا لم يكن لديك حساب، اضغط هنا لتسجيل ولي الأمر والأبناء كلاعبين في الأكاديمية.',
    en: 'If you do not have an account, click here to register a parent and children as academy players.',
    target: 'ftg-register-parent',
    placement: 'top',
  },
  {
    ar: 'أو اضغط هنا إذا كنت مديرًا أو موظفًا أو مدربًا لتقديم طلب انضمام للجهاز الإداري.',
    en: 'Or click here if you are a manager, staff member, or coach to apply to join the staff.',
    target: 'ftg-register-staff',
    placement: 'top',
  },
  {
    ar: 'يمكنك أيضًا الدخول بسرعة باستخدام حساب Google بدلًا من البريد وكلمة المرور.',
    en: 'You can also sign in quickly with a Google account instead of email and password.',
    target: 'ftg-google',
    placement: 'top',
  },
  {
    ar: 'أنت جاهز الآن! إذا احتجت مساعدة لاحقًا اضغط زر "المساعدة" في أسفل الشاشة. بالتوفيق!',
    en: 'You are all set! If you need help later, press the "Help" button at the bottom of the screen. Good luck!',
  },
];

const STORAGE_KEY = 'shooter-visitor-guide-v1';

function loadDone(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'done'; } catch { return true; }
}
function saveDone() {
  try { localStorage.setItem(STORAGE_KEY, 'done'); } catch { /* ignore */ }
}

export function FirstTimeVisitorGuide({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!loadDone()) {
      const t = window.setTimeout(() => setActive(true), 600);
      return () => window.clearTimeout(t);
    }
  }, []);

  const measure = useCallback((target?: string) => {
    if (!target) { setRect(null); return; }
    const el = document.getElementById(target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom });
  }, []);

  useEffect(() => {
    if (!active) return;
    measure(STEPS[index]?.target);
  }, [active, index, measure]);

  useEffect(() => {
    if (!active || !STEPS[index]?.target) return;
    const handler = () => measure(STEPS[index].target);
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [active, index, measure]);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => { setIndex(0); setActive(true); }}
        className="fixed bottom-5 end-5 z-40 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        aria-label={ar ? 'إعادة جولة التعريف' : 'Restart guided tour'}
      >
        {ar ? '❔ المساعدة' : '❔ Help'}
      </button>
    );
  }

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const dir = ar ? 'rtl' : 'ltr';

  const close = () => { saveDone(); setActive(false); };
  const next = () => {
    if (isLast) { close(); return; }
    setIndex(i => Math.min(i + 1, STEPS.length - 1));
  };
  const prev = () => setIndex(i => Math.max(i - 1, 0));

  // Position the tooltip near the target element
  const tooltipStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: step.placement === 'top' ? Math.max(12, rect.top - 180) : rect.bottom + 16,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)),
        width: 320,
        zIndex: 60,
      }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 380, maxWidth: 'calc(100vw - 32px)', zIndex: 60 };

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      {rect ? (
        <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <mask id="ftg-spotlight">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={rect.left - 6}
                  y={rect.top - 6}
                  width={rect.width + 12}
                  height={rect.height + 12}
                  rx="10"
                  fill="black"
                />
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#ftg-spotlight)" />
          </svg>
          {/* Highlight ring around target */}
          <div
            className="absolute rounded-lg ring-2 ring-brand-400 pointer-events-none animate-pulse"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: '0 0 0 4px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      ) : (
        <div className="fixed inset-0 z-50 bg-black/70" />
      )}

      {/* Tooltip / dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ar ? 'جولة تعريفية' : 'Guided tour'}
        dir={dir}
        className={`rounded-2xl shadow-2xl border p-5 animate-fadeIn ${rect ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-brand-600">
            {ar ? `الخطوة ${index + 1} من ${STEPS.length}` : `Step ${index + 1} of ${STEPS.length}`}
          </span>
          <button type="button" onClick={close} className="text-slate-400 hover:text-slate-600 text-lg leading-none" aria-label={ar ? 'تخطّي' : 'Skip'}>
            ×
          </button>
        </div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed mb-4">
          {ar ? step.ar : step.en}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={close} className="text-xs font-bold text-slate-500 hover:text-slate-700">
            {ar ? 'تخطّي الجولة' : 'Skip tour'}
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={prev} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">
                {ar ? 'السابق' : 'Prev'}
              </button>
            )}
            <button type="button" onClick={next} className="rounded-lg bg-brand-600 hover:bg-brand-700 px-4 py-1.5 text-xs font-bold text-white">
              {isLast ? (ar ? 'إنهاء' : 'Finish') : (ar ? 'التالي' : 'Next')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
