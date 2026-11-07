import { useState, useMemo } from 'react';
import {
  ClipboardCheck, Plus, Search, Check, X, Clock, Calendar, Users, Trash2, TrendingUp,
} from 'lucide-react';
import type { Attendance, Player, Team, Match, Training, Lang, Role } from '@/types';
import { Badge, Modal, ConfirmDialog, PageHeader, EmptyState, StatCard } from '@/components/ui';
import { tr, positionLabel } from '@/lib/i18n';

interface AttendanceProps {
  players: Player[];
  teams: Team[];
  attendance: Attendance[];
  matches: Match[];
  trainings: Training[];
  onAttendanceChange: (a: Attendance[]) => void;
  activeRole: Role;
  lang: Lang;
}

type Status = 'present' | 'absent' | 'excused';
type SessionType = 'training' | 'match';

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white';

export function AttendanceView({ players, teams, attendance, matches, trainings, onAttendanceChange, activeRole, lang }: AttendanceProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canEdit = activeRole === 'manager' || activeRole === 'coach' || activeRole === 'receptionist';

  const playerById = (id: string) => players.find((p) => p.id === id);
  const teamById = (id: string) => teams.find((tm) => tm.id === id);
  const teamName = (id: string) => teamById(id)?.name || (isAr ? 'غير محدد' : 'Not specified');
  const playerName = (id: string) => playerById(id)?.name || (isAr ? 'لاعب محذوف' : 'Deleted player');

  const filtered = useMemo(() => {
    return attendance
      .filter((a) => {
        const player = playerById(a.playerId);
        if (!player) return false;
        if (teamFilter !== 'all' && player.teamId !== teamFilter) return false;
        if (typeFilter !== 'all' && a.sessionType !== typeFilter) return false;
        if (dateFilter && a.sessionDate !== dateFilter) return false;
        if (search && !player.name.includes(search)) return false;
        return true;
      })
      .sort((a, b) => (a.sessionDate < b.sessionDate ? 1 : a.sessionDate > b.sessionDate ? -1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, players, teamFilter, typeFilter, dateFilter, search]);

  const kpis = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((a) => a.status === 'present').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const excused = attendance.filter((a) => a.status === 'excused').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, excused, rate };
  }, [attendance]);

  const handleDelete = async () => {
    if (deleteId) await onAttendanceChange(attendance.filter((a) => a.id !== deleteId));
    setDeleteId(null);
  };

  const handleBatchSave = async (records: Omit<Attendance, 'id'>[]) => {
    const withIds = records.map((r, i) => ({ ...r, id: `att-${Date.now()}-${i}` }));
    await onAttendanceChange([...withIds, ...attendance]);
    setShowAdd(false);
  };

  const statusLabel = (s: Status) => (s === 'present' ? t.present : s === 'absent' ? t.absent : t.excused);
  const statusColor = (s: Status): 'emerald' | 'red' | 'amber' =>
    s === 'present' ? 'emerald' : s === 'absent' ? 'red' : 'amber';
  const typeLabel = (ty: SessionType) => (ty === 'training' ? t.training : t.match);

  const today = new Date().toISOString().substring(0, 10);

  return (
    <div className="space-y-5 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <PageHeader title={t.attendance} subtitle={isAr ? `${kpis.total} سجل مسجل · نسبة الحضور ${kpis.rate}%` : `${kpis.total} records · Attendance rate ${kpis.rate}%`}>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            تسجيل حضور جديد
          </button>
        )}
      </PageHeader>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          label={t.totalSessions}
          value={kpis.total}
          sublabel={isAr ? 'كل الجلسات' : 'All sessions'}
          color="slate"
        />
        <StatCard
          icon={<Check className="h-5 w-5" />}
          label={t.present}
          value={kpis.present}
          sublabel={isAr ? 'تدريب ومباريات' : 'Trainings & matches'}
          color="emerald"
        />
        <StatCard
          icon={<X className="h-5 w-5" />}
          label={t.absent}
          value={kpis.absent}
          sublabel={isAr ? 'بدون عذر' : 'Without excuse'}
          color="red"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label={t.excused}
          value={kpis.excused}
          sublabel={isAr ? 'غياب مبرر' : 'Justified absence'}
          color="amber"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={t.attendanceRate}
          value={`${kpis.rate}%`}
          sublabel={isAr ? 'من الإجمالي' : 'Of total'}
          color="blue"
        />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث باسم اللاعب...' : 'Search by player name...'}
            className="w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 pr-10 pl-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white"
          />
        </div>
        <div className="relative">
          <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="appearance-none px-3 py-2.5 pr-10 pl-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="all">{isAr ? 'كل الفرق' : 'All teams'}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.name}</option>
            ))}
          </select>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="all">{isAr ? 'كل الأنواع' : 'All types'}</option>
          <option value="training">{t.training}</option>
          <option value="match">{t.match}</option>
        </select>
        <div className="relative">
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 text-sm py-2.5 pr-10 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-white"
          />
        </div>
        {(teamFilter !== 'all' || typeFilter !== 'all' || dateFilter || search) && (
          <button
            onClick={() => { setTeamFilter('all'); setTypeFilter('all'); setDateFilter(''); setSearch(''); }}
            className="px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {isAr ? 'إعادة ضبط' : 'Reset'}
          </button>
        )}
      </div>

      {/* Attendance list */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" />}
            title={isAr ? 'لا توجد سجلات حضور' : 'No attendance records'}
            subtitle={isAr ? 'جرّب تعديل الفلاتر أو سجّل حضوراً جديداً' : 'Try adjusting filters or record new attendance'}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <th className="text-right py-3 px-4">{isAr ? 'اللاعب' : 'Player'}</th>
                  <th className="text-right py-3 px-4">{t.team}</th>
                  <th className="text-right py-3 px-4">{t.sessionDate}</th>
                  <th className="text-right py-3 px-4">{t.sessionType}</th>
                  <th className="text-right py-3 px-4">{t.status}</th>
                  <th className="text-right py-3 px-4">{t.notes}</th>
                  {activeRole === 'manager' && <th className="text-center py-3 px-4">{t.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const player = playerById(a.playerId);
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                            #{player?.jerseyNumber ?? '?'}
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{playerName(a.playerId)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {player ? teamName(player.teamId) : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300" dir="ltr">
                          {a.sessionDate}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge color={a.sessionType === 'training' ? 'blue' : 'amber'}>
                          {typeLabel(a.sessionType)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge color={statusColor(a.status)}>
                          {statusLabel(a.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {a.notes || '—'}
                        </span>
                      </td>
                      {activeRole === 'manager' && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setDeleteId(a.id)}
                            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch add modal */}
      {showAdd && (
        <BatchAttendanceForm
          players={players}
          teams={teams}
          matches={matches}
          trainings={trainings}
          defaultDate={today}
          onSave={handleBatchSave}
          onClose={() => setShowAdd(false)}
          lang={lang}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={isAr ? 'حذف سجل الحضور' : 'Delete Attendance Record'}
        message={isAr ? 'هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this record? This cannot be undone.'}
        confirmLabel={t.delete}
      />
    </div>
  );
}

/* ----------------------------- Batch entry form ----------------------------- */

function BatchAttendanceForm({
  players,
  teams,
  matches,
  trainings,
  defaultDate,
  onSave,
  onClose,
  lang,
}: {
  players: Player[];
  teams: Team[];
  matches: Match[];
  trainings: Training[];
  defaultDate: string;
  onSave: (records: Omit<Attendance, 'id'>[]) => void;
  onClose: () => void;
  lang: Lang;
}) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [teamId, setTeamId] = useState('');
  const [sessionDate, setSessionDate] = useState(defaultDate);
  const [sessionType, setSessionType] = useState<SessionType>('training');
  const [sessionId, setSessionId] = useState('');
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const teamPlayers = useMemo(
    () => players.filter((p) => p.teamId === teamId),
    [players, teamId],
  );

  const availableSessions = useMemo(() => {
    if (!teamId) return [];
    const trainingSessions = trainings.filter((x) => x.teamId === teamId).map((x) => ({ id: x.id, type: 'training' as const, date: x.sessionDate, label: x.title }));
    const matchSessions = matches.filter((x) => x.teamId === teamId).map((x) => ({ id: x.id, type: 'match' as const, date: x.matchDate, label: isAr ? `مباراة ضد ${x.opponent}` : `Match vs ${x.opponent}` }));
    return [...trainingSessions, ...matchSessions].sort((a, b) => b.date.localeCompare(a.date));
  }, [teamId, trainings, matches, isAr]);

  const markedCount = Object.keys(marks).length;
  const presentCount = Object.values(marks).filter((s) => s === 'present').length;
  const absentCount = Object.values(marks).filter((s) => s === 'absent').length;
  const excusedCount = Object.values(marks).filter((s) => s === 'excused').length;

  const setStatus = (playerId: string, status: Status) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (next[playerId] === status) {
        delete next[playerId];
      } else {
        next[playerId] = status;
      }
      return next;
    });
  };

  const markAll = (status: Status) => {
    if (!teamId) return;
    setMarks(() => {
      const next: Record<string, Status> = {};
      teamPlayers.forEach((p) => { next[p.id] = status; });
      return next;
    });
  };

  const handleSave = async () => {
    const records: Omit<Attendance, 'id'>[] = teamPlayers
      .filter((p) => marks[p.id])
      .map((p) => ({
        playerId: p.id,
        sessionDate,
        sessionType,
        trainingId: sessionType === 'training' ? sessionId || undefined : undefined,
        matchId: sessionType === 'match' ? sessionId || undefined : undefined,
        status: marks[p.id],
        notes: notes || undefined,
      }));
    if (!sessionId || records.length === 0) return;
    if (saving) return; setSaving(true); setSaveError('');
    try { await onSave(records); }
    catch { setSaveError(isAr ? 'تعذر حفظ الحضور. راجع السجلات قبل إعادة المحاولة.' : 'Could not save attendance. Review the records before retrying.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={isAr ? 'تسجيل حضور جديد' : 'Record New Attendance'} size="xl">
      <div className="space-y-5">
        {saveError && <p role="alert" className="text-red-600">{saveError}</p>}
        {/* Step 1: session config */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.team}</label>
            <select
              value={teamId}
              onChange={(e) => { setTeamId(e.target.value); setSessionId(''); setMarks({}); }}
              className={inputCls}
            >
              <option value="">{isAr ? 'اختر الفريق...' : 'Select team...'}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>{tm.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.sessionDate}</label>
            <input
              type="date"
              value={sessionDate}
              readOnly
              className={`${inputCls} opacity-80 cursor-not-allowed`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{isAr ? 'الجلسة' : 'Session'}</label>
            <select
              value={sessionId}
              onChange={(e) => {
                const selected = availableSessions.find((s) => s.id === e.target.value);
                setSessionId(e.target.value);
                if (selected) { setSessionType(selected.type); setSessionDate(selected.date); }
              }}
              className={inputCls}
            >
              <option value="">{isAr ? 'اختر التدريب أو المباراة...' : 'Select training or match...'}</option>
              {availableSessions.map((s) => (
                <option key={s.id} value={s.id}>{s.date} — {s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Player roster */}
        {!teamId ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-bold text-slate-400">{isAr ? 'اختر فريقاً لعرض اللاعبين' : 'Select a team to view players'}</p>
          </div>
        ) : teamPlayers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-bold text-slate-400">{isAr ? 'لا يوجد لاعبون في هذا الفريق' : 'No players in this team'}</p>
          </div>
        ) : (
          <>
            {/* Quick actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'تعيين الكل:' : 'Mark all:'}</span>
                <button
                  onClick={() => markAll('present')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" /> {t.present}
                </button>
                <button
                  onClick={() => markAll('absent')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> {t.absent}
                </button>
                <button
                  onClick={() => markAll('excused')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition cursor-pointer"
                >
                  <Clock className="h-3.5 w-3.5" /> {t.excused}
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="text-emerald-600 dark:text-emerald-400">{t.present} {presentCount}</span>
                <span className="text-red-600 dark:text-red-400">{t.absent} {absentCount}</span>
                <span className="text-amber-600 dark:text-amber-400">{t.excused} {excusedCount}</span>
                <span className="text-slate-400">{isAr ? 'من' : 'of'} {teamPlayers.length}</span>
              </div>
            </div>

            {/* Roster rows */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {teamPlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 px-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-black text-xs shrink-0">
                        #{p.jerseyNumber}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-400">{positionLabel(p.position, lang)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setStatus(p.id, 'present')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          marks[p.id] === 'present'
                            ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/40 scale-105 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" /> {t.present}
                      </button>
                      <button
                        onClick={() => setStatus(p.id, 'absent')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          marks[p.id] === 'absent'
                            ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-500/40 scale-105 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                      >
                        <X className="h-3.5 w-3.5" /> {t.absent}
                      </button>
                      <button
                        onClick={() => setStatus(p.id, 'excused')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          marks[p.id] === 'excused'
                            ? 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-500/40 scale-105 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" /> {t.excused}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{isAr ? 'ملاحظات عامة (اختياري)' : 'General notes (optional)'}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={isAr ? 'ملاحظات تُطبق على كل السجلات في هذه الجلسة...' : 'Notes applied to all records in this session...'}
                className={inputCls}
              />
            </div>
          </>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-400">
            {markedCount > 0 ? (isAr ? `${markedCount} لاعب تم وضع علامة عليه` : `${markedCount} players marked`) : (isAr ? 'لم يتم وضع علامة بعد' : 'No marks yet')}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || markedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <Check className="h-4 w-4" />
              {isAr ? 'حفظ الكل' : 'Save all'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
