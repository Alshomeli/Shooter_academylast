import { getDateRange, type DateRangePreset } from '@/lib/report-dates';
import { useState, useMemo, type ReactNode } from 'react';
import {
  BarChart3, Download, TrendingUp, Users, Trophy, Wallet,
  Activity, Target, Award, Percent, Printer, Calendar,
} from 'lucide-react';
import { averageEvaluationScores, evaluationFrameworkScores } from '@/lib/evaluation-scores';
import type {
  Player, Team, Staff, Match, Training, Transaction, Subscription,
  Attendance, Lang, Role, Settings, PlayerEvaluation,
} from '@/types';
import { PageHeader, StatCard } from '@/components/ui';
import { tr, monthsArray, roleLabel, positionLabel } from '@/lib/i18n';
import { BarChart, DonutChart, LineChart } from '@/components/Charts';

interface ReportsProps {
  players: Player[];
  teams: Team[];
  staff: Staff[];
  matches: Match[];
  trainings: Training[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  attendance: Attendance[];
  evaluations: PlayerEvaluation[];
  settings?: Settings | null;
  activeRole: Role;
  lang: Lang;
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
      {children}
    </div>
  );
}

function SectionHeader({
  icon, title, subtitle, gradient,
}: {
  icon: ReactNode; title: string; subtitle?: string; gradient: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function downloadCsv(filename: string, header: string, rows: string[]) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function esc(v: string) { return `"${(v || '').replace(/"/g, '""')}"`; }

function exportReportCsv(
  type: 'players' | 'financial',
  data: (Player | Transaction)[],
  teams: Team[],

) {
  const teamName = (id: string) => teams.find((tm) => tm.id === id)?.name || '';
  if (type === 'players') {
    const header = 'Name,Team,Position,Jersey,Birth Date,Status,Joined';
    const rows = (data as Player[]).map((p) =>
      [esc(p.name), esc(teamName(p.teamId)), esc(p.position), p.jerseyNumber, p.birthDate, p.status, p.joinedDate].join(',')
    );
    downloadCsv(`players-${Date.now()}.csv`, header, rows);
  } else {
    const header = 'Date,Type,Category,Amount,Description,Recorded By';
    const rows = (data as Transaction[]).map((tx) =>
      [tx.transactionDate, tx.type, esc(tx.category), tx.amount, esc(tx.description), esc(tx.recordedBy)].join(',')
    );
    downloadCsv(`financial-${Date.now()}.csv`, header, rows);
  }
}

const POSITION_COLORS: Record<string, string> = {
    'حارس مرمى': '#f59e0b', 'Goalkeeper': '#f59e0b',
    'مدافع': '#3b82f6', 'Defender': '#3b82f6',
    'خط وسط': '#10b981', 'Midfielder': '#10b981',
    'مهاجم': '#ef4444', 'Forward': '#ef4444',
  };
export function Reports({
  players, teams, staff, matches, transactions,
  subscriptions, attendance, evaluations, settings, activeRole, lang,
}: ReportsProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const MONTHS = monthsArray(lang);
  const brandName = settings?.name?.trim() || (isAr ? 'أكاديمية شوتر' : 'Shooter Academy');
  const academyLogo = '/شعار_أكاديمية_شوتر_ثلاثي_الأبعاد copy 2.png';

  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [rangeFrom, rangeTo] = datePreset === 'custom' ? [customFrom, customTo] : getDateRange(datePreset);

  const filteredTransactions = useMemo(() => {
    if (!rangeFrom && !rangeTo) return transactions;
    return transactions.filter((tx) => {
      const d = tx.transactionDate;
      if (rangeFrom && d < rangeFrom) return false;
      if (rangeTo && d > rangeTo) return false;
      return true;
    });
  }, [transactions, rangeFrom, rangeTo]);

  const filteredSubscriptions = useMemo(() => {
    if (!rangeFrom && !rangeTo) return subscriptions;
    return subscriptions.filter((s) => {
      if (rangeFrom && s.endDate < rangeFrom) return false;
      if (rangeTo && s.startDate > rangeTo) return false;
      return true;
    });
  }, [subscriptions, rangeFrom, rangeTo]);


  const inRange = (date: string) => (!rangeFrom || date >= rangeFrom) && (!rangeTo || date <= rangeTo);
  const filteredMatches = useMemo(() => matches.filter((m) => inRange(m.matchDate)), [matches, rangeFrom, rangeTo]);
  const filteredAttendance = useMemo(() => attendance.filter((a) => inRange(a.sessionDate)), [attendance, rangeFrom, rangeTo]);
  const filteredEvaluations = useMemo(() => evaluations.filter((e) => inRange(e.evaluationDate)), [evaluations, rangeFrom, rangeTo]);



  /* Financial Summary */
  const financial = useMemo(() => {
    const revenueTotal = filteredTransactions.filter((tx) => tx.type === 'revenue').reduce((s, tx) => s + tx.amount, 0);
    const expenseTotal = filteredTransactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const netProfit = revenueTotal - expenseTotal;
    const paidSubs = filteredSubscriptions.filter((s) => s.status === 'paid').length;
    const totalSubs = filteredSubscriptions.length;
    const collectionRate = totalSubs > 0 ? Math.round((paidSubs / totalSubs) * 100) : 0;

    const byMonthRev: Record<string, number> = {};
    const byMonthExp: Record<string, number> = {};
    filteredTransactions.forEach((tx) => {
      const month = tx.transactionDate.slice(0, 7);
      if (tx.type === 'revenue') byMonthRev[month] = (byMonthRev[month] || 0) + tx.amount;
      else byMonthExp[month] = (byMonthExp[month] || 0) + tx.amount;
    });
    const months = [...new Set([...Object.keys(byMonthRev), ...Object.keys(byMonthExp)])].sort();
    const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;

    return {
      revenueTotal, expenseTotal, netProfit, collectionRate, paidSubs, totalSubs,
      revenueBars: months.map((label) => ({ label: monthLabel(label), value: byMonthRev[label] || 0, color: '#10b981' })),
      expenseBars: months.map((label) => ({ label: monthLabel(label), value: byMonthExp[label] || 0, color: '#ef4444' })),
      netTrend: months.map((label) => ({ label: monthLabel(label), value: (byMonthRev[label] || 0) - (byMonthExp[label] || 0) })),
    };
  }, [filteredTransactions, filteredSubscriptions, MONTHS]);

  /* Performance Analytics */
  const performance = useMemo(() => {
    const completed = filteredMatches.filter((m) => m.result !== 'scheduled');
    const wins = filteredMatches.filter((m) => m.result === 'win').length;
    const draws = filteredMatches.filter((m) => m.result === 'draw').length;
    const losses = filteredMatches.filter((m) => m.result === 'loss').length;
    const scheduled = filteredMatches.filter((m) => m.result === 'scheduled').length;
    const winRate = completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0;
    const totalGoals = filteredMatches.reduce((s, m) => s + m.academyScore, 0);
    const goalsConceded = filteredMatches.reduce((s, m) => s + m.opponentScore, 0);
    const goalDifference = totalGoals - goalsConceded;

    return {
      wins, draws, losses, scheduled, winRate, completed,
      totalGoals, goalsConceded, goalDifference,
      resultsDonut: [
        { label: t.win, value: wins, color: '#10b981' },
        { label: t.draw, value: draws, color: '#f59e0b' },
        { label: t.loss, value: losses, color: '#ef4444' },
        { label: t.scheduled, value: scheduled, color: '#94a3b8' },
      ],
    };
  }, [filteredMatches, t]);

  /* Player Statistics */
  const playerStats = useMemo(() => {
    const totalPlayers = players.length;
    const activePlayers = players.filter((p) => p.status === 'active').length;
    const positionCounts: Record<string, number> = {};
    players.forEach((p) => { positionCounts[p.position] = (positionCounts[p.position] || 0) + 1; });
    const positionDonut = Object.entries(positionCounts).map(([label, value]) => ({
      label: positionLabel(label, lang), value, color: POSITION_COLORS[label] || '#94a3b8',
    }));
    const teamBars = teams.map((team) => ({
      label: team.name.replace(isAr ? 'فئة ' : 'Team ', ''),
      value: players.filter((p) => p.teamId === team.id).length, color: '#10b981',
    }));
    return { totalPlayers, activePlayers, positionDonut, teamBars };
  }, [players, teams, lang, isAr]);

  /* Attendance Report */
  const attendanceStats = useMemo(() => {
    const sessionKeys = new Set(filteredAttendance.map((a) =>
      a.trainingId ? `training:${a.trainingId}` : a.matchId ? `match:${a.matchId}` : `legacy:${a.sessionType}:${a.sessionDate}`
    ));
    const totalSessions = sessionKeys.size;
    const totalRecords = filteredAttendance.length;
    const present = filteredAttendance.filter((a) => a.status === 'present').length;
    const absent = filteredAttendance.filter((a) => a.status === 'absent').length;
    const excused = filteredAttendance.filter((a) => a.status === 'excused').length;
    const presentRate = totalRecords > 0 ? Math.round((present / totalRecords) * 100) : 0;
    const absentRate = totalRecords > 0 ? Math.round((absent / totalRecords) * 100) : 0;
    const excusedRate = totalRecords > 0 ? Math.round((excused / totalRecords) * 100) : 0;
    return {
      totalSessions, present, absent, excused, presentRate, absentRate, excusedRate,
      distribution: [
        { label: t.present, value: present, color: '#10b981' },
        { label: t.absent, value: absent, color: '#ef4444' },
        { label: t.excused, value: excused, color: '#f59e0b' },
      ],
    };
  }, [filteredAttendance, t]);

  /* Player Development Analytics */
  const developmentStats = useMemo(() => {
    const published = filteredEvaluations.filter(ev => ev.status === 'published');
    const byPlayer = new Map<string, PlayerEvaluation[]>();
    published.forEach(ev => {
      const list = byPlayer.get(ev.playerId) || [];
      list.push(ev);
      byPlayer.set(ev.playerId, list);
    });
    byPlayer.forEach(list => list.sort((a, b) => a.evaluationDate.localeCompare(b.evaluationDate)));
    const histories = Array.from(byPlayer.values()).filter(list => list.length >= 2);
    const average = (values: number[]) => averageEvaluationScores(values);
    const deltas = (pick: (ev: PlayerEvaluation) => number | null) => histories.flatMap(list => {
      const first = pick(list[0]);
      const latest = pick(list[list.length - 1]);
      return first != null && latest != null ? [latest - first] : [];
    });
    const latestReviews = Array.from(byPlayer.values()).map(list => list[list.length - 1]);
    const today = new Date().toISOString().slice(0, 10);
    return {
      publishedCount: published.length,
      playersWithHistory: histories.length,
      reassessmentDue: latestReviews.filter(ev => ev.reassessmentDate && ev.reassessmentDate <= today).length,
      changes: [
        { label: isAr ? 'فني' : 'Technical', value: average(deltas(ev => evaluationFrameworkScores(ev).technical)) },
        { label: isAr ? 'تكتيكي' : 'Tactical', value: average(deltas(ev => evaluationFrameworkScores(ev).tactical)) },
        { label: isAr ? 'بدني' : 'Physical', value: average(deltas(ev => evaluationFrameworkScores(ev).physical)) },
        { label: isAr ? 'نفسي واجتماعي' : 'Psychosocial', value: average(deltas(ev => evaluationFrameworkScores(ev).psychosocial)) },
      ],
    };
  }, [filteredEvaluations, isAr]);

  /* Staff Summary */
  const staffStats = useMemo(() => {
    const totalStaff = staff.length;
    const totalPayroll = staff.reduce((s, st) => s + st.salary, 0);
    const roleCount: Record<string, number> = {};
    staff.forEach((st) => { const label = roleLabel(st.role, lang); roleCount[label] = (roleCount[label] || 0) + 1; });
    return { totalStaff, totalPayroll, roleBars: Object.entries(roleCount).map(([label, value]) => ({ label, value, color: '#6366f1' })) };
  }, [staff, lang]);

  return (
    <div className="space-y-6 text-right" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="hidden print:flex items-center justify-between gap-4 border-b-2 border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <img src={academyLogo} alt={brandName} className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-black text-slate-900">{brandName}</h1>
            <p className="text-xs text-slate-500">{isAr ? 'تقرير إداري' : 'Administrative report'}</p>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 text-start">
          {settings?.phone && <div>{settings.phone}</div>}
          {settings?.email && <div>{settings.email}</div>}
          {settings?.address && <div>{settings.address}</div>}
        </div>
      </div>
      <PageHeader title={t.reports} subtitle={t.reportsSubtitle}>
        <button onClick={() => exportReportCsv('players', players, teams)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition cursor-pointer shadow-sm">
          <Download className="h-4 w-4" /> {t.exportPlayersCsv}
        </button>
        {(activeRole === 'manager' || activeRole === 'accountant') && <button onClick={() => exportReportCsv('financial', transactions, teams)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer shadow-sm">
          <Download className="h-4 w-4" /> {t.exportFinancialCsv}
        </button>}
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer shadow-sm">
          <Printer className="h-4 w-4" /> {t.print}
        </button>
      </PageHeader>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            <Calendar className="h-4 w-4" />
            {t.dateRange}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([['this_month', t.dateRangeThisMonth], ['last_month', t.dateRangeLastMonth], ['last_3_months', t.dateRangeLast3Months], ['this_year', t.dateRangeThisYear], ['custom', t.dateRangeCustom]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDatePreset(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  datePreset === key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50" dir="ltr" />
              <span className="text-xs text-slate-400">→</span>
              <input type="date" min={customFrom} value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50" dir="ltr" />
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      {(activeRole === 'manager' || activeRole === 'accountant') && <SectionCard>
        <SectionHeader icon={<Wallet className="h-5 w-5" />} title={t.financialSummary} subtitle={t.financialSummarySubtitle} gradient="from-blue-500 to-blue-600" />
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
          {isAr
            ? 'ملاحظة: مبالغ الإيرادات والمصروفات تعتمد على الحركات المالية المسجلة فقط، بينما نسبة التحصيل تعتمد على حالة الاشتراكات. لا يتم إنشاء حركات مالية رجعية للبيانات التاريخية تلقائيًا.'
            : 'Note: revenue and expense totals use recorded financial transactions, while collection rate uses subscription status. Historical payments are not backfilled automatically.'}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label={t.totalRevenue} value={`${financial.revenueTotal.toLocaleString()} ${t.currency}`} color="emerald" />
          <StatCard icon={<Wallet className="h-5 w-5" />} label={t.totalExpenses} value={`${financial.expenseTotal.toLocaleString()} ${t.currency}`} color="red" />
          <StatCard icon={<Activity className="h-5 w-5" />} label={t.netProfit} value={`${financial.netProfit.toLocaleString()} ${t.currency}`} sublabel={financial.netProfit >= 0 ? t.positive : t.negative} color={financial.netProfit >= 0 ? 'blue' : 'red'} />
          <StatCard icon={<Percent className="h-5 w-5" />} label={t.collectionRate} value={`${financial.collectionRate}%`} sublabel={`${financial.paidSubs} / ${financial.totalSubs}`} color="amber" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />{t.monthlyRevenueBars}</p>
            <BarChart data={financial.revenueBars} valueFormatter={(v) => v.toLocaleString()} height={180} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" />{t.monthlyExpenseBars}</p>
            <BarChart data={financial.expenseBars} valueFormatter={(v) => v.toLocaleString()} height={180} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />{t.netProfitTrend}</p>
            <LineChart data={financial.netTrend} color="#3b82f6" height={180} />
          </div>
        </div>
      </SectionCard>}

      {/* Performance Analytics */}
      {(activeRole === 'manager' || activeRole === 'coach') && <SectionCard>
        <SectionHeader icon={<Trophy className="h-5 w-5" />} title={t.performanceAnalytics} subtitle={t.performanceAnalyticsSubtitle} gradient="from-amber-500 to-amber-600" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Trophy className="h-5 w-5" />} label={t.winRate} value={`${performance.winRate}%`} sublabel={`${performance.wins} ${t.wins} · ${performance.completed.length}`} color="amber" />
          <StatCard icon={<Target className="h-5 w-5" />} label={t.goalsScored} value={performance.totalGoals} sublabel={t.revenueRecorded} color="emerald" />
          <StatCard icon={<Activity className="h-5 w-5" />} label={isAr ? 'الأهداف المستقبلة' : 'Goals Conceded'} value={performance.goalsConceded} sublabel={t.goalsAgainst} color="red" />
          <StatCard icon={<Award className="h-5 w-5" />} label={t.goalDifference} value={performance.goalDifference > 0 ? `+${performance.goalDifference}` : performance.goalDifference} sublabel={performance.goalDifference >= 0 ? t.positive : t.negative} color={performance.goalDifference >= 0 ? 'blue' : 'red'} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">{t.matchResultsDistribution}</p>
            <DonutChart data={performance.resultsDonut} centerValue={`${performance.winRate}%`} centerLabel={t.winRateLabel} size={180} />
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">{t.matchResultsBreakdown}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 p-4 text-center"><p className="text-3xl font-black text-brand-600 dark:text-brand-400">{performance.wins}</p><p className="text-xs font-bold text-brand-700 dark:text-brand-500 mt-1">{t.win}</p></div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 text-center"><p className="text-3xl font-black text-amber-600 dark:text-amber-400">{performance.draws}</p><p className="text-xs font-bold text-amber-700 dark:text-amber-500 mt-1">{t.draw}</p></div>
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-center"><p className="text-3xl font-black text-red-600 dark:text-red-400">{performance.losses}</p><p className="text-xs font-bold text-red-700 dark:text-red-500 mt-1">{t.loss}</p></div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-700/40 p-4 text-center"><p className="text-3xl font-black text-slate-600 dark:text-slate-300">{performance.scheduled}</p><p className="text-xs font-bold text-slate-700 dark:text-slate-400 mt-1">{t.scheduled}</p></div>
            </div>
          </div>
        </div>
      </SectionCard>}

      {/* Player Statistics */}
      <SectionCard>
        <SectionHeader icon={<Users className="h-5 w-5" />} title={t.playerStatistics} subtitle={t.playerStatisticsSubtitle} gradient="from-brand-500 to-brand-600" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Users className="h-5 w-5" />} label={t.totalPlayers} value={playerStats.totalPlayers} sublabel={t.allRegistered} color="emerald" />
          <StatCard icon={<Activity className="h-5 w-5" />} label={t.activePlayersCount} value={playerStats.activePlayers} sublabel={`${playerStats.totalPlayers > 0 ? Math.round((playerStats.activePlayers / playerStats.totalPlayers) * 100) : 0}%`} color="blue" />
          <StatCard icon={<Trophy className="h-5 w-5" />} label={t.teamsCount} value={teams.length} sublabel={t.ageGroups} color="amber" />
          <StatCard icon={<Target className="h-5 w-5" />} label={t.avgPlayersPerTeam} value={teams.length > 0 ? (playerStats.totalPlayers / teams.length).toFixed(1) : '0'} sublabel={t.perTeam} color="slate" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">{t.positionDistributionReport}</p>
            <DonutChart data={playerStats.positionDonut} centerValue={playerStats.totalPlayers.toString()} centerLabel={t.playerLabel} size={180} />
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">{t.playersPerTeam}</p>
            <BarChart data={playerStats.teamBars} height={180} />
          </div>
        </div>
      </SectionCard>

      {/* Player Development Analytics */}
      {(activeRole === 'manager' || activeRole === 'coach') && <SectionCard>
        <SectionHeader icon={<TrendingUp className="h-5 w-5" />} title={isAr ? 'تحليلات تطور اللاعبين' : 'Player Development Analytics'} subtitle={isAr ? 'مؤشرات مجمعة من التقييمات المنشورة، بدون ترتيب أو مقارنة بين اللاعبين.' : 'Aggregate indicators from published reviews, without ranking or comparing players.'} gradient="from-brand-500 to-teal-600" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<Award className="h-5 w-5" />} label={isAr ? 'التقييمات المنشورة' : 'Published reviews'} value={developmentStats.publishedCount} color="emerald" />
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label={isAr ? 'لاعبون لديهم سجل تطور' : 'Players with progress history'} value={developmentStats.playersWithHistory} sublabel={isAr ? 'تقييمان أو أكثر' : '2+ published reviews'} color="blue" />
          <StatCard icon={<Calendar className="h-5 w-5" />} label={isAr ? 'إعادة تقييم مستحقة' : 'Reassessments due'} value={developmentStats.reassessmentDue} color="amber" />
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">{isAr ? 'متوسط التغير من أول تقييم إلى أحدث تقييم لكل لاعب' : 'Average first-to-latest change per player'}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {developmentStats.changes.map(item => (
              <div key={item.label} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold text-slate-400">{item.label}</p>
                <p className={`mt-1 text-xl font-black ${item.value == null ? 'text-slate-400' : item.value > 0.05 ? 'text-brand-600' : item.value < -0.05 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}`}>
                  {item.value == null ? '—' : `${item.value > 0 ? '+' : ''}${item.value.toFixed(1)}`}
                </p>
                <p className="text-[9px] text-slate-400 mt-1">{isAr ? 'نقطة من 5' : 'points out of 5'}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>}

      {/* Attendance Report */}
      <SectionCard>
        <SectionHeader icon={<Percent className="h-5 w-5" />} title={t.attendanceReport} subtitle={t.attendanceReportSubtitle} gradient="from-violet-500 to-violet-600" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Activity className="h-5 w-5" />} label={t.totalSessions} value={attendanceStats.totalSessions} sublabel={t.attendanceAndAbsence} color="purple" />
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label={t.attendanceRate} value={`${attendanceStats.presentRate}%`} sublabel={`${attendanceStats.present} ${t.attendanceRecords}`} color="emerald" />
          <StatCard icon={<Activity className="h-5 w-5" />} label={t.absenceRate} value={`${attendanceStats.absentRate}%`} sublabel={`${attendanceStats.absent} ${t.absenceRecords}`} color="red" />
          <StatCard icon={<Award className="h-5 w-5" />} label={t.excusedRate} value={`${attendanceStats.excusedRate}%`} sublabel={`${attendanceStats.excused} ${t.excusedRecords}`} color="amber" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">{t.attendanceDistribution}</p>
            <DonutChart data={attendanceStats.distribution} centerValue={`${attendanceStats.presentRate}%`} centerLabel={isAr ? 'نسبة الحضور' : 'Attendance'} size={180} />
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">{t.attendanceBreakdown}</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-brand-50 dark:bg-brand-900/20">
                <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center text-white shrink-0"><TrendingUp className="h-5 w-5" /></div>
                <div className="flex-1"><p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.present}</p><p className="text-[11px] text-slate-400">{attendanceStats.present} {isAr ? 'سجل' : 'records'}</p></div>
                <span className="text-lg font-black text-brand-600 dark:text-brand-400">{attendanceStats.presentRate}%</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20">
                <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center text-white shrink-0"><Activity className="h-5 w-5" /></div>
                <div className="flex-1"><p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.absent}</p><p className="text-[11px] text-slate-400">{attendanceStats.absent} {isAr ? 'سجل' : 'records'}</p></div>
                <span className="text-lg font-black text-red-600 dark:text-red-400">{attendanceStats.absentRate}%</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center text-white shrink-0"><Award className="h-5 w-5" /></div>
                <div className="flex-1"><p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.excused}</p><p className="text-[11px] text-slate-400">{attendanceStats.excused} {isAr ? 'سجل' : 'records'}</p></div>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400">{attendanceStats.excusedRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Staff Summary */}
      {activeRole === 'manager' && <SectionCard>
        <SectionHeader icon={<BarChart3 className="h-5 w-5" />} title={t.staffSummary} subtitle={t.staffSummarySubtitle} gradient="from-slate-600 to-slate-700" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<Users className="h-5 w-5" />} label={t.totalStaffCount} value={staffStats.totalStaff} sublabel={t.coachesAndStaff} color="slate" />
          <StatCard icon={<Wallet className="h-5 w-5" />} label={t.totalSalaries} value={`${staffStats.totalPayroll.toLocaleString()} ${t.currency}`} sublabel={t.monthlyLabel} color="blue" />
          <StatCard icon={<Target className="h-5 w-5" />} label={t.avgSalary} value={`${staffStats.totalStaff > 0 ? Math.round(staffStats.totalPayroll / staffStats.totalStaff).toLocaleString() : 0} ${t.currency}`} sublabel={t.perEmployee} color="amber" />
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">{t.staffByRole}</p>
          <BarChart data={staffStats.roleBars} height={180} />
        </div>
      </SectionCard>}
    </div>
  );
}
