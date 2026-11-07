import { categoryPlayers } from '@/lib/goalkeepers';
import { useState, useMemo, type FormEvent } from 'react';
import {
  Trophy, Plus, Edit2, Trash2, Users, Calendar, Clock, MapPin, Phone, Eye,
} from 'lucide-react';
import type { Team, Staff, Player, Lang, Role } from '@/types';
import { db } from '@/lib/store';
import { Modal, ConfirmDialog, PageHeader, EmptyState, SaveButton } from '@/components/ui';
import { tr, dayLabel } from '@/lib/i18n';

interface TeamsProps {
  teams: Team[];
  staff: Staff[];
  players: Player[];
  onTeamsChange: (t: Team[]) => void;
  onRefresh: () => Promise<void>;
  activeRole: Role;
  lang: Lang;
}

const WEEK_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-800 dark:text-white';

// Younger age groups first: newer birth years or smaller U-age values.
const ageOrder = (team: Team): number => {
  const label = `${team.ageGroup} ${team.name}`;
  const years = [...label.matchAll(/(?:19|20)\d{2}/g)].map(match => Number(match[0]));
  if (years.length > 0) return 2100 - Math.max(...years);
  const underAge = label.match(/(?:\bU\s*[- ]?)(\d{1,2})\b/i);
  if (underAge) return Number(underAge[1]);
  const age = label.match(/(\d{1,2})\s*(?:سنة|سنوات|years?)/i);
  return age ? Number(age[1]) : Number.POSITIVE_INFINITY;
};

