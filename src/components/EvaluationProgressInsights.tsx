import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Ruler, Weight } from 'lucide-react';
import type { PlayerEvaluation, Lang } from '@/types';

interface Props { evaluations: PlayerEvaluation[]; lang: Lang; compact?: boolean }
type Metric = { titleAr: string; titleEn: string; unit: string; current: number | null; previous: number | null; neutral?: boolean };
const valid = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
export function EvaluationProgressInsights({ evaluations, lang, compact = false }: Props) {
  const ar = lang === 'ar';
  const groups = useMemo(() => {
    const byType = new Map<string, PlayerEvaluation[]>();
    evaluations.filter(e => e.status === 'published').forEach(e => {
      const type = e.evaluationType || 'outfield';
      byType.set(type, [...(byType.get(type) || []), e]);
    });
    return [...byType.entries()].map(([type, rows]) => ({
      type, rows: rows.sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate)),
    }));
  }, [evaluations]);
  if (!groups.length) return null;
  return <section className="space-y-3" aria-label={ar ? 'مؤشرات تطور اللاعب' : 'Player progress indicators'}>
    {groups.map(({ type, rows }) => {
      const current = rows[0], previous = rows[1];
      const metrics: Metric[] = [
        { titleAr: 'التقييم العام', titleEn: 'Overall rating', unit: '', current: valid(current.overallScore), previous: valid(previous?.overallScore) },
        { titleAr: 'الوزن', titleEn: 'Weight', unit: ar ? 'كغ' : 'kg', current: valid(current.weightKg), previous: valid(previous?.weightKg), neutral: true },
        { titleAr: 'الطول', titleEn: 'Height', unit: ar ? 'سم' : 'cm', current: valid(current.heightCm), previous: valid(previous?.heightCm), neutral: true },
      ];
      const attention = rows.length > 1 && current.overallScore != null && previous.overallScore != null && current.overallScore < previous.overallScore - 0.05;
      const weightChanged = rows.length > 1 && valid(current.weightKg) !== null && valid(previous.weightKg) !== null && Math.abs(Number(current.weightKg) - Number(previous.weightKg)) >= 0.1;
      const scoreChange = current.overallScore != null && previous?.overallScore != null ? current.overallScore - previous.overallScore : null;
      const summary = scoreChange == null
        ? (ar ? 'لا توجد بيانات كافية لمقارنة الأداء حتى الآن.' : 'Not enough data yet to compare performance.')
        : scoreChange > 0.05
          ? (ar ? 'ارتفع تقييم اللاعب مقارنة بالتقييم السابق. يُنصح بالاستمرار في متابعة التطور.' : 'The player’s score improved since the previous review. Continue monitoring progress.')
          : scoreChange < -0.05
            ? (ar ? 'انخفض تقييم اللاعب مقارنة بالتقييم السابق. يُنصح بمراجعة ملاحظات المدرب وخطة التطوير.' : 'The player’s score declined since the previous review. Review coach notes and the development plan.')
            : (ar ? 'التقييم العام مستقر مقارنة بالتقييم السابق.' : 'Overall performance is stable compared with the previous review.');
      return <div key={type} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div><h3 className="font-black text-slate-900 dark:text-white">{type === 'goalkeeper' ? (ar ? 'تطور تقييم الحراس' : 'Goalkeeper evaluation progress') : (ar ? 'تطور التقييم العام' : 'General evaluation progress')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ar ? 'مقارنة بآخر تقييم منشور من نفس النوع' : 'Compared with the previous published evaluation of the same type'}</p></div>
          <span className="text-xs font-bold text-slate-500">{current.evaluationDate}</span>
        </div>
        <div className={compact ? 'grid grid-cols-1 sm:grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-3 gap-4'}>
          {metrics.map((m, index) => {
            const delta = m.current !== null && m.previous !== null ? m.current - m.previous : null;
            const direction = delta === null || Math.abs(delta) < 0.01 ? 0 : delta > 0 ? 1 : -1;
            const Icon = direction > 0 ? TrendingUp : direction < 0 ? TrendingDown : Minus;
            const classes = m.neutral ? 'text-sky-700 dark:text-sky-300' : direction > 0 ? 'text-emerald-700 dark:text-emerald-300' : direction < 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500';
            return <div key={m.titleEn} className="min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">{index === 1 ? <Weight size={14}/> : index === 2 ? <Ruler size={14}/> : null}{ar ? m.titleAr : m.titleEn}</p>
              <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{m.current === null ? '—' : m.current.toFixed(1)} <span className="text-xs font-normal">{m.unit}</span></p>
              <p className={`mt-2 text-xs font-bold flex flex-wrap items-center gap-1 ${classes}`}><Icon size={15} aria-hidden="true"/>{delta === null ? (ar ? 'لا توجد مقارنة سابقة' : 'No previous comparison') : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${m.unit}`}</p>
            </div>;
          })}
        </div>
        {(attention || weightChanged) && <div role="status" className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          {attention && <span className="rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 px-3 py-2">{ar ? 'تنبيه: انخفاض في التقييم العام، يُنصح بالمراجعة' : 'Attention: overall score declined; review recommended'}</span>}
          {weightChanged && <span className="rounded-lg bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200 px-3 py-2">{ar ? 'تغيّر في الوزن منذ القياس السابق (ليس حكمًا صحيًا)' : 'Weight changed since last measurement (not a health judgement)'}</span>}
        </div>}
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3" aria-live="polite">
          <p className="text-xs font-black text-slate-900 dark:text-white">{ar ? 'تحليل تلقائي للتقييم' : 'Automated evaluation insight'}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{summary}</p>
          <p className="mt-1 text-[11px] text-slate-500">{ar ? 'ملخص مبني على درجات التقييم المنشورة، وليس تشخيصًا أو تحليلًا توليديًا.' : 'Based on published ratings; not a diagnosis or generative AI analysis.'}</p>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{ar ? (previous ? `المقارنة مع تقييم ${previous.evaluationDate}. تغير الوزن لا يعني تحسنًا أو تراجعًا صحيًا تلقائيًا.` : 'يتطلب عرض التطور وجود تقييمين منشورين من نفس النوع.') : (previous ? `Compared with ${previous.evaluationDate}. Weight changes do not automatically indicate better or worse health.` : 'Two published evaluations of the same type are needed for trends.')}</p>
      </div>;
    })}
  </section>;
}
