import { useState, useMemo, type FormEvent } from 'react';
import { Plus, Search, Save, Send, X, Star, ChevronLeft, TrendingUp, History, CalendarClock } from 'lucide-react';
import { averageEvaluationScores as average, evaluationFrameworkScores as frameworkScores } from '@/lib/evaluation-scores';
import type { Player, Team, Staff, PlayerEvaluation, Role, Lang } from '@/types';
import { tr } from '@/lib/i18n';
import { db } from '@/lib/store';
import { PageHeader, Badge, EmptyState, FormField, inputCls } from '@/components/ui';

interface Props {
  evaluations: PlayerEvaluation[];
  players: Player[];
  teams: Team[];
  staff: Staff[];
  activeRole: Role;
  lang: Lang;
  onRefresh: () => Promise<void>;
}

const PERIOD_OPTS = ['monthly', 'quarterly', 'custom'] as const;

const DETAIL_CRITERIA = [
  { group: 'technical', key: 'ball_control', ar: 'التحكم بالكرة', en: 'Ball control' },
  { group: 'technical', key: 'passing', ar: 'التمرير', en: 'Passing' },
  { group: 'technical', key: 'dribbling', ar: 'المراوغة', en: 'Dribbling' },
  { group: 'technical', key: 'shooting', ar: 'التسديد', en: 'Shooting' },
  { group: 'tactical', key: 'decision_making', ar: 'اتخاذ القرار', en: 'Decision making' },
  { group: 'tactical', key: 'positioning', ar: 'التمركز', en: 'Positioning' },
  { group: 'tactical', key: 'teamwork', ar: 'العمل الجماعي', en: 'Teamwork' },
  { group: 'physical', key: 'fitness', ar: 'اللياقة العامة', en: 'General fitness' },
  { group: 'physical', key: 'speed_agility', ar: 'السرعة والرشاقة', en: 'Speed & agility' },
  { group: 'physical', key: 'endurance', ar: 'التحمل', en: 'Endurance' },
  { group: 'psychosocial', key: 'focus', ar: 'التركيز', en: 'Focus' },
  { group: 'psychosocial', key: 'coachability', ar: 'الاستجابة للتوجيه', en: 'Coachability' },
  { group: 'psychosocial', key: 'discipline', ar: 'الانضباط', en: 'Discipline' },
  { group: 'psychosocial', key: 'sportsmanship', ar: 'الروح الرياضية', en: 'Sportsmanship' },
] as const;

const CRITERIA_GROUPS = [
  { key: 'technical', ar: 'فني', en: 'Technical' },
  { key: 'tactical', ar: 'تكتيكي', en: 'Tactical' },
  { key: 'physical', ar: 'بدني', en: 'Physical' },
  { key: 'psychosocial', ar: 'نفسي واجتماعي', en: 'Psychosocial' },
] as const;

function formatDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null) return '—';
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return '0.0';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
}

function ScoreBar({ label, value, max = 5 }: { label: string; value: number | null; max?: number }) {
  const pct = value ? (value / max) * 100 : 0;
  const color = !value ? 'bg-slate-300 dark:bg-slate-700'
    : value >= 4 ? 'bg-emerald-500' : value >= 3 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-28 shrink-0 text-start">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-black text-slate-700 dark:text-slate-200 w-6 text-center">{value ?? '-'}</span>
    </div>
  );
}