export function Teams({ teams, staff, players, onTeamsChange, onRefresh, activeRole, lang }: TeamsProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [showAdd, setShowAdd] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [viewTeamId, setViewTeamId] = useState<string | null>(null);
  const viewTeam = teams.find(team => team.id === viewTeamId);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const canEdit = activeRole === 'manager';
  const sortedTeams = useMemo(() => teams.filter(team => statusFilter === 'all' || (team.status || 'active') === statusFilter).sort((a, b) => ageOrder(a) - ageOrder(b) || a.name.localeCompare(b.name)), [teams, statusFilter]);

  const coachOf = (id: string) => staff.find((s) => s.id === id);
  const playersFor = (teamId: string) => { const team = teams.find(t => t.id === teamId); return team ? categoryPlayers(team, players) : []; };
  const playersIn = (teamId: string) => playersFor(teamId).length;

  const handleSave = async (data: Omit<Team, 'id'>, id?: string) => {
    if (id) {
      await onTeamsChange(teams.map((tm) => (tm.id === id ? { ...data, id } : tm)));
    } else {
      await onTeamsChange([...teams, { ...data, id: `team-${Date.now()}` }]);
    }
    setShowAdd(false);
    setEditTeam(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteError('');
    try {
      await db.deleteTeam(deleteId);
      await onRefresh();
      setDeleteId(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-5 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <PageHeader title={t.teams} subtitle={isAr ? `${teams.length} فئة سنية مسجلة` : `${teams.length} age groups registered`}>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t.add}
          </button>
        )}
      </PageHeader>

      <label className="flex items-center gap-3 text-sm font-bold">{isAr ? 'حالة الفئة' : 'Category status'}<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputCls} max-w-48`}><option value="all">{isAr ? 'الكل' : 'All'}</option><option value="active">{isAr ? 'مفعّلة' : 'Active'}</option><option value="inactive">{isAr ? 'غير مفعّلة' : 'Inactive'}</option></select></label>
      {sortedTeams.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-8 w-8" />}
          title={isAr ? 'لا توجد فرق مسجلة' : 'No teams registered'}
          subtitle={isAr ? 'ابدأ بإضافة فئة سنية جديدة لتنظيم اللاعبين والتدريبات' : 'Start by adding a new age group to organize players and trainings'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedTeams.map((tm) => {
            const coach = coachOf(tm.categoryKind === 'goalkeeper' ? tm.goalkeeperCoachId || '' : tm.coachId);
            const count = playersIn(tm.id);
            return (
              <div
                key={tm.id}
                className="relative overflow-hidden rounded-[24px] border border-[#4b648d] bg-gradient-to-b from-[#0c213f] to-[#07182e] p-5 text-white shadow-lg transition-shadow hover:shadow-xl group flex flex-col"
              >
                <div className="relative min-h-[148px] mb-4 flex items-start justify-between gap-3">
                  <div className="relative z-10 min-w-0 pt-3">
                    <p className="text-xl font-black leading-relaxed text-white break-words">{tm.name}</p>
                    <span className="mt-2 inline-flex rounded-xl border border-emerald-400/30 bg-gradient-to-b from-green-500 to-green-700 px-3 py-1 text-sm font-black text-white shadow-lg">{tm.ageGroup}</span>
                    <p className="mt-2 text-sm font-bold text-blue-100">{tm.categoryKind === 'goalkeeper' ? (isAr ? 'فئة الحراس' : 'Goalkeeper category') : (isAr ? 'فئة عادية' : 'Age category')} · {tm.status === 'inactive' ? (isAr ? 'غير مفعّلة' : 'Inactive') : (isAr ? 'مفعّلة' : 'Active')}</p>
                  </div>
                  <svg aria-hidden="true" viewBox="0 0 180 170" className="pointer-events-none absolute -end-6 bottom-0 h-40 w-44 opacity-90">
                    <defs><radialGradient id={`ball-${tm.id}`} cx="35%" cy="25%" r="75%"><stop offset="0%" stopColor="#fff"/><stop offset="65%" stopColor="#b4bdcc"/><stop offset="100%" stopColor="#4a5671"/></radialGradient></defs>
                    <path d="M4 140 155 8 139 43 178 16 130 78 171 63 104 126 155 112 92 163Z" fill="#ef244d" opacity=".65"/>
                    <path d="M1 119 115 17M18 153 168 37M47 162 175 76" stroke="#ff3659" strokeWidth="5" opacity=".6"/>
                    <circle cx="90" cy="99" r="58" fill={`url(#ball-${tm.id})`} stroke="#d9e0ec" strokeWidth="1.5"/>
                    <path d="m88 76 22 16-8 26H75l-9-26Z M45 63l18-12 9 17-20 18-12-7Z M119 53l17 16-4 17-23-11 1-19Z M139 107l8 14-15 22-17-8 5-24Z M68 144l-7 6-23-23 9-16 22 14Z M80 44l24 1-9 13-12 1Z" fill="#18263c"/>
                    <path d="m66 92-14-6m58 6 22-6m-30 32 13 17m-40-17-6 7m19-49-5-17" fill="none" stroke="#5b687e" strokeWidth="1.5"/>
                  </svg>
                </div>

                <div className="relative z-10 flex items-center gap-3 mb-4 p-4 rounded-2xl border border-blue-500/70 bg-gradient-to-br from-[#153c70] to-[#0b2a54] shadow-inner">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-950/60 text-3xl shrink-0" aria-hidden>
                    {coach?.avatarUrl || '👤'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-blue-200/70">{t.coach}</p>
                    <p className="text-lg font-black leading-relaxed text-white break-words">
                      {coach ? (isAr ? `مدرب ${tm.name.startsWith('فئة') ? tm.name : `فئة ${tm.name}`}` : `Coach — ${tm.name}`) : (isAr ? 'غير معيّن' : 'Not assigned')}
                    </p>
                  </div>
                </div>

                <p className="text-sm font-bold text-slate-100 mb-3 pb-3 border-b border-blue-400/15">{isAr ? 'اسم الكابتن: ' : 'Captain name: '}{coach?.name || (isAr ? 'غير معيّن' : 'Not assigned')}</p>
                <div className="divide-y divide-blue-400/15 text-sm text-slate-100 flex-1">
                  <div className="flex items-center gap-3 flex-wrap py-3">
                    <Calendar className="h-5 w-5 shrink-0 text-rose-500" />
                    <div className="flex flex-wrap gap-1">
                      {tm.trainingDays.length > 0 ? (
                        tm.trainingDays.map((d) => (
                          <span
                            key={d}
                            className="px-1 py-0.5 text-xs font-bold text-slate-100"
                          >
                            {dayLabel(d, lang)}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400">{isAr ? 'غير محدد' : 'Not specified'}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 py-3">
                    <Clock className="h-5 w-5 shrink-0 text-rose-500" />
                    <span className="font-semibold" dir="ltr">
                      {tm.trainingTime || (isAr ? 'غير محدد' : 'Not specified')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 py-3">
                    <MapPin className="h-5 w-5 shrink-0 text-rose-500" />
                    <span className="font-semibold">{t.pitchNumber} {tm.pitchNumber}</span>
                  </div>

                  <div className="flex items-center gap-3 py-3">
                    <Users className="h-5 w-5 shrink-0 text-rose-500" />
                    <span className="font-semibold">
                      {count} {count === 1 ? (isAr ? 'لاعب' : 'player') : (isAr ? 'لاعبين' : 'players')}
                    </span>
                  </div>

                  {coach?.phone && (
                    <div className="flex items-center gap-3 py-3">
                      <Phone className="h-5 w-5 shrink-0 text-rose-500" />
                      <span className="font-semibold" dir="ltr">
                        {coach.phone}
                      </span>
                    </div>
                  )}
                </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-blue-400/15">
                    <button type="button" onClick={() => setViewTeamId(tm.id)} aria-label={isAr ? `عرض ${tm.name}` : `View ${tm.name}`} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-blue-400/50 bg-blue-950/70 py-3 text-sm font-bold text-blue-100 hover:bg-blue-900/80 transition">
                      <Eye className="h-4 w-4" /> {isAr ? 'عرض' : 'View'}
                    </button>
                    {canEdit && <button
                      onClick={() => setEditTeam(tm)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-blue-400/60 text-base font-black text-white bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 shadow-lg transition cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> {t.edit}
                    </button>}
                    {activeRole === 'manager' && tm.status === 'inactive' && (
                    <button
                      onClick={() => setDeleteId(tm.id)}
                      className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    )}
                  </div>
              </div>
            );
          })}
        </div>
      )}

      {viewTeam && <Modal open onClose={() => setViewTeamId(null)} title={viewTeam.name} size="lg">
        <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              [isAr ? 'الفئة العمرية' : 'Age group', viewTeam.ageGroup],
              [isAr ? 'اسم الكابتن' : 'Captain name', coachOf(viewTeam.coachId)?.name || (isAr ? 'غير معيّن' : 'Not assigned')],
              [isAr ? 'أيام التدريب' : 'Training days', viewTeam.trainingDays.map(day => dayLabel(day, lang)).join('، ') || '—'],
              [isAr ? 'وقت التدريب' : 'Training time', viewTeam.trainingTime || '—'],
              [t.pitchNumber, viewTeam.pitchNumber || '—'],
              [isAr ? 'عدد اللاعبين' : 'Players', String(playersIn(viewTeam.id))],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-white break-words">{value}</dd>
            </div>)}
          </dl>
          <div>
            <h3 className="mb-2 font-bold text-slate-900 dark:text-white">{isAr ? 'لاعبو الفئة' : 'Category players'}</h3>
            {playersIn(viewTeam.id) ? <ul tabIndex={0} aria-label={isAr ? 'قائمة لاعبي الفئة' : 'Category player list'} className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-slate-700 px-3 divide-y divide-slate-200 dark:divide-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">{playersFor(viewTeam.id).map(player => <li key={player.id} className="py-2 text-sm text-slate-700 dark:text-slate-200">{player.name}</li>)}</ul> : <p className="text-sm text-slate-500 dark:text-slate-400">{isAr ? 'لا يوجد لاعبون في هذه الفئة' : 'No players in this category'}</p>}
          </div>
        </div>
      </Modal>}

      {(showAdd || editTeam) && (
        <TeamForm
          team={editTeam}
          staff={staff}
          onSave={handleSave}
          onClose={() => {
            setShowAdd(false);
            setEditTeam(null);
          }}
          lang={lang}
        />
      )}

      {deleteError && <p role="alert" className="text-sm font-bold text-red-600">{deleteError}</p>}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t.deleteTeam}
        message={isAr ? 'سيتم حذف الفئة غير المفعّلة فقط إذا لم يرتبط بها لاعبون أو تدريبات أو مباريات أو تقييمات. السجلات المرتبطة تمنع الحذف.' : 'Only an inactive category with no players, training sessions, matches or evaluations can be deleted. Linked records prevent deletion.'}
        confirmLabel={t.delete}
      />
    </div>
  );
}

