import type { Player, Staff, PlayerEvaluation, Lang } from '@/types';
import { tr } from '@/lib/i18n';
import { evaluationCriteria } from '@/lib/evaluation-template';
import { Badge } from '@/components/ui';

function ScoreBar({ label, value, max = 5 }: { label: string; value: number | null; max?: number }) {
  const pct = value ? (value / max) * 100 : 0;
  const color = !value ? 'bg-slate-300 dark:bg-slate-700'
    : value >= 4 ? 'bg-brand-500' : value >= 3 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-28 shrink-0 text-start">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-black text-slate-700 dark:text-slate-200 w-6 text-center">{value == null ? '-' : Number(value.toFixed(2))}</span>
    </div>
  );
}

export function EvaluationCard({ ev, player, coach, lang, onEdit }: {
  ev: PlayerEvaluation; player?: Player; coach?: Staff; lang: Lang; onEdit?: () => void;
}) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const periodLabel = ev.periodType === 'monthly' ? t.monthly : ev.periodType === 'quarterly' ? t.quarterly : t.customPeriod;
  return (
    <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-black text-slate-900 dark:text-white">{player?.name || ev.playerId}</h4>
          <p className="text-xs font-bold text-brand-600">{ev.evaluationType === 'goalkeeper' ? (isAr ? 'تقييم مدرب الحراس — حارس المرمى' : 'Goalkeeper coach — Goalkeeper evaluation') : (isAr ? 'تقييم مدرب اللاعبين — اللاعب' : 'Team coach — Player evaluation')}</p>
          {ev.teamName && <p className="text-xs text-slate-500">{isAr ? 'الفئة' : 'Category'}: {ev.teamName}</p>}
          <p className="text-[11px] text-slate-400 mt-0.5">{ev.evaluationDate} &middot; {periodLabel}</p>
          {coach && <p className="text-[11px] text-slate-400">{isAr ? 'المدرب' : 'Coach'}: {coach.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          {ev.overallScore != null && (
            <span className="text-lg font-black text-brand-600">{ev.overallScore.toFixed(1)}<span className="text-xs text-slate-400">/5</span></span>
          )}
          <Badge color={ev.status === 'published' ? 'emerald' : 'amber'}>{ev.status === 'published' ? t.publishedStatus : t.draft}</Badge>
        </div>
      </div>
      <div className="space-y-1.5">
        <ScoreBar label={t.technicalScore} value={ev.technicalScore} />
        <ScoreBar label={t.tacticalScore} value={ev.tacticalScore} />
        <ScoreBar label={t.physicalScore} value={ev.physicalScore} />
        <ScoreBar label={t.mentalScore} value={ev.mentalScore} />
        <ScoreBar label={t.disciplineScore} value={ev.disciplineScore} />
      </div>
      {(ev.strengths || ev.developmentAreas) && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          {ev.strengths && (
            <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400">
              <span className="font-bold">{t.strengths}:</span> {ev.strengths}
            </div>
          )}
          {ev.developmentAreas && (
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
              <span className="font-bold">{t.developmentAreas}:</span> {ev.developmentAreas}
            </div>
          )}
        </div>
      )}
      {ev.evaluationType === 'goalkeeper' && ev.totalScore != null && <p className="mt-3 font-black text-brand-600">{isAr ? 'المجموع النهائي' : 'Final total'}: {ev.totalScore}/50</p>}
      {(ev.heightCm || ev.weightKg) && <p className="mt-2 text-xs text-slate-500">{isAr ? 'الطول' : 'Height'}: {ev.heightCm || '—'} cm · {isAr ? 'الوزن' : 'Weight'}: {ev.weightKg || '—'} kg</p>}
      {ev.generalRating && <p className="mt-2 text-sm font-bold">{isAr ? 'التقدير العام' : 'General rating'}: {({ excellent: isAr ? 'ممتاز' : 'Excellent', very_good: isAr ? 'جيد جدًا' : 'Very good', good: isAr ? 'جيد' : 'Good', needs_development: isAr ? 'يحتاج إلى تطوير' : 'Needs development' } as Record<string,string>)[ev.generalRating]}</p>}
      {ev.evaluatorName && <p className="mt-2 text-xs">{isAr ? 'المقيّم' : 'Evaluator'}: {ev.evaluatorName}</p>}
      {(ev.evaluatorSignature || ev.coachSignature) && <p className="mt-2 text-xs">{isAr ? 'توقيع المقيّم / المدرب' : 'Evaluator / coach signature'}: {ev.evaluatorSignature || '—'} / {ev.coachSignature || '—'}</p>}
      {ev.nutritionPlan && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{isAr ? 'نظام التغذية' : 'Nutrition plan'}: {ev.nutritionPlan}</p>}
      {Object.keys(ev.detailedScores || {}).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-black text-slate-600 dark:text-slate-300 mb-2">{isAr ? 'التقييم التفصيلي' : 'Detailed assessment'}</p>
          <div className="flex flex-wrap gap-1.5">
            {evaluationCriteria(ev.evaluationType || 'outfield').filter(item => ev.detailedScores[item.key] != null).map(item => (
              <span key={item.key} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {isAr ? item.ar : item.en}: {ev.detailedScores[item.key]}/5
              </span>
            ))}
          </div>
        </div>
      )}
      {ev.developmentPriorities?.length > 0 && (
        <div className="mt-2 text-[11px] text-violet-700 dark:text-violet-400">
          <span className="font-bold">{isAr ? 'أولويات التطوير' : 'Development priorities'}:</span> {ev.developmentPriorities.join('، ')}
        </div>
      )}
      {(ev.trainingAction || ev.finalRecommendation || ev.coachNotes || ev.reassessmentDate) && <dl className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300">{[[isAr ? 'ملاحظات المدرب' : 'Coach notes', ev.coachNotes], [isAr ? 'إجراء تدريبي مقترح' : 'Training action', ev.trainingAction], [isAr ? 'موعد إعادة التقييم' : 'Reassessment', ev.reassessmentDate], [isAr ? 'التوصية النهائية' : 'Final recommendation', ev.finalRecommendation]].filter(([,value]) => value).map(([label,value]) => <div key={label}><dt className="font-bold">{label}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}</dl>}
      {ev.coachRecommendation && (
        <div className="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-[11px] text-blue-700 dark:text-blue-400">
          <span className="font-bold">{t.coachRecommendation}:</span> {ev.coachRecommendation}
        </div>
      )}
      {onEdit && ev.status === 'draft' && (
        <button onClick={onEdit} className="mt-3 text-xs font-bold text-brand-600 hover:text-brand-500 transition cursor-pointer">
          {t.editEvaluation} &rarr;
        </button>
      )}
    </div>
  );
}

