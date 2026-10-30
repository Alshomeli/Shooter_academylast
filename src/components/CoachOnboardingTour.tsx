import { useEffect, useState } from 'react';
import type { Lang, ViewId } from '@/types';

const steps: { ar: string; en: string; tab: ViewId }[] = [
  { ar: 'أهلًا بك في لوحة المدرب في شوتر. بنعرّفك على أهم أدواتك.', en: 'Welcome to your Shooter coach dashboard. Here are your key tools.', tab: 'dashboard' },
  { ar: 'من اللاعبين تتابع اللاعبين المسموح لك بالاطلاع عليهم.', en: 'Players shows the athletes available to your role.', tab: 'players' },
  { ar: 'من الجداول تراجع مواعيد الحصص والتدريبات.', en: 'Schedules helps you review your training sessions.', tab: 'schedules' },
  { ar: 'من الحضور تسجل حضور وغياب اللاعبين ضمن صلاحياتك.', en: 'Attendance lets you record attendance for permitted players.', tab: 'attendance' },
  { ar: 'من التقييمات تسجل وتراجع تطور مستوى اللاعبين.', en: 'Evaluations lets you assess and review player progress.', tab: 'evaluations' },
  { ar: 'مركز الذكاء الاصطناعي يساعدك في تحليل الأداء واقتراح أفكار للتدريب.', en: 'The AI center helps analyze performance and suggest training ideas.', tab: 'ai-center' },
  { ar: 'خلصنا! اضغط المساعدة في أي وقت لإعادة الجولة.', en: 'You are all set! Select Help anytime to replay this guide.', tab: 'dashboard' },
];
export function CoachOnboardingTour({ userId, lang, navigate }: { userId: string; lang: Lang; navigate: (tab: ViewId) => void }) {
  const key = 'shooter-coach-tour-v1-' + userId;
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => { try { if (!localStorage.getItem(key)) setIndex(0); } catch { /* storage unavailable */ } }, [key]);
  const close = () => { try { localStorage.setItem(key, 'done'); } catch { /* storage unavailable */ } setIndex(null); navigate('dashboard'); };
  const next = () => { if (index === null) return; if (index === steps.length - 1) { close(); return; } const n = index + 1; setIndex(n); navigate(steps[n].tab); };
  const ar = lang === 'ar';
  return <>
    <button type="button" className="fixed bottom-5 end-5 z-40 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900" onClick={() => { setIndex(0); navigate('dashboard'); }}>{ar ? '❔ المساعدة' : '❔ Help'}</button>
    {index !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="coach-tour-title" dir={ar ? 'rtl' : 'ltr'} className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
        <p className="mb-2 text-sm text-slate-500">{ar ? 'خطوة' : 'Step'} {index + 1} / {steps.length}</p>
        <h2 id="coach-tour-title" className="mb-4 text-xl font-bold">{ar ? 'دليل المدرب' : 'Coach guide'}</h2>
        <p className="mb-6 text-base leading-8">{ar ? steps[index].ar : steps[index].en}</p>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="rounded-lg px-4 py-2 text-sm underline">{ar ? 'تخطي' : 'Skip'}</button>
          <button type="button" autoFocus onClick={next} className="rounded-lg bg-red-700 px-5 py-2 font-semibold text-white">{index === steps.length - 1 ? (ar ? 'إنهاء' : 'Finish') : (ar ? 'التالي' : 'Next')}</button>
        </div>
      </section>
    </div>}
  </>;
}
