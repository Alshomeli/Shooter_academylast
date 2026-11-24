import { useEffect, useState } from 'react';
import type { Lang } from '@/types';

type TourStep = { ar: string; en: string; section?: string };
const steps: TourStep[] = [
  { ar: 'أهلًا بك في منصة شوتر! بنعرّفك بسرعة على أهم الخدمات.', en: 'Welcome to Shooter! Here is a quick guide to the essentials.' },
  { ar: 'من قسم أبنائي تقدر تشوف بيانات أبنائك وتتابع طلب التسجيل.', en: 'Open My children to view your children and follow registration.', section: 'children' },
  { ar: 'في الاشتراكات تشوف الرسوم النهائية وأي خصم تعتمده الإدارة.', en: 'Subscriptions shows your final fee and any approved discount.', section: 'subscriptions' },
  { ar: 'إذا صار الدفع متاح، اضغط دفع الاشتراك واتبع التعليمات وارفع الإيصال.', en: 'When payment is available, choose Pay subscription and upload your receipt.', section: 'subscriptions' },
  { ar: 'من نفس القسم تتابع مراجعة الإيصال وحالة تفعيل الاشتراك.', en: 'Track receipt review and subscription activation in the same section.', section: 'subscriptions' },
  { ar: 'بعد التفعيل تقدر تتابع التدريبات والحضور والتقييمات من القوائم.', en: 'After activation, use the menus to follow training, attendance and evaluations.', section: 'trainings' },
  { ar: 'خلصنا! تقدر تعيد الجولة في أي وقت من زر المساعدة.', en: 'All done! You can restart this tour anytime using Help.', section: 'overview' },
];
export function ParentOnboardingTour({ userId, lang, navigate }: { userId: string; lang: Lang; navigate: (section: string) => void }) {
  const key = 'shooter-parent-tour-v1-' + userId;
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    try { if (!localStorage.getItem(key)) setIndex(0); } catch { /* private browsing */ }
  }, [key]);
  const close = () => { try { localStorage.setItem(key, 'done'); } catch { /* private browsing */ } setIndex(null); navigate('overview'); };
  const next = () => {
    if (index === null) return;
    if (index === steps.length - 1) { close(); return; }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (steps[nextIndex].section) navigate(steps[nextIndex].section!);
  };
  const ar = lang === 'ar';
  return <>
    <button type="button" onClick={() => { setIndex(0); navigate('overview'); }} className="fixed bottom-5 end-5 z-40 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900" aria-label={ar ? 'إعادة الجولة التعريفية' : 'Restart guided tour'}>{ar ? '❔ المساعدة' : '❔ Help'}</button>
    {index !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="parent-tour-title" dir={ar ? 'rtl' : 'ltr'} className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-300">{ar ? 'خطوة' : 'Step'} {index + 1} / {steps.length}</p>
        <h2 id="parent-tour-title" className="mb-4 text-xl font-bold">{ar ? 'دليلك في شوتر' : 'Your Shooter guide'}</h2>
        <p className="mb-6 text-base leading-8">{ar ? steps[index].ar : steps[index].en}</p>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="rounded-lg px-4 py-2 text-sm underline">{ar ? 'تخطي' : 'Skip'}</button>
          <button type="button" onClick={next} autoFocus className="rounded-lg bg-red-700 px-5 py-2 font-semibold text-white">{index === steps.length - 1 ? (ar ? 'إنهاء' : 'Finish') : (ar ? 'التالي' : 'Next')}</button>
        </div>
      </section>
    </div>}
  </>;
}
