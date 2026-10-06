import { useEffect, useMemo, useState } from 'react';
import {
  Users, Trophy, Wallet, TrendingUp, Activity, Target,
  Calendar, Award, Percent, Goal, ShieldCheck, Receipt, FileWarning, AlertTriangle,
} from 'lucide-react';
import type { Player, Subscription, Match, Transaction, Staff, Team, Parent, PlayerEvaluation, Lang, Role, ViewId } from '@/types';
import { StatCard, PageHeader } from '@/components/ui';
import { DonutChart, BarChart, LineChart } from '@/components/Charts';
import { RemindersPanel } from '@/components/RemindersPanel';
import { TelegramLinkCard } from '@/components/TelegramLinkCard';
import { getSubscriptionReminders } from '@/lib/reminders';
import { tr, monthsArray, statusLabel, positionLabel } from '@/lib/i18n';
import { db } from '@/lib/store';

interface DashboardProps {
  players: Player[];
  subscriptions: Subscription[];
  matches: Match[];
  transactions: Transaction[];
  staff: Staff[];
  teams: Team[];
  parents: Parent[];
  evaluations: PlayerEvaluation[];
  setCurrentTab: (v: ViewId) => void;
  activeRole: Role;
  lang: Lang;
}

export function Dashboard({ players, subscriptions, matches, transactions, staff, teams, parents, evaluations, setCurrentTab, activeRole, lang }: DashboardProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const MONTHS = monthsArray(lang);
  const canSeeFinance = activeRole === 'manager' || activeRole === 'accountant';
  const canRecordPayments = activeRole === 'manager' || activeRole === 'accountant';
  const canSeeSubscriptions = activeRole === 'manager' || activeRole === 'accountant' || activeRole === 'receptionist';
  const canSeeTechnical = activeRole === 'manager' || activeRole === 'coach';
  const canSeeStaff = activeRole === 'manager';
  const canSeeEvaluations = activeRole === 'manager' || activeRole === 'coach';
  const [managementAlerts, setManagementAlerts] = useState({ pendingPaymentProofs: 0, expiringStaffDocuments: 0, expiredStaffDocuments: 0, unpaidSubscriptions: 0, dueAmount: 0, asOf: '' });
  useEffect(() => {
    if (!['manager','accountant'].includes(activeRole)) return;
    db.getManagementAlertSummary().then(setManagementAlerts).catch(() => {});
  }, [activeRole, subscriptions.length, transactions.length, staff.length]);

  const reminders = useMemo(
    () => getSubscriptionReminders(subscriptions, players, parents),
    [subscriptions, players, parents],
  );

  const reassessmentReminders = useMemo(() => {
    const latest = new Map<string, PlayerEvaluation>();
    evaluations.filter(ev => ev.status === 'published').forEach(ev => {
      const current = latest.get(ev.playerId);
      if (!current || ev.evaluationDate > current.evaluationDate) latest.set(ev.playerId, ev);
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingLimit = new Date(today);
    upcomingLimit.setDate(upcomingLimit.getDate() + 14);
    return Array.from(latest.values())
      .filter(ev => ev.reassessmentDate)
      .map(ev => {
        const due = new Date(`${ev.reassessmentDate}T00:00:00`);
        return { evaluation: ev, player: players.find(p => p.id === ev.playerId), due, overdue: due <= today };
      })
      .filter(item => item.due <= upcomingLimit)
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [evaluations, players]);

  const stats = useMemo(() => {
    const activePlayers = players.filter((p) => p.status === 'active').length;
    const totalRevenue = transactions.filter((tx) => tx.type === 'revenue').reduce((s, tx) => s + tx.amount, 0);
    const totalExpenses = transactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const paidSubs = subscriptions.filter((s) => s.status === 'paid').length;
    const unpaidSubs = subscriptions.filter((s) => s.status === 'unpaid').length;
    const completedMatches = matches.filter((m) => m.result !== 'scheduled');
    const wins = matches.filter((m) => m.result === 'win').length;
    const draws = matches.filter((m) => m.result === 'draw').length;
    const losses = matches.filter((m) => m.result === 'loss').length;
    const scheduled = matches.filter((m) => m.result === 'scheduled').length;
    const winRate = completedMatches.length > 0 ? Math.round((wins / completedMatches.length) * 100) : 0;
    const goalsScored = matches.reduce((s, m) => s + m.academyScore, 0);
    const goalsConceded = matches.reduce((s, m) => s + m.opponentScore, 0);

    return {
      activePlayers, totalRevenue, totalExpenses, netProfit,
      paidSubs, unpaidSubs, wins, draws, losses, scheduled,
      winRate, goalsScored, goalsConceded,
      totalStaff: staff.length, totalTeams: teams.length,
    };
  }, [players, subscriptions, matches, transactions, staff, teams]);

  const positionData = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((p) => { counts[p.position] = (counts[p.position] || 0) + 1; });
    const colors: Record<string, string> = {
      'حارس مرمى': '#f59e0b', 'Goalkeeper': '#f59e0b',
      'مدافع': '#3b82f6', 'Defender': '#3b82f6',
      'خط وسط': '#10b981', 'Midfielder': '#10b981',
      'مهاجم': '#ef4444', 'Forward': '#ef4444',
    };
    return Object.entries(counts).map(([label, value]) => ({
      label: positionLabel(label, lang), value, color: colors[label] || '#94a3b8',
    }));
  }, [players, lang]);

  const teamPlayersData = useMemo(() => {
    return teams.map((team) => ({
      label: team.name.replace(isAr ? 'فئة ' : 'Team ', ''),
      value: players.filter((p) => p.teamId === team.id).length,
      color: '#10b981',
    }));
  }, [teams, players, isAr]);

  const revenueByMonth = useMemo(() => {
    const byMonth: Record<string, number> = {};
    transactions.filter((tx) => tx.type === 'revenue').forEach((tx) => {
      const month = tx.transactionDate.substring(5, 7);
      const idx = parseInt(month) - 1;
      const label = MONTHS[idx] || month;
      byMonth[label] = (byMonth[label] || 0) + tx.amount;
    });
    return MONTHS.slice(0, 7).map((label) => ({ label, value: byMonth[label] || 0 }));
  }, [transactions, MONTHS]);

  const recentMatches = useMemo(() =>
    [...matches].sort((a, b) => b.matchDate.localeCompare(a.matchDate)).slice(0, 4),
  [matches]);

  return (
    <div className="space-y-6 text-right" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader title={t.dashboard} subtitle={
        activeRole === 'manager'
          ? (isAr ? 'نظرة شاملة على مؤشرات الأكاديمية والمالية والفنية' : 'Overview of academy, financial, and performance metrics')
          : activeRole === 'accountant'
          ? (isAr ? 'نظرة على المؤشرات المالية والاشتراكات' : 'Overview of financial and subscription metrics')
          : activeRole === 'coach'
          ? (isAr ? 'نظرة على اللاعبين والأداء الفني لفريقك' : 'Overview of your players and team performance')
          : (isAr ? 'نظرة على اللاعبين والاشتراكات والمتابعة اليومية' : 'Overview of players, subscriptions, and daily follow-up')
      } />

      {(activeRole === 'manager' || activeRole === 'coach') && <TelegramLinkCard lang={lang} />}

      {activeRole === 'coach' && <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-5 sm:p-6 text-white shadow-xl shadow-slate-300/30 dark:shadow-none">
        <div className="absolute -top-20 -end-10 h-48 w-48 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">{isAr ? 'مركز المدرب' : 'Coach workspace'}</p><h2 className="mt-2 text-xl sm:text-2xl font-black">{isAr ? 'ابدأ من أهم ما يحتاجه فريقك اليوم' : 'Start with what your team needs today'}</h2><p className="mt-1 max-w-2xl text-sm text-slate-300">{isAr ? 'تابع الحضور، جهّز المباريات، وراجع تطور اللاعبين من لوحة واحدة.' : 'Track attendance, prepare matches, and review player development from one focused workspace.'}</p></div>
          <div className="flex gap-2"><button onClick={() => setCurrentTab('attendance')} className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-black text-white transition hover:bg-brand-400">{isAr ? 'تسجيل الحضور' : 'Record attendance'}</button><button onClick={() => setCurrentTab('evaluations')} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20">{isAr ? 'التقييمات' : 'Evaluations'}</button></div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="text-[11px] text-slate-300">{isAr ? 'اللاعبون النشطون' : 'Active players'}</p><p className="mt-1 text-2xl font-black">{stats.activePlayers}</p></div><div className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="text-[11px] text-slate-300">{isAr ? 'نسبة الفوز' : 'Win rate'}</p><p className="mt-1 text-2xl font-black">{stats.winRate}%</p></div><div className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="text-[11px] text-slate-300">{isAr ? 'مباريات مجدولة' : 'Scheduled matches'}</p><p className="mt-1 text-2xl font-black">{stats.scheduled}</p></div><div className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="text-[11px] text-slate-300">{isAr ? 'إعادة تقييم قريبة' : 'Upcoming reviews'}</p><p className="mt-1 text-2xl font-black">{reassessmentReminders.length}</p></div></div>
      </section>}

      {(activeRole === 'manager' || activeRole === 'accountant') && (managementAlerts.pendingPaymentProofs > 0 || managementAlerts.unpaidSubscriptions > 0 || (activeRole === 'manager' && (managementAlerts.expiringStaffDocuments > 0 || managementAlerts.expiredStaffDocuments > 0))) && <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {managementAlerts.pendingPaymentProofs > 0 && <button onClick={()=>setCurrentTab('subscriptions')} className="text-start rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3"><Receipt className="h-5 w-5 text-amber-600 shrink-0"/><div><p className="font-black text-sm">{isAr?'إثباتات دفع بانتظار المراجعة':'Payment proofs awaiting review'}</p><p className="text-xs text-slate-500 mt-1">{managementAlerts.pendingPaymentProofs} {isAr?'طلب يحتاج قرار الإدارة':'proof(s) need a decision'}</p></div></button>}
        {managementAlerts.unpaidSubscriptions > 0 && <button onClick={()=>setCurrentTab('subscriptions')} className="text-start rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 flex gap-3"><AlertTriangle className="h-5 w-5 text-red-600 shrink-0"/><div><p className="font-black text-sm">{isAr?'اشتراكات غير مدفوعة':'Unpaid subscriptions'}</p><p className="text-xs text-slate-500 mt-1">{managementAlerts.unpaidSubscriptions} · {managementAlerts.dueAmount.toLocaleString()} {t.currency}</p></div></button>}
        {activeRole === 'manager' && (managementAlerts.expiringStaffDocuments > 0 || managementAlerts.expiredStaffDocuments > 0) && <button onClick={()=>setCurrentTab('staff')} className="text-start rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 flex gap-3"><FileWarning className="h-5 w-5 text-blue-600 shrink-0"/><div><p className="font-black text-sm">{isAr?'شهادات ووثائق الطاقم':'Staff certificates & documents'}</p><p className="text-xs text-slate-500 mt-1">{isAr?`${managementAlerts.expiringStaffDocuments} تنتهي خلال 30 يومًا · ${managementAlerts.expiredStaffDocuments} منتهية`:`${managementAlerts.expiringStaffDocuments} expire within 30 days · ${managementAlerts.expiredStaffDocuments} expired`}</p></div></button>}
      </div>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />} label={t.activePlayers} value={stats.activePlayers} sublabel={`${t.activePlayersSub} ${stats.totalTeams} ${t.teamsLabel}`} color="emerald" onClick={() => setCurrentTab('players')} />
        {canSeeFinance && <StatCard icon={<Wallet className="h-5 w-5" />} label={t.netProfit} value={`${stats.netProfit.toLocaleString()} ${t.currency}`} sublabel={`${t.revenueLabel} ${stats.totalRevenue.toLocaleString()}`} color="blue" onClick={() => setCurrentTab('subscriptions')} />}
        {canSeeTechnical && <StatCard icon={<Trophy className="h-5 w-5" />} label={t.winRate} value={`${stats.winRate}%`} sublabel={`${stats.wins} ${t.wins} · ${stats.losses} ${t.losses}`} color="amber" onClick={() => setCurrentTab('schedules')} />}
        {canSeeSubscriptions && <StatCard icon={<Activity className="h-5 w-5" />} label={t.paidSubsLabel} value={`${stats.paidSubs}/${stats.paidSubs + stats.unpaidSubs}`} sublabel={`${stats.unpaidSubs} ${t.unpaidSubsLabel}`} color="red" onClick={() => setCurrentTab('subscriptions')} />}
      </div>

      {/* Secondary KPIs */}
      {(canSeeTechnical || canSeeStaff) && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {canSeeTechnical && <StatCard icon={<Goal className="h-5 w-5" />} label={t.goalsScored} value={stats.goalsScored} sublabel={`${t.goalsConceded} ${stats.goalsConceded}`} color="emerald" onClick={() => setCurrentTab('schedules')} />}
        {canSeeTechnical && <StatCard icon={<Target className="h-5 w-5" />} label={t.goalDifference} value={stats.goalsScored - stats.goalsConceded} sublabel={t.goalDifference} color="blue" onClick={() => setCurrentTab('schedules')} />}
        {canSeeTechnical && <StatCard icon={<Calendar className="h-5 w-5" />} label={t.scheduledMatches} value={stats.scheduled} sublabel={t.scheduledMatchesHint} color="amber" onClick={() => setCurrentTab('schedules')} />}
        {canSeeStaff && <StatCard icon={<Award className="h-5 w-5" />} label={t.totalStaff} value={stats.totalStaff} sublabel={t.totalStaffHint} color="slate" onClick={() => setCurrentTab('staff')} />}
      </div>}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue line chart */}
        {canSeeFinance && <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{t.monthlyRevenue}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.monthlyRevenueHint}</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20">
              <TrendingUp className="h-4 w-4 text-brand-600" />
              <span className="text-xs font-black text-brand-600">{stats.totalRevenue.toLocaleString()} {t.currency}</span>
            </div>
          </div>
          <LineChart data={revenueByMonth} color="#10b981" height={200} />
        </div>}

        {/* Position distribution donut */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">{t.positionDistribution}</h3>
          <p className="text-[11px] text-slate-400 mb-4">{t.positionDistributionHint}</p>
          <DonutChart
            data={positionData}
            centerValue={players.length.toString()}
            centerLabel={t.playerLabel}
          />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Team players bar chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">{t.playersPerTeam}</h3>
          <BarChart data={teamPlayersData} />
        </div>

        {/* Match results donut */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">{t.matchResults}</h3>
          <DonutChart
            data={[
              { label: t.win, value: stats.wins, color: '#10b981' },
              { label: t.draw, value: stats.draws, color: '#f59e0b' },
              { label: t.loss, value: stats.losses, color: '#ef4444' },
              { label: t.scheduled, value: stats.scheduled, color: '#94a3b8' },
            ]}
            centerValue={`${stats.winRate}%`}
            centerLabel={t.winRateLabel}
          />
        </div>

        {/* Recent matches */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{t.recentMatches}</h3>
            <button onClick={() => setCurrentTab('schedules')} className="text-[11px] font-bold text-brand-600 hover:text-brand-700 cursor-pointer">{t.viewAll}</button>
          </div>
          <div className="space-y-3">
            {recentMatches.map((m) => {
              const team = teams.find((tm) => tm.id === m.teamId);
              const resultColor = m.result === 'win' ? 'bg-brand-500' : m.result === 'loss' ? 'bg-red-500' : m.result === 'draw' ? 'bg-amber-500' : 'bg-slate-400';
              const resultLabel = statusLabel(m.result, lang);
              return (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className={`w-1.5 h-10 rounded-full ${resultColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{t.against} {m.opponent}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{team?.ageGroup}</p>
                  </div>
                  <div className="text-left shrink-0">
                    {m.result !== 'scheduled' ? (
                      <span className="text-sm font-black text-slate-900 dark:text-white">{m.academyScore} - {m.opponentScore}</span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">{resultLabel}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reminders panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {canSeeSubscriptions && <RemindersPanel reminders={reminders} onNavigate={() => setCurrentTab('subscriptions')} compact lang={lang} />}

        {canSeeEvaluations && <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'إعادة تقييم اللاعبين' : 'Player reassessments'}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'المستحق والقادم خلال 14 يومًا' : 'Due and upcoming within 14 days'}</p>
            </div>
            <button onClick={() => setCurrentTab('evaluations')} className="text-[11px] font-bold text-brand-600 hover:text-brand-700 cursor-pointer">{t.viewAll}</button>
          </div>
          {reassessmentReminders.length === 0 ? (
            <div className="py-6 text-center">
              <Calendar className="h-7 w-7 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-400">{isAr ? 'لا توجد إعادة تقييم مستحقة أو قريبة' : 'No reassessments due or upcoming'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reassessmentReminders.slice(0, 5).map(({ evaluation, player, overdue }) => (
                <button key={evaluation.id} onClick={() => setCurrentTab('evaluations')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-start cursor-pointer">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${overdue ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{player?.name || (isAr ? 'لاعب' : 'Player')}</p>
                    <p className="text-[10px] text-slate-400">{isAr ? 'إعادة التقييم' : 'Reassessment'}: {evaluation.reassessmentDate}</p>
                  </div>
                  <span className={`text-[10px] font-black ${overdue ? 'text-red-600' : 'text-amber-600'}`}>{overdue ? (isAr ? 'مستحق' : 'Due') : (isAr ? 'قريب' : 'Upcoming')}</span>
                </button>
              ))}
            </div>
          )}
        </div>}

        {/* Quick stats summary */}
        {canSeeSubscriptions && <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">{t.quickSummary}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
              <p className="text-[11px] font-bold text-red-600 dark:text-red-400">{t.overdue}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{reminders.filter((r) => r.status === 'overdue').length}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{t.expiring}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{reminders.filter((r) => r.status === 'expiring').length}</p>
            </div>
            <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20">
              <p className="text-[11px] font-bold text-brand-600 dark:text-brand-400">{t.dueAmounts}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{reminders.reduce((s, r) => s + r.subscription.amount, 0)} {t.currency}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{t.collectionRate}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {subscriptions.length > 0 ? Math.round((subscriptions.filter((s) => s.status === 'paid').length / subscriptions.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>}
      </div>

      {/* Quick actions */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-brand-400" />
          <h3 className="text-sm font-black">{t.quickActions}</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ...(activeRole === 'manager' || activeRole === 'receptionist' ? [{ label: t.addPlayer, icon: Users, tab: 'players' as ViewId }] : []),
            ...(activeRole === 'manager' || activeRole === 'coach' || activeRole === 'receptionist' ? [{ label: t.recordAttendance, icon: Percent, tab: 'attendance' as ViewId }] : []),
            ...(activeRole === 'manager' || activeRole === 'coach' ? [{ label: t.scheduleMatch, icon: Calendar, tab: 'schedules' as ViewId }] : []),
            ...(canRecordPayments ? [{ label: t.recordPayment, icon: Wallet, tab: 'subscriptions' as ViewId }] : []),
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.tab}
                onClick={() => setCurrentTab(action.tab)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer text-right"
              >
                <Icon className="h-4 w-4 text-brand-400 shrink-0" />
                <span className="text-xs font-bold">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
