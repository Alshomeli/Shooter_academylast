import { useEffect, useState } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { askManagementAI, type ManagementAIPersona } from '@/lib/ai-assistant';
import type { Lang, Role, ViewId } from '@/types';

const CONTEXTS: Partial<Record<ViewId, { persona: ManagementAIPersona; ar: string[]; en: string[] }>> = {
  dashboard: { persona: 'players', ar: ['لخّص مستوى اللاعبين وتطور التقييمات', 'ما المؤشرات التي تحتاج متابعة؟'], en: ['Summarize player evaluation trends', 'Which player metrics need attention?'] },
  players: { persona: 'players', ar: ['حلّل تطور تقييمات اللاعبين', 'ما التقييمات التي تحتاج متابعة؟'], en: ['Analyze player development trends', 'Which evaluations need follow-up?'] },
  teams: { persona: 'players', ar: ['حلّل توزيع اللاعبين على الفرق'], en: ['Analyze team distribution'] },
  attendance: { persona: 'training', ar: ['حلّل الحضور والغياب في التدريبات', 'اقترح أساليب لتحسين انتظام الحضور'], en: ['Analyze training attendance and absences', 'Suggest ways to improve attendance'] },
  schedules: { persona: 'training', ar: ['اقترح أسماء وأنواع الحصص التدريبية وأهدافها', 'لخّص التدريبات ومواعيدها'], en: ['Suggest training names, types, and objectives', 'Summarize training sessions'] },
  evaluations: { persona: 'scout', ar: ['لخّص اتجاهات التقييمات المنشورة', 'اقترح أولويات تطوير فردية دون ترتيب اللاعبين'], en: ['Summarize published evaluation trends', 'Suggest individual development priorities without ranking players'] },
  tournaments: { persona: 'matches', ar: ['لخّص نتائج المباريات والاستعدادات'], en: ['Summarize matches and preparations'] },
  reports: { persona: 'players', ar: ['أنشئ ملخصًا لتطور أداء اللاعبين'], en: ['Summarize player development'] },
  subscriptions: { persona: 'financial', ar: ['لخّص حالة الاشتراكات المالية'], en: ['Summarize subscription finances'] },
};
const COACH_PAGES = new Set<ViewId>(['dashboard', 'players', 'teams', 'attendance', 'schedules', 'evaluations', 'tournaments', 'reports']);
export function ContextualShooterAI({ page, role, lang }: { page: ViewId; role: Role; lang: Lang }) {
  const config = CONTEXTS[page];
  const allowed = Boolean(config) && (role === 'manager' || (role === 'coach' && COACH_PAGES.has(page)));
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOpen(false); setQuestion(''); setReply(''); setError(''); }, [page, role]);
  if (!allowed || !config) return null;
  const ar = lang === 'ar';
  const ask = async (prompt: string) => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setReply(''); setError('');
    try {
      const result = await askManagementAI(config.persona, prompt.trim(), ar ? 'ar' : 'en');
      setReply(result.reply);
    } catch {
      setError(ar ? 'تعذر تحليل البيانات. حاول مجددًا.' : 'Could not analyze the data. Try again.');
    } finally { setBusy(false); }
  };
  return <section className="mb-4 rounded-xl border border-brand-500/30 bg-white dark:bg-slate-900 p-3 sm:p-4" aria-label={ar ? 'مساعد شوتر الذكي' : 'Shooter AI Assistant'}>
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="flex items-center gap-2 text-sm font-bold text-brand-600 dark:text-brand-400">
        <Sparkles className="h-4 w-4" />{ar ? 'مساعد شوتر الذكي' : 'Shooter AI Assistant'}
      </button>
      {open && <button type="button" onClick={() => setOpen(false)} aria-label={ar ? 'إغلاق' : 'Close'}><X className="h-4 w-4" /></button>}
    </div>
    {open && <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{ar ? 'اقتراحات تحليلية من بياناتك المصرح بها؛ لا تُجرى أي تعديلات تلقائية.' : 'Read-only analysis of authorized data. No automatic changes.'}</p>
      <div className="flex flex-wrap gap-2">{(ar ? config.ar : config.en).map(prompt => <button key={prompt} type="button" disabled={busy} onClick={() => { setQuestion(prompt); void ask(prompt); }} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50">{prompt}</button>)}</div>
      <form onSubmit={e => { e.preventDefault(); void ask(question); }} className="flex gap-2">
        <input aria-label={ar ? 'سؤال للمساعد' : 'Ask the assistant'} value={question} maxLength={1200} onChange={e => setQuestion(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" placeholder={ar ? 'اسأل عن هذا القسم...' : 'Ask about this section...'} />
        <button type="submit" disabled={busy || !question.trim()} className="rounded-lg bg-brand-600 px-3 py-2 text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {reply && <div aria-live="polite" className="whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100">{reply}</div>}
    </div>}
  </section>;
}