function TeamForm({
  team,
  staff,
  onSave,
  onClose,
  lang,
}: {
  team: Team | null;
  staff: Staff[];
  onSave: (data: Omit<Team, 'id'>, id?: string) => void;
  onClose: () => void;
  lang: Lang;
}) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const eligibleCoaches = useMemo(
    () => staff.filter((s) => s.role === 'coach' && s.status === 'active' && (!s.coachKind || s.coachKind === 'team')),
    [staff],
  );

  const [form, setForm] = useState({
    version: team?.version,
    categoryKind: team?.categoryKind || ('team' as 'team' | 'goalkeeper'),
    status: team?.status || ('active' as 'active' | 'inactive'),
    name: team?.name || '',
    ageGroup: team?.ageGroup || '',
    coachId: team?.coachId || '',
    goalkeeperCoachId: team?.goalkeeperCoachId || '',
    trainingDays: team?.trainingDays || ([] as string[]),
    trainingTime: team?.trainingTime || '',
    pitchNumber: team?.pitchNumber || '',
  });

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      trainingDays: prev.trainingDays.includes(day)
        ? prev.trainingDays.filter((d) => d !== day)
        : [...prev.trainingDays, day],
    }));
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const teamCoach = form.coachId ? staff.find(s => s.id === form.coachId) : null;
    if (form.categoryKind !== 'goalkeeper' && form.coachId && (!teamCoach || teamCoach.role !== 'coach' || teamCoach.status !== 'active' || (teamCoach.coachKind && teamCoach.coachKind !== 'team'))) {
      setSaveError(isAr ? 'يجب اختيار مدرب فريق نشط.' : 'Select an active team coach.');
      return;
    }
    if (form.goalkeeperCoachId) {
      const goalkeeperCoach = staff.find(s => s.id === form.goalkeeperCoachId);
      if (!goalkeeperCoach || goalkeeperCoach.role !== 'coach' || goalkeeperCoach.status !== 'active' || goalkeeperCoach.coachKind !== 'goalkeeper') {
        setSaveError(isAr ? 'مدرب الحراس المحدد غير متاح.' : 'Selected goalkeeper coach is not available.');
        return;
      }
    }
    if (saving) return;
    setSaving(true); setSaveError('');
    try {
    await onSave({ ...form, coachId: form.categoryKind === 'goalkeeper' ? '' : form.coachId }, team?.id);

    } catch { setSaveError(lang === 'ar' ? 'تعذر حفظ التغيير. راجع الرسالة وحاول مجددًا.' : 'Could not save this change. Review the error and retry.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={team ? t.editTeam : isAr ? 'إضافة فريق جديد' : 'Add New Team'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={isAr ? 'نوع الفئة' : 'Category type'}>
            <select value={form.categoryKind} disabled={!!team} onChange={e => setForm({ ...form, categoryKind: e.target.value as 'team' | 'goalkeeper', coachId: '' })} className={inputCls}>
              <option value="team">{isAr ? 'فئة عادية' : 'Age category'}</option>
              <option value="goalkeeper">{isAr ? 'فئة الحراس' : 'Goalkeeper category'}</option>
            </select>
            {form.categoryKind === 'goalkeeper' && <p className="text-xs text-slate-500 mt-1">{isAr ? 'تجمع حراس جميع الفئات تلقائيًا مع بقاء كل حارس في فئته الأصلية.' : 'Automatically includes goalkeepers from all age categories while preserving their original category.'}</p>}
          </Field>
          <Field label={isAr ? 'حالة الفئة' : 'Category status'}>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} className={inputCls}>
              <option value="active">{isAr ? 'مفعّلة' : 'Active'}</option><option value="inactive">{isAr ? 'غير مفعّلة' : 'Inactive'}</option>
            </select>
          </Field>
          <Field label={isAr ? 'اسم الفريق' : 'Team name'}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isAr ? 'مثال: فئة 2014 (U-12)' : 'e.g. 2014 (U-12)'}
              className={inputCls}
              required
            />
          </Field>
          <Field label={t.ageGroup}>
            <input
              value={form.ageGroup}
              onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
              placeholder={isAr ? 'مثال: U-12' : 'e.g. U-12'}
              className={inputCls}
              required
            />
          </Field>
          <Field label={t.coach}>
            <select
              value={form.coachId} disabled={form.categoryKind === 'goalkeeper'}
              onChange={(e) => setForm({ ...form, coachId: e.target.value })}
              className={inputCls}
            >
              <option value="">{isAr ? 'بدون مدرب (يمكن تعيينه لاحقاً)' : 'No coach (assign later)'}</option>
              {eligibleCoaches.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.avatarUrl} {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={isAr ? 'مدرب حراس المرمى' : 'Goalkeeper coach'}>
            <select aria-label={isAr ? 'مدرب حراس المرمى' : 'Goalkeeper coach'} value={form.goalkeeperCoachId} onChange={e => setForm({...form, goalkeeperCoachId: e.target.value})} className={inputCls}>
              <option value="">{isAr ? 'غير معيّن' : 'Not assigned'}</option>
              {staff.filter(s => s.role === 'coach' && s.status === 'active' && s.coachKind === 'goalkeeper').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">{isAr ? 'مدرب الحراس يرى حراس جميع الفئات فقط، وتعيينه هنا يحدد مسؤولية تدريبات فئة الحراس.' : 'Goalkeeper coaches see only goalkeepers across all age categories. This assignment controls goalkeeper category training.'}</p>
          </Field>
          <Field label={t.pitchNumber}>
            <input
              value={form.pitchNumber}
              onChange={(e) => setForm({ ...form, pitchNumber: e.target.value })}
              placeholder={isAr ? 'مثال: 1' : 'e.g. 1'}
              className={inputCls}
            />
          </Field>
          <Field label={t.trainingTime}>
            <input
              value={form.trainingTime}
              onChange={(e) => setForm({ ...form, trainingTime: e.target.value })}
              placeholder={isAr ? 'مثال: 4:00 - 5:30 م' : 'e.g. 4:00 - 5:30 PM'}
              className={inputCls}
              dir="ltr"
            />
          </Field>
        </div>

        <Field label={t.trainingDays}>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {WEEK_DAYS.map((day) => {
              const checked = form.trainingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    checked
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                  }`}
                >
                  {dayLabel(day, lang)}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {t.cancel}
          </button>
          <SaveButton loading={saving}>{t.save}</SaveButton>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}


