import { useState, useMemo } from 'react';
import { Plus, Search, Star, X, TrendingUp, History, CalendarClock } from 'lucide-react';
import { averageEvaluationScores as average, evaluationFrameworkScores as frameworkScores } from '@/lib/evaluation-scores';
import type { Player, Team, Staff, PlayerEvaluation, Role, Lang } from '@/types';
import { tr } from '@/lib/i18n';
import { EvaluationCard } from '@/components/EvaluationCard';
import { PdfEvaluationForm } from '@/components/PdfEvaluationForm';
import { evaluationCriteria, emptyEvaluation, draftFromEvaluation } from '@/lib/evaluation-template';
import { isGoalkeeper } from '@/lib/goalkeepers';
import { academyToday } from '@/lib/report-dates';
import { db } from '@/lib/store';
import { PageHeader, Badge, EmptyState, inputCls } from '@/components/ui';

interface Props {
  evaluations: PlayerEvaluation[];
  players: Player[];
  teams: Team[];
  staff: Staff[];
  activeRole: Role;
  lang: Lang;
  onRefresh: () => Promise<void>;
}

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
  const [progressPlayerId, setProgressPlayerId] = useState('');

  const [form, setForm] = useState(() => emptyEvaluation(academyToday()));

  const filtered = useMemo(() => {
    return evaluations.filter(ev => {
      if (filterStatus && ev.status !== filterStatus) return false;
      if (filterPeriod && ev.periodType !== filterPeriod) return false;
      if (filterTeam) {
        if (ev.teamId !== filterTeam) return false;
      }
      if (searchQ) {
        const p = players.find(pl => pl.id === ev.playerId);
        if (!p || !p.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate));
  }, [evaluations, filterStatus, filterPeriod, filterTeam, searchQ, players]);

  const activePlayers = useMemo(() => players.filter(p => p.status === 'active'), [players]);

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

  const openNew = () => { setForm(emptyEvaluation(academyToday())); setShowForm(true); setError(''); };
  const openEdit = (ev: PlayerEvaluation) => {
    const draft = draftFromEvaluation(ev);
    const kind = ev.templateVersion === 2 ? ev.evaluationType || 'outfield' : isGoalkeeper(players.find(p => p.id === ev.playerId)?.position || '') ? 'goalkeeper' : 'outfield';
    const keys = new Set(evaluationCriteria(kind).map(c => c.key));
    setForm({ ...draft, evaluationType: kind, detailedScores: Object.fromEntries(Object.entries(draft.detailedScores).filter(([key]) => keys.has(key))) });
    setShowForm(true); setError('');
  };

  const handleSave = async (publish: boolean) => {
    if (!form.playerId) { setError(isAr ? 'يرجى اختيار اللاعب' : 'Please select a player'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        developmentPriorities: form.developmentPriorities.map(p => p.trim()).filter(Boolean),
      };
      const evalId = await db.savePlayerEvaluation(payload);
      setForm(prev => ({ ...prev, id: evalId }));
      if (publish) await db.publishPlayerEvaluation(form.id || evalId);
      await onRefresh();
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isAr ? 'حدث خطأ' : 'An error occurred'));
    } finally { setSaving(false); }
  };

  if (showForm) return <PdfEvaluationForm form={form} setForm={setForm} players={activePlayers}
    teams={teams} lang={lang} saving={saving} error={error}
    onSave={handleSave} onClose={() => setShowForm(false)} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t.evaluationsManagement}>
        {canEdit && (
          <button type="button" onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-500 transition cursor-pointer">
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
          <TrendingUp className="h-5 w-5 text-brand-500" />
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
                <div className="p-4 rounded-xl border border-brand-100 dark:border-brand-900/50 bg-brand-50/60 dark:bg-brand-950/20">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs font-black text-brand-900 dark:text-brand-200">{isAr ? 'ملخص التطور' : 'Progress summary'}</p>
                      <p className="text-[10px] text-brand-700/70 dark:text-brand-300/70">
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
                            <span className={`text-[10px] font-black ${delta == null ? 'text-slate-400' : delta > 0.05 ? 'text-brand-600' : delta < -0.05 ? 'text-amber-600' : 'text-slate-400'}`}>
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
                              <span className={`text-[10px] font-bold ${prevScore == null || score == null ? 'text-slate-400' : score > prevScore ? 'text-brand-600' : score < prevScore ? 'text-amber-600' : 'text-slate-400'}`}>{formatDelta(score, prevScore)}</span>
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
            <EvaluationCard key={ev.id} ev={ev} player={players.find(p => p.id === ev.playerId)}
              coach={staff.find(s => s.id === ev.coachId)} lang={lang}
              onEdit={canEdit ? () => openEdit(ev) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