function EvalCard({ ev, player, coach, lang, onEdit }: {
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
          <p className="text-[11px] text-slate-400 mt-0.5">{ev.evaluationDate} &middot; {periodLabel}</p>
          {coach && <p className="text-[11px] text-slate-400">{isAr ? 'المدرب' : 'Coach'}: {coach.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          {ev.overallScore != null && (
            <span className="text-lg font-black text-emerald-600">{ev.overallScore.toFixed(1)}<span className="text-xs text-slate-400">/5</span></span>
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
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
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
      {Object.keys(ev.detailedScores || {}).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-black text-slate-600 dark:text-slate-300 mb-2">{isAr ? 'التقييم التفصيلي' : 'Detailed assessment'}</p>
          <div className="flex flex-wrap gap-1.5">
            {DETAIL_CRITERIA.filter(item => ev.detailedScores[item.key] != null).map(item => (
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
      {ev.coachRecommendation && (
        <div className="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-[11px] text-blue-700 dark:text-blue-400">
          <span className="font-bold">{t.coachRecommendation}:</span> {ev.coachRecommendation}
        </div>
      )}
      {onEdit && ev.status === 'draft' && (
        <button onClick={onEdit} className="mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-500 transition cursor-pointer">
          {t.editEvaluation} &rarr;
        </button>
      )}
    </div>
  );
}

export function Evaluations({ evaluations, players, teams, staff, activeRole, lang, onRefresh }: Props) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const canEdit = activeRole === 'manager' || activeRole === 'coach';

  const [showForm, setShowForm] = useState(false);
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'draft' | 'published'>('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [progressPlayerId, setProgressPlayerId] = useState('');

  const emptyForm = {
    id: undefined as string | undefined,
    playerId: '', evaluationDate: new Date().toISOString().split('T')[0],
    periodType: 'monthly' as string,
    technicalScore: null as number | null, tacticalScore: null as number | null,
    physicalScore: null as number | null, mentalScore: null as number | null,
    disciplineScore: null as number | null,
    strengths: '', developmentAreas: '', coachNotes: '', coachRecommendation: '',
    detailedScores: {} as Record<string, number | null>,
    developmentPriorities: [] as string[],
    trainingAction: '', reassessmentDate: null as string | null, finalRecommendation: '',
  };
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return evaluations.filter(ev => {
      if (filterStatus && ev.status !== filterStatus) return false;
      if (filterPeriod && ev.periodType !== filterPeriod) return false;
      if (filterTeam) {
        const p = players.find(pl => pl.id === ev.playerId);
        if (!p || p.teamId !== filterTeam) return false;
      }
      if (searchQ) {
        const p = players.find(pl => pl.id === ev.playerId);
        if (!p || !p.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate));
  }, [evaluations, filterStatus, filterPeriod, filterTeam, searchQ, players]);

  const activePlayers = useMemo(() => players.filter(p => p.status === 'active'), [players]);

  const previousPublishedEvaluation = useMemo(() => {
    if (!form.playerId) return null;
    return evaluations
      .filter(ev => ev.playerId === form.playerId && ev.status === 'published' && ev.id !== form.id)
      .sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate))[0] || null;
  }, [evaluations, form.playerId, form.id]);

  const publishedEvaluations = useMemo(
    () => evaluations.filter(ev => ev.status === 'published').sort((a, b) => a.evaluationDate.localeCompare(b.evaluationDate)),
    [evaluations],
  );

  const latestPublishedByPlayer = useMemo(() => {
    const map = new Map<string, PlayerEvaluation>();
    publishedEvaluations.forEach(ev => map.set(ev.playerId, ev));
    return Array.from(map.values());
  }, [publishedEvaluations]);

  const playersWithHistory = useMemo(
    () => activePlayers.filter(player => publishedEvaluations.filter(ev => ev.playerId === player.id).length >= 2),
    [activePlayers, publishedEvaluations],
  );

  const progressEvaluations = useMemo(
    () => publishedEvaluations.filter(ev => ev.playerId === progressPlayerId),
    [publishedEvaluations, progressPlayerId],
  );

  const progressSummary = useMemo(() => {
    if (progressEvaluations.length < 2) return null;
    const first = frameworkScores(progressEvaluations[0]);
    const latest = frameworkScores(progressEvaluations[progressEvaluations.length - 1]);
    const overallFirst = progressEvaluations[0].overallScore;
    const overallLatest = progressEvaluations[progressEvaluations.length - 1].overallScore;
    return {
      firstDate: progressEvaluations[0].evaluationDate,
      latestDate: progressEvaluations[progressEvaluations.length - 1].evaluationDate,
      reviewCount: progressEvaluations.length,
      first,
      latest,
      overallDelta: overallFirst != null && overallLatest != null ? overallLatest - overallFirst : null,
    };
  }, [progressEvaluations]);

  const frameworkSummary = useMemo(() => {
    const scores = latestPublishedByPlayer.map(frameworkScores);
    return {
      technical: average(scores.map(s => s.technical)),
      tactical: average(scores.map(s => s.tactical)),
      physical: average(scores.map(s => s.physical)),
      psychosocial: average(scores.map(s => s.psychosocial)),
    };
  }, [latestPublishedByPlayer]);

  const today = new Date().toISOString().split('T')[0];
  const reassessmentDue = useMemo(
    () => latestPublishedByPlayer.filter(ev => ev.reassessmentDate && ev.reassessmentDate <= today).length,
    [latestPublishedByPlayer, today],
  );

  const openNew = () => { setForm(emptyForm); setShowForm(true); setError(''); };
  const openEdit = (ev: PlayerEvaluation) => {
    setForm({
      id: ev.id, playerId: ev.playerId, evaluationDate: ev.evaluationDate,
      periodType: ev.periodType,
      technicalScore: ev.technicalScore, tacticalScore: ev.tacticalScore,
      physicalScore: ev.physicalScore, mentalScore: ev.mentalScore,
      disciplineScore: ev.disciplineScore,
      strengths: ev.strengths, developmentAreas: ev.developmentAreas,
      coachNotes: ev.coachNotes, coachRecommendation: ev.coachRecommendation,
      detailedScores: ev.detailedScores || {}, developmentPriorities: ev.developmentPriorities || [],
      trainingAction: ev.trainingAction || '', reassessmentDate: ev.reassessmentDate || null,
      finalRecommendation: ev.finalRecommendation || '',
    });
    setShowForm(true); setError('');
  };

  const handleSave = async (publish: boolean) => {
    if (!form.playerId) { setError(isAr ? 'يرجى اختيار اللاعب' : 'Please select a player'); return; }
    if (publish) {
      const scores = [form.technicalScore, form.tacticalScore, form.physicalScore, form.mentalScore, form.disciplineScore];
      if (scores.some(s => s === null || s < 1 || s > 5)) {
        setError(isAr ? 'يجب تعبئة جميع الدرجات (1-5) قبل النشر' : 'All scores (1-5) required before publishing');
        return;
      }
    }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        developmentPriorities: form.developmentPriorities.map(p => p.trim()).filter(Boolean),
      };
      const evalId = await db.savePlayerEvaluation(payload as Parameters<typeof db.savePlayerEvaluation>[0]);
      if (publish) await db.publishPlayerEvaluation(form.id || evalId);
      await onRefresh();
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isAr ? 'حدث خطأ' : 'An error occurred'));
    } finally { setSaving(false); setConfirmPublish(false); }
  };

  const setScore = (field: 'technicalScore' | 'tacticalScore' | 'physicalScore' | 'mentalScore' | 'disciplineScore', raw: string) => {
    const n = raw === '' ? null : Math.max(1, Math.min(5, parseInt(raw, 10) || 1));
    setForm(prev => ({ ...prev, [field]: n }));
  };

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); handleSave(false); };

  if (showForm) {
    const selectedPlayer = players.find(p => p.id === form.playerId);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
            {isAr ? <ChevronLeft className="h-5 w-5 rotate-180" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{form.id ? t.editEvaluation : t.addEvaluation}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
          {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-xs font-bold">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={`${t.selectPlayer} *`}>
              <select value={form.playerId} onChange={e => setForm(prev => ({ ...prev, playerId: e.target.value }))}
                className={inputCls} disabled={!!form.id} required>
                <option value="">{t.selectPlayer}</option>
                {activePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label={`${t.evaluationDate} *`}>
              <input type="date" value={form.evaluationDate} onChange={e => setForm(prev => ({ ...prev, evaluationDate: e.target.value }))}
                className={inputCls} required />
            </FormField>
            <FormField label={`${t.periodType} *`}>
              <select value={form.periodType} onChange={e => setForm(prev => ({ ...prev, periodType: e.target.value }))} className={inputCls}>
                {PERIOD_OPTS.map(p => (
                  <option key={p} value={p}>{p === 'monthly' ? t.monthly : p === 'quarterly' ? t.quarterly : t.customPeriod}</option>
                ))}
              </select>
            </FormField>
            {selectedPlayer && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black">#{selectedPlayer.jerseyNumber}</div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedPlayer.name}</p>
                  <p className="text-[11px] text-slate-400">{teams.find(tm => tm.id === selectedPlayer.teamId)?.name}</p>
                </div>
              </div>
            )}
          </div>

          {previousPublishedEvaluation && (
            <div className="p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-black text-blue-900 dark:text-blue-200">{isAr ? 'متابعة خطة التطوير السابقة' : 'Previous development plan follow-up'}</h3>
                  <p className="text-[11px] text-blue-600/80 dark:text-blue-300/70">
                    {isAr ? `آخر تقييم منشور: ${previousPublishedEvaluation.evaluationDate}` : `Latest published review: ${previousPublishedEvaluation.evaluationDate}`}
                  </p>
                </div>
                {previousPublishedEvaluation.reassessmentDate && (
                  <Badge color={previousPublishedEvaluation.reassessmentDate <= new Date().toISOString().split('T')[0] ? 'amber' : 'blue'}>
                    {isAr ? 'إعادة التقييم' : 'Reassess'}: {previousPublishedEvaluation.reassessmentDate}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70">
                  <p className="font-black text-slate-700 dark:text-slate-200 mb-1">{isAr ? 'أولويات التطوير' : 'Development priorities'}</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {previousPublishedEvaluation.developmentPriorities?.length
                      ? previousPublishedEvaluation.developmentPriorities.join('، ')
                      : (isAr ? 'لا توجد أولويات مسجلة' : 'No priorities recorded')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70">
                  <p className="font-black text-slate-700 dark:text-slate-200 mb-1">{isAr ? 'الإجراء التدريبي السابق' : 'Previous training action'}</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {previousPublishedEvaluation.trainingAction || (isAr ? 'لا يوجد إجراء مسجل' : 'No action recorded')}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-blue-600/70 dark:text-blue-300/60 mt-3">
                {isAr ? 'استخدم هذه المعلومات لمراجعة التقدم قبل تحديد أولويات جديدة، ولا تعتمد على مقارنة اللاعب بغيره.' : 'Use this context to review progress before setting new priorities; do not compare the player with peers.'}
              </p>
            </div>
          )}

          <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'الدرجات' : 'Scores'} <span className="text-slate-400 font-normal text-[11px]">({t.scoreRange})</span></h3>
            {([
              ['technicalScore', t.technicalScore],
              ['tacticalScore', t.tacticalScore],
              ['physicalScore', t.physicalScore],
              ['mentalScore', t.mentalScore],
              ['disciplineScore', t.disciplineScore],
            ] as const).map(([field, label]) => (
              <div key={field} className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 w-32 shrink-0">{label}</label>
                <input type="range" min="1" max="5" value={form[field] ?? 3}
                  onChange={e => setScore(field, e.target.value)}
                  className="flex-1 accent-emerald-600" />
                <input type="number" min="1" max="5" value={form[field] ?? ''}
                  onChange={e => setScore(field, e.target.value)}
                  className="w-14 text-center text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1"
                  placeholder="-" />
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'التقييم التفصيلي' : 'Detailed assessment'}</h3>
              <p className="text-[11px] text-slate-400 mt-1">{isAr ? 'اختر 1–5، أو اترك المعيار غير مُقيّم.' : 'Choose 1–5, or leave a criterion not rated.'}</p>
            </div>
            <div className="space-y-4">
              {CRITERIA_GROUPS.map(group => (
                <section key={group.key}>
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2">{isAr ? group.ar : group.en}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {DETAIL_CRITERIA.filter(item => item.group === group.key).map(item => (
                      <div key={item.key} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{isAr ? item.ar : item.en}</label>
                        <select
                          value={form.detailedScores[item.key] ?? ''}
                          onChange={e => setForm(prev => ({
                            ...prev,
                            detailedScores: { ...prev.detailedScores, [item.key]: e.target.value === '' ? null : Number(e.target.value) },
                          }))}
                          className={`${inputCls} w-28 py-1.5`}
                        >
                          <option value="">{isAr ? 'غير مُقيّم' : 'Not rated'}</option>
                          {[1,2,3,4,5].map(score => <option key={score} value={score}>{score}/5</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t.strengths}>
              <textarea value={form.strengths} onChange={e => setForm(prev => ({ ...prev, strengths: e.target.value }))}
                className={inputCls} rows={3} />
            </FormField>
            <FormField label={t.developmentAreas}>
              <textarea value={form.developmentAreas} onChange={e => setForm(prev => ({ ...prev, developmentAreas: e.target.value }))}
                className={inputCls} rows={3} />
            </FormField>
            <FormField label={t.coachNotes}>
              <textarea value={form.coachNotes} onChange={e => setForm(prev => ({ ...prev, coachNotes: e.target.value }))}
                className={inputCls} rows={3} />
            </FormField>
            <FormField label={t.coachRecommendation}>
              <textarea value={form.coachRecommendation} onChange={e => setForm(prev => ({ ...prev, coachRecommendation: e.target.value }))}
                className={inputCls} rows={3} />
            </FormField>
            <FormField label={isAr ? 'أولوية التطوير الأولى' : 'Development priority 1'}>
              <input value={form.developmentPriorities[0] || ''} onChange={e => setForm(prev => ({ ...prev, developmentPriorities: [e.target.value, prev.developmentPriorities[1] || ''] }))}
                className={inputCls} />
            </FormField>
            <FormField label={isAr ? 'أولوية التطوير الثانية' : 'Development priority 2'}>
              <input value={form.developmentPriorities[1] || ''} onChange={e => setForm(prev => ({ ...prev, developmentPriorities: [prev.developmentPriorities[0] || '', e.target.value] }))}
                className={inputCls} />
            </FormField>
            <FormField label={isAr ? 'إجراء تدريبي مقترح' : 'Suggested training action'}>
              <textarea value={form.trainingAction} onChange={e => setForm(prev => ({ ...prev, trainingAction: e.target.value }))}
                className={inputCls} rows={3} />
            </FormField>
            <FormField label={isAr ? 'موعد إعادة التقييم' : 'Reassessment date'}>
              <input type="date" min={form.evaluationDate} value={form.reassessmentDate || ''} onChange={e => setForm(prev => ({ ...prev, reassessmentDate: e.target.value || null }))}
                className={inputCls} />
            </FormField>
            <FormField label={isAr ? 'التوصية النهائية' : 'Final recommendation'}>
              <textarea value={form.finalRecommendation} onChange={e => setForm(prev => ({ ...prev, finalRecommendation: e.target.value }))}
                className={inputCls} rows={3} />
            </FormField>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer disabled:opacity-50">
              <Save className="h-4 w-4" /> {t.saveDraft}
            </button>
            {!confirmPublish ? (
              <button type="button" onClick={() => setConfirmPublish(true)} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50">
                <Send className="h-4 w-4" /> {t.publish}
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{t.publishConfirm}</p>
                <button type="button" onClick={() => handleSave(true)} disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50">
                  {t.confirm}
                </button>
                <button type="button" onClick={() => setConfirmPublish(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold transition cursor-pointer">
                  {t.cancel}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.evaluationsManagement}>
        {canEdit && (
          <button type="button" onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition cursor-pointer">
            <Plus className="h-4 w-4" /> {t.addEvaluation}
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CRITERIA_GROUPS.map(group => {
          const value = frameworkSummary[group.key];
          return (
            <div key={group.key} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <p className="text-[11px] font-bold text-slate-400">{isAr ? group.ar : group.en}</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value == null ? '—' : value.toFixed(1)}<span className="text-xs text-slate-400">/5</span></p>
              <p className="text-[10px] text-slate-400 mt-1">{isAr ? 'متوسط أحدث تقييم منشور لكل لاعب' : 'Average of each player’s latest published review'}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center gap-3">
          <History className="h-5 w-5 text-blue-500" />
          <div><p className="text-xl font-black text-slate-900 dark:text-white">{playersWithHistory.length}</p><p className="text-[11px] text-slate-400">{isAr ? 'لاعبون لديهم تقييمان منشوران أو أكثر' : 'Players with 2+ published reviews'}</p></div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          <div><p className="text-xl font-black text-slate-900 dark:text-white">{publishedEvaluations.length}</p><p className="text-[11px] text-slate-400">{isAr ? 'إجمالي التقييمات المنشورة' : 'Published reviews'}</p></div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-amber-500" />
          <div><p className="text-xl font-black text-slate-900 dark:text-white">{reassessmentDue}</p><p className="text-[11px] text-slate-400">{isAr ? 'إعادة تقييم مستحقة حسب أحدث خطة' : 'Reassessments due from latest plans'}</p></div>
        </div>
      </div>

      {playersWithHistory.length > 0 && (
        <section className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'سجل تطور اللاعب' : 'Player progress history'}</h3>
              <p className="text-[11px] text-slate-400">{isAr ? 'مقارنة اللاعب بتقييماته السابقة فقط، بدون ترتيب بين اللاعبين.' : 'Compares a player only with their own previous reviews; no player ranking.'}</p>
            </div>
            <select value={progressPlayerId} onChange={e => setProgressPlayerId(e.target.value)} className={`${inputCls} w-auto min-w-[180px]`}>
              <option value="">{isAr ? 'اختر لاعباً' : 'Select player'}</option>
              {playersWithHistory.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </div>
          {progressPlayerId && (
            <div className="space-y-3">
              {progressSummary && (
                <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs font-black text-emerald-900 dark:text-emerald-200">{isAr ? 'ملخص التطور' : 'Progress summary'}</p>
                      <p className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">
                        {progressSummary.firstDate} → {progressSummary.latestDate} · {progressSummary.reviewCount} {isAr ? 'تقييمات منشورة' : 'published reviews'}
                      </p>
                    </div>
                    {progressSummary.overallDelta != null && (
                      <Badge color={progressSummary.overallDelta > 0.05 ? 'emerald' : progressSummary.overallDelta < -0.05 ? 'amber' : 'blue'}>
                        {isAr ? 'التغير العام' : 'Overall change'}: {progressSummary.overallDelta > 0 ? '+' : ''}{progressSummary.overallDelta.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {CRITERIA_GROUPS.map(group => {
                      const firstScore = progressSummary.first[group.key];
                      const latestScore = progressSummary.latest[group.key];
                      const delta = firstScore != null && latestScore != null ? latestScore - firstScore : null;
                      return (
                        <div key={group.key} className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/70">
                          <p className="text-[10px] text-slate-400">{isAr ? group.ar : group.en}</p>
                          <div className="flex items-end justify-between gap-2 mt-1">
                            <span className="text-base font-black text-slate-900 dark:text-white">{latestScore == null ? '—' : latestScore.toFixed(1)}</span>
                            <span className={`text-[10px] font-black ${delta == null ? 'text-slate-400' : delta > 0.05 ? 'text-emerald-600' : delta < -0.05 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1">{isAr ? 'مقارنة بأول تقييم' : 'vs first review'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {progressEvaluations.map((ev, index) => {
                const current = frameworkScores(ev);
                const previous = index > 0 ? frameworkScores(progressEvaluations[index - 1]) : null;
                return (
                  <div key={ev.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">{ev.evaluationDate}</span>
                      <span className="text-[10px] text-slate-400">{ev.periodType}</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {CRITERIA_GROUPS.map(group => {
                        const score = current[group.key];
                        const prevScore = previous?.[group.key] ?? null;
                        return (
                          <div key={group.key} className="p-2 rounded-lg bg-white dark:bg-slate-900">
                            <p className="text-[10px] text-slate-400">{isAr ? group.ar : group.en}</p>
                            <div className="flex items-end justify-between gap-2">
                              <span className="text-base font-black text-slate-900 dark:text-white">{score == null ? '—' : score.toFixed(1)}</span>
                              <span className={`text-[10px] font-bold ${prevScore == null || score == null ? 'text-slate-400' : score > prevScore ? 'text-emerald-600' : score < prevScore ? 'text-amber-600' : 'text-slate-400'}`}>{formatDelta(score, prevScore)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {(ev.developmentPriorities?.length > 0 || ev.trainingAction || ev.reassessmentDate) && (
                      <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                        {ev.developmentPriorities?.length > 0 && <span><b>{isAr ? 'الأولويات' : 'Priorities'}:</b> {ev.developmentPriorities.join('، ')} </span>}
                        {ev.reassessmentDate && <span><b>{isAr ? 'إعادة التقييم' : 'Reassess'}:</b> {ev.reassessmentDate}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-slate-400 pointer-events-none" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={t.search}
            className={`${inputCls} ps-9`} />
        </div>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className={`${inputCls} w-auto min-w-[140px]`}>
          <option value="">{isAr ? 'كل الفرق' : 'All teams'}</option>
          {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} className={`${inputCls} w-auto min-w-[120px]`}>
          <option value="">{t.all}</option>
          <option value="draft">{t.draft}</option>
          <option value="published">{t.publishedStatus}</option>
        </select>
        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className={`${inputCls} w-auto min-w-[120px]`}>
          <option value="">{t.all}</option>
          <option value="monthly">{t.monthly}</option>
          <option value="quarterly">{t.quarterly}</option>
          <option value="custom">{t.customPeriod}</option>
        </select>
        {(filterTeam || filterStatus || filterPeriod || searchQ) && (
          <button onClick={() => { setFilterTeam(''); setFilterStatus(''); setFilterPeriod(''); setSearchQ(''); }}
            className="text-xs font-bold text-red-500 hover:text-red-400 transition cursor-pointer flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> {isAr ? 'مسح' : 'Clear'}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Star className="h-8 w-8" />} title={t.noEvaluations} subtitle={t.noEvaluationsHint} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(ev => (
            <EvalCard key={ev.id} ev={ev} player={players.find(p => p.id === ev.playerId)}
              coach={staff.find(s => s.userId === ev.coachId)} lang={lang}
              onEdit={canEdit ? () => openEdit(ev) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
