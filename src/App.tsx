import { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy, Component, type ReactNode } from 'react';
import { Menu, Bell, Clock, Target, Loader2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { db, prefs, signOut, isRegistering } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { tr } from '@/lib/i18n';
import { ParentPortal } from '@/views/ParentPortal';
import type {
  CurrentUser, Lang, Role, ViewId,
  Staff as StaffType, Team, Player, Parent, Subscription, Attendance,
  Match, Training, Transaction, Tournament as TournamentType, PlayerEvaluation,
  Settings as SettingsType, Notification, AuditLog,
} from '@/types';
import { Login } from '@/components/Login';
import { Sidebar } from '@/components/Sidebar';


/* ── Lazy-loaded views for code splitting ── */
const Dashboard = lazy(() => import('@/views/Dashboard').then(m => ({ default: m.Dashboard })));
const Approvals = lazy(() => import('@/views/Approvals').then(m => ({ default: m.Approvals })));
const Players = lazy(() => import('@/views/Players').then(m => ({ default: m.Players })));
const Parents = lazy(() => import('@/views/Parents').then(m => ({ default: m.Parents })));
const Teams = lazy(() => import('@/views/Teams').then(m => ({ default: m.Teams })));
const StaffView = lazy(() => import('@/views/Staff').then(m => ({ default: m.StaffView })));
const Subscriptions = lazy(() => import('@/views/Subscriptions').then(m => ({ default: m.Subscriptions })));
const AttendanceView = lazy(() => import('@/views/Attendance').then(m => ({ default: m.AttendanceView })));
const Schedules = lazy(() => import('@/views/Schedules').then(m => ({ default: m.Schedules })));
const Reports = lazy(() => import('@/views/Reports').then(m => ({ default: m.Reports })));
const MobileView = lazy(() => import('@/views/MobileView').then(m => ({ default: m.MobileView })));
const AICenter = lazy(() => import('@/views/AICenter').then(m => ({ default: m.AICenter })));
const SettingsView = lazy(() => import('@/views/Settings').then(m => ({ default: m.SettingsView })));
const Tournaments = lazy(() => import('@/views/Tournaments').then(m => ({ default: m.Tournaments })));
const Evaluations = lazy(() => import('@/views/Evaluations').then(m => ({ default: m.Evaluations })));
const AuditLogs = lazy(() => import('@/views/AuditLogs').then(m => ({ default: m.AuditLogs })));
const Messages = lazy(() => import('@/views/Messages').then(m => ({ default: m.Messages })));
const Registration = lazy(() => import('@/views/Registration').then(m => ({ default: m.Registration })));
const StaffRegistration = lazy(() => import('@/views/StaffRegistration').then(m => ({ default: m.StaffRegistration })));
const RegistrationAdmin = lazy(() => import('@/views/RegistrationAdmin').then(m => ({ default: m.RegistrationAdmin })));

/* ── Error Boundary ── */
interface ErrorBoundaryProps { children: ReactNode; lang: Lang; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      const isAr = this.props.lang === 'ar';
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center" dir={isAr ? 'rtl' : 'ltr'}>
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-lg font-black text-slate-800 dark:text-white mb-2">
            {isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
            {isAr ? 'يرجى تحديث الصفحة أو المحاولة مرة أخرى.' : 'Please refresh the page or try again.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer hover:bg-emerald-500 transition"
          >
            <RefreshCw className="h-4 w-4" />
            {isAr ? 'إعادة المحاولة' : 'Try Again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ViewLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
    </div>
  );
}

type DataState = {
  settings: SettingsType | null;
  staff: StaffType[];
  teams: Team[];
  players: Player[];
  parents: Parent[];
  subscriptions: Subscription[];
  attendance: Attendance[];
  matches: Match[];
  trainings: Training[];
  transactions: Transaction[];
  tournaments: TournamentType[];
  evaluations: PlayerEvaluation[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  loginLogs: AuditLog[];
};

const EMPTY_DATA: DataState = {
  settings: null, staff: [], teams: [], players: [], parents: [],
  subscriptions: [], attendance: [], matches: [], trainings: [],
  transactions: [], tournaments: [], evaluations: [], notifications: [],
  auditLogs: [], loginLogs: [],
};

type OAuthAuthorizationDetails = {
  authorization_id?: string;
  redirect_url?: string;
  redirect_uri?: string;
  scope?: string;
  client?: { name?: string };
};

async function oauthConsentRequest(path: string, method = 'GET', body?: unknown): Promise<OAuthAuthorizationDetails> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('AUTH_REQUIRED');
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const apiKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const response = await fetch(`${base}/auth/v1${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('OAUTH_REQUEST_FAILED');
  return data as OAuthAuthorizationDetails;
}

function OAuthConsent({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  const authorizationId = new URLSearchParams(window.location.search).get('authorization_id');
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!authorizationId) {
      setError(ar ? 'طلب التفويض غير صالح.' : 'Invalid authorization request.');
      return () => { mounted = false; };
    }
    void oauthConsentRequest(`/oauth/authorizations/${encodeURIComponent(authorizationId)}`)
      .then((data) => {
        if (!mounted) return;
        if (!data.authorization_id && data.redirect_url) {
          window.location.assign(data.redirect_url);
          return;
        }
        setDetails(data);
      })
      .catch(() => mounted && setError(ar ? 'تعذر تحميل طلب التفويض.' : 'Could not load the authorization request.'));
    return () => { mounted = false; };
  }, [authorizationId, ar]);

  const decide = async (action: 'approve' | 'deny') => {
    if (!authorizationId || busy) return;
    setBusy(true); setError('');
    try {
      const data = await oauthConsentRequest(
        `/oauth/authorizations/${encodeURIComponent(authorizationId)}/consent`,
        'POST',
        { action },
      );
      if (!data.redirect_url) throw new Error('MISSING_REDIRECT');
      window.location.assign(data.redirect_url);
    } catch {
      setError(ar ? 'تعذر إكمال طلب التفويض. حاول مرة أخرى.' : 'Could not complete authorization. Please try again.');
      setBusy(false);
    }
  };

  if (!details && !error) return <main className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></main>;
  const scopes = details?.scope?.split(/\s+/).filter(Boolean) ?? [];
  return <main className="min-h-screen bg-slate-950 p-4 flex items-center justify-center" dir={ar ? 'rtl' : 'ltr'}>
    <section className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 text-slate-900 shadow-xl">
      <ShieldCheck className="h-10 w-10 text-emerald-600 mb-4" />
      <h1 className="text-xl font-black mb-2">{ar ? 'السماح بالوصول' : 'Authorize access'}</h1>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : <>
        <p className="text-sm text-slate-600 mb-5">{ar ? 'راجع التطبيق والصلاحيات المطلوبة قبل الموافقة.' : 'Review the application and requested permissions before approving.'}</p>
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm"><strong>{ar ? 'التطبيق:' : 'Application:'}</strong> {details?.client?.name || (ar ? 'تطبيق خارجي' : 'External application')}</p>
          {details?.redirect_uri && <p className="text-xs break-all text-slate-500"><strong>{ar ? 'وجهة العودة:' : 'Redirect:'}</strong> {details.redirect_uri}</p>}
          {scopes.length > 0 && <div><p className="text-sm font-bold mb-2">{ar ? 'الصلاحيات المطلوبة:' : 'Requested permissions:'}</p><ul className="list-disc px-5 text-sm text-slate-600">{scopes.map((scope) => <li key={scope}>{scope}</li>)}</ul></div>}
        </div>
        <p className="mt-4 text-xs text-slate-500">{ar ? 'وافق فقط إذا كنت تعرف التطبيق وتثق به.' : 'Approve only if you recognize and trust this application.'}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button disabled={busy} onClick={() => void decide('deny')} className="rounded-xl border border-slate-300 py-3 text-sm font-bold disabled:opacity-50">{ar ? 'رفض' : 'Deny'}</button>
          <button disabled={busy} onClick={() => void decide('approve')} className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (ar ? 'موافقة' : 'Approve')}</button>
        </div>
      </>}
    </section>
  </main>;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeRole, setActiveRole] = useState<Role>('manager');
  const [currentTab, setCurrentTab] = useState<ViewId>(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/parent') return 'registration';
    if (path === '/coach') return 'staff-registration';
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || window.location.hash.replace('#', '');
    if (view === 'registration' || view === 'staff-registration' || view === 'registration-admin') return view as ViewId;
    return 'dashboard';
  });
  const entryPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const parentDirectEntry = entryPath === '/parent';
  const coachDirectEntry = entryPath === '/coach';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('ar');
  const [darkMode, setDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [data, setData] = useState<DataState>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const loadSequence = useRef(0);
  const loadInFlight = useRef<Promise<void> | null>(null);
  const refreshQueued = useRef(false);
  const userRef = useRef(currentUser?.authUserId);
  userRef.current = currentUser?.authUserId;

  useEffect(() => {
    setLang(prefs.getLang());
    setDarkMode(prefs.getDarkMode());

    let generation = 0;
    const { data: authData } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      const request = ++generation;
      if (_event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (isRegistering()) { setAuthReady(true); return; }
      if (!session?.user) {
        setCurrentUser(null); setData(EMPTY_DATA); setAuthReady(true); return;
      }
      // Leave the auth callback before starting another Supabase request.
      setTimeout(() => {
        void db.getCurrentUser().then(member => {
          if (request !== generation) return;
          setCurrentUser(member);
          if (member) {
            setActiveRole(member.role);
            if (member.registrationOnly && member.registrationMode === 'staff') setCurrentTab('staff-registration');
            else if (member.role === 'parent' && !member.registrationOnly) setCurrentTab('dashboard');
          }
          setAuthReady(true);
        }).catch(() => {
          if (request === generation) { setCurrentUser(null); setAuthReady(true); }
        });
      }, 0);
    });
    return () => { generation++; authData.subscription.unsubscribe(); };
  }, []);

  const loadAllData = useCallback(async () => {
    if (!currentUser) return;
    if (loadInFlight.current) {
      refreshQueued.current = true;
      return loadInFlight.current;
    }
    const request = ++loadSequence.current;
    const userId = currentUser.authUserId;
    const stillCurrent = () => request === loadSequence.current && userRef.current === userId;
    const run = (async () => {
    try {
      if (!dataRef.current.settings && !currentUser?.registrationOnly) setLoading(true);
      setLoadError(null);
      const role = currentUser?.role;
      const manager = role === 'manager';
      const finance = manager || role === 'accountant';
      const parent = role === 'parent';
      if (currentUser?.registrationOnly) { setData(EMPTY_DATA); return; }
      const [
        settings, staff, teams, players, parents, subscriptions,
        attendance, matches, trainings, transactions, tournaments, evaluations, notifications,
        auditLogs, loginLogs,
      ] = await Promise.all([
        db.getSettings(),
        parent ? [] : db.getStaff(), parent ? [] : db.getTeams(), db.getPlayers(), (parent || role === 'accountant') ? [] : db.getParents(),
        role === 'coach' ? [] : db.getSubscriptions(), db.getAttendance(), parent ? [] : db.getMatches(),
        parent ? [] : db.getTrainings(), finance ? db.getTransactions() : [], parent ? [] : db.getTournaments(),
        db.getEvaluations(), db.getNotifications(),
        manager ? db.getAuditLogs() : [], manager ? db.getLoginAuditLogs() : [],
      ]);
      if (!stillCurrent()) return;
      setData({
        settings, staff, teams, players, parents, subscriptions,
        attendance, matches, trainings, transactions, tournaments, evaluations, notifications,
        auditLogs, loginLogs,
      });
    } catch (err) {
      console.error('[load]', err);
      if (stillCurrent()) setLoadError('تعذر تحميل البيانات. يرجى المحاولة مرة أخرى. / Could not load your data. Please try again.');
    } finally {
      if (stillCurrent()) setLoading(false);
      loadInFlight.current = null;
      if (refreshQueued.current && userRef.current === userId) {
        refreshQueued.current = false;
        window.setTimeout(() => { void loadAllData(); }, 0);
      }
    }
    })();
    loadInFlight.current = run;
    return run;
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) loadAllData();
  }, [currentUser, loadAllData]);

  useEffect(() => {
    if (!authReady || !currentUser) return;
    const raw = new URLSearchParams(window.location.search).get('oauth_return');
    if (!raw) return;
    try {
      const target = new URL(raw, window.location.origin);
      if (target.origin === window.location.origin && target.pathname === '/oauth/consent') {
        window.location.replace(target.toString());
      }
    } catch {
      // Ignore malformed return targets; never allow an open redirect.
    }
  }, [authReady, currentUser]);



  useEffect(() => {
    if (!currentUser) return;
    const tables = [
      'staff', 'teams', 'players', 'parents', 'subscriptions', 'attendance',
      'matches', 'trainings', 'transactions', 'tournaments', 'player_evaluations',
      'notifications', 'notification_reads', 'academy_settings',
    ];
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const handleChange = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void loadAllData(), 500);
    };
    const channels = tables.map((t) => db.subscribe(t, handleChange));
    const refreshVisible = () => { if (document.visibilityState === 'visible') void loadAllData(); };
    const poll = window.setInterval(refreshVisible, 60000);
    window.addEventListener('focus', refreshVisible);
    return () => {
      if (debounce) clearTimeout(debounce);
      channels.forEach((ch) => supabaseUnsubscribe(ch));
      clearInterval(poll); window.removeEventListener('focus', refreshVisible);
    };
  }, [currentUser, loadAllData]);

  useEffect(() => {
    const updateClock = () => {
      try {
        const formatter = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
          timeZone: 'Asia/Bahrain',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: true,
        });
        setCurrentTime(formatter.format(new Date()));
      } catch {
        setCurrentTime(new Date().toLocaleTimeString());
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [lang]);

  useEffect(() => { prefs.saveLang(lang); document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
  useEffect(() => {
    prefs.saveDarkMode(darkMode);
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  /* ── Sync error handler ── */
  const handleSyncError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    if (msg === 'STALE_RECORD') {
      setSyncError(lang === 'ar' ? 'تغير السجل منذ فتحه. أعد فتحه ثم احفظ التعديل.' : 'This record changed. Reopen it before saving.');
    } else if (msg.includes('row-level security') || msg.includes('policy')) {
      setSyncError(lang === 'ar' ? 'ليس لديك صلاحية لإجراء هذا التعديل' : 'You do not have permission for this action');
    } else {
      setSyncError(lang === 'ar' ? 'حدث خطأ أثناء حفظ البيانات' : 'Failed to save data');
    }
    setTimeout(() => setSyncError(null), 5000);
    loadAllData();
  }, [lang, loadAllData]);

  const handleLogin = (user: CurrentUser) => {
    setCurrentUser(user);
    setActiveRole(user.role);
    const view = new URLSearchParams(window.location.search).get('view');
    setCurrentTab(user.registrationOnly && user.registrationMode === 'staff'
      ? 'staff-registration'
      : (user.role === 'parent' && !user.registrationOnly ? 'dashboard' : (view === 'registration' || view === 'staff-registration' ? view : 'dashboard')));
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    setCurrentTab('dashboard');
    setData(EMPTY_DATA);
  };

  /* Persist only the differences from the snapshot shown in each view. */
  const saveSettings = async (settings: SettingsType) => {
    try { await db.saveSettings(settings); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveStaff = async (items: StaffType[]) => {
    try { await db.syncStaff(items, data.staff); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveTeams = async (items: Team[]) => {
    try { await db.syncTeams(items, data.teams); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const savePlayers = async (items: Player[]) => {
    try { await db.syncPlayers(items, data.players); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveParents = async (items: Parent[]) => {
    try { await db.syncParents(items, data.parents); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveSubscriptions = async (items: Subscription[]) => {
    try { await db.syncSubscriptions(items, data.subscriptions); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveAttendance = async (items: Attendance[]) => {
    try { await db.syncAttendance(items, data.attendance); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveMatches = async (items: Match[]) => {
    try { await db.syncMatches(items, data.matches); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveTrainings = async (items: Training[]) => {
    try { await db.syncTrainings(items, data.trainings); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveTransactions = async (items: Transaction[]) => {
    try { await db.syncTransactions(items, data.transactions); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };
  const saveTournaments = async (items: TournamentType[]) => {
    try { await db.syncTournaments(items, data.tournaments); await loadAllData(); }
    catch (error) { handleSyncError(error); throw error; }
  };

  const t = tr(lang);

  const viewTitles: Record<ViewId, string> = {
    dashboard: t.dashboard,
    approvals: t.approvals,
    players: t.players,
    parents: t.parents,
    teams: t.teams,
    staff: t.staff,
    subscriptions: t.subscriptions,
    attendance: t.attendance,
    schedules: t.schedules,
    tournaments: t.tournaments,
    evaluations: t.evaluations,
    reports: t.reports,
    'audit-logs': lang === 'ar' ? 'سجل التدقيق' : 'Audit Log',
    mobile: t.mobile,
    'ai-center': t.aiCenter,
    messages: t.messages,
    registration: t.registration,
    'staff-registration': lang === 'ar' ? 'طلب موظف / مدرب' : 'Staff / coach application',
    'registration-admin': t.registrationAdmin,
    settings: t.settings,
  };

  const roleLabels: Record<Role, string> = {
    manager: t.manager,
    accountant: t.accountant,
    coach: t.coach,
    receptionist: t.receptionist,
    parent: t.parent,
  };

  const allowedViewsByRole: Record<Exclude<Role, 'parent'>, ViewId[]> = {
    manager: ['dashboard', 'approvals', 'registration-admin', 'players', 'parents', 'teams', 'staff', 'subscriptions', 'attendance', 'schedules', 'tournaments', 'evaluations', 'reports', 'audit-logs', 'messages', 'ai-center', 'settings'],
    accountant: ['dashboard', 'subscriptions', 'reports', 'messages', 'ai-center'],
    coach: ['dashboard', 'players', 'parents', 'teams', 'attendance', 'schedules', 'tournaments', 'evaluations', 'reports', 'messages', 'ai-center'],
    receptionist: ['dashboard', 'players', 'parents', 'teams', 'subscriptions', 'attendance', 'tournaments', 'reports', 'messages', 'ai-center'],
  };

  const safeCurrentTab: ViewId = activeRole === 'parent'
    ? 'dashboard'
    : (allowedViewsByRole[activeRole]?.includes(currentTab) ? currentTab : 'dashboard');

  useEffect(() => {
    if (!currentUser || currentUser.registrationOnly || currentUser.role === 'parent') return;
    if (currentTab === 'staff-registration') return;
    if (!allowedViewsByRole[currentUser.role as Exclude<Role, 'parent'>]?.includes(currentTab)) {
      setCurrentTab('dashboard');
    }
  }, [currentUser, currentTab]);

  const renderView = () => {
    switch (safeCurrentTab) {
      case 'dashboard':
        return <Dashboard players={data.players} subscriptions={data.subscriptions} matches={data.matches} transactions={data.transactions} staff={data.staff} teams={data.teams} parents={data.parents} evaluations={data.evaluations} setCurrentTab={setCurrentTab} activeRole={activeRole} lang={lang} />;
      case 'approvals':
        return <Approvals teams={data.teams} onRefresh={loadAllData} players={data.players} staff={data.staff} onPlayersChange={savePlayers} onStaffChange={saveStaff} activeRole={activeRole} lang={lang} />;
      case 'players':
        return <Players players={data.players} parents={data.parents} teams={data.teams} evaluations={data.evaluations} onPlayersChange={savePlayers} activeRole={activeRole} lang={lang} />;
      case 'parents':
        return <Parents parents={data.parents} players={data.players} teams={data.teams} subscriptions={data.subscriptions} onParentsChange={saveParents} onRefresh={loadAllData} activeRole={activeRole} lang={lang} />;
      case 'teams':
        return <Teams teams={data.teams} staff={data.staff} players={data.players} onTeamsChange={saveTeams} onRefresh={loadAllData} activeRole={activeRole} lang={lang} />;
      case 'staff':
        return <StaffView staff={data.staff} teams={data.teams} players={data.players} onStaffChange={saveStaff} onRefresh={loadAllData} activeRole={activeRole} lang={lang} />;
      case 'subscriptions':
        return <Subscriptions onPayment={async (sub, method) => { await db.recordPayment(sub, method); await loadAllData(); }} subscriptions={data.subscriptions} transactions={data.transactions} players={data.players} parents={data.parents} staff={data.staff} settings={data.settings} onSubscriptionsChange={saveSubscriptions} onTransactionsChange={saveTransactions} onRefresh={loadAllData} activeRole={activeRole} lang={lang} />;
      case 'attendance':
        return <AttendanceView players={data.players} teams={data.teams} matches={data.matches} trainings={data.trainings} attendance={data.attendance} onAttendanceChange={saveAttendance} activeRole={activeRole} lang={lang} />;
      case 'schedules':
        return <Schedules matches={data.matches} trainings={data.trainings} teams={data.teams} players={data.players} onMatchesChange={saveMatches} onTrainingsChange={saveTrainings} activeRole={activeRole} lang={lang} />;
      case 'tournaments':
        return <Tournaments tournaments={data.tournaments} onTournamentsChange={saveTournaments} activeRole={activeRole} lang={lang} />;
      case 'evaluations':
        return <Evaluations evaluations={data.evaluations} players={data.players} teams={data.teams} staff={data.staff} activeRole={activeRole} lang={lang} onRefresh={loadAllData} />;
      case 'reports':
        return <Reports players={data.players} teams={data.teams} staff={data.staff} matches={data.matches} trainings={data.trainings} transactions={data.transactions} subscriptions={data.subscriptions} attendance={data.attendance} evaluations={data.evaluations} settings={data.settings} activeRole={activeRole} lang={lang} />;
      case 'audit-logs':
        return <AuditLogs auditLogs={data.auditLogs} loginLogs={data.loginLogs} activeRole={activeRole} lang={lang} />;
      case 'mobile':
        return <MobileView players={data.players} teams={data.teams} staff={data.staff} subscriptions={data.subscriptions} transactions={data.transactions} trainings={data.trainings} matches={data.matches} activeRole={activeRole} lang={lang} />;
      case 'ai-center':
        return <AICenter players={data.players} subscriptions={data.subscriptions} transactions={data.transactions} staff={data.staff} teams={data.teams} matches={data.matches} trainings={data.trainings} tournaments={data.tournaments} parents={data.parents} attendance={data.attendance} evaluations={data.evaluations} activeRole={activeRole} lang={lang} onRefresh={loadAllData} />;
      case 'messages':
        return <Messages players={data.players} teams={data.teams} subscriptions={data.subscriptions} activeRole={activeRole} lang={lang} />;
      case 'settings':
        return data.settings ? <SettingsView settings={data.settings} onSettingsChange={saveSettings} activeRole={activeRole} lang={lang} /> : null;
      case 'registration':
        return <Registration lang={lang} />;
      case 'staff-registration':
        return currentUser ? <StaffRegistration user={currentUser} lang={lang} onLogout={handleLogout} onApproved={async () => {
          const member = await db.getCurrentUser();
          if (member && !member.registrationOnly) { setCurrentUser(member); setActiveRole(member.role); setCurrentTab('dashboard'); await loadAllData(); }
        }} /> : null;
      case 'registration-admin':
        return <RegistrationAdmin lang={lang} activeRole={activeRole} teams={data.teams} players={data.players} onRefresh={loadAllData} />;
      default:
        return <Dashboard players={data.players} subscriptions={data.subscriptions} matches={data.matches} transactions={data.transactions} staff={data.staff} teams={data.teams} parents={data.parents} evaluations={data.evaluations} setCurrentTab={setCurrentTab} activeRole={activeRole} lang={lang} />;
    }
  };

  const unreadCount = useMemo(() => data.notifications.filter((n) => !n.read).length, [data.notifications]);

  const oauthConsentPath = (window.location.pathname.replace(/\/+$/, '') || '/') === '/oauth/consent';

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (oauthConsentPath && currentUser && !recovery) return <OAuthConsent lang={lang} />;

  if (!currentUser || recovery) {
    return <Login registrationEntry={parentDirectEntry || currentTab === 'registration'} staffRegistrationEntry={coachDirectEntry || currentTab === 'staff-registration'} recovery={recovery} onLogin={(user) => { setRecovery(false); handleLogin(user); }} lang={lang} setLang={setLang} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{lang === 'ar' ? 'جاري تحميل البيانات...' : 'Loading data...'}</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="text-center max-w-sm">
          <p className="text-sm font-black text-red-600 mb-2">{lang === 'ar' ? 'خطأ في تحميل البيانات' : 'Failed to load data'}</p>
          <p className="text-xs text-slate-500 mb-4">{loadError}</p>
          <button onClick={loadAllData} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer hover:bg-emerald-500 transition">
            {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  if (currentUser.accountDisabled) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 sm:p-8 flex items-center justify-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-xl text-slate-900 text-center">
          <h1 className="text-xl font-black mb-2">{lang === 'ar' ? 'الحساب غير نشط' : 'Account inactive'}</h1>
          <p className="text-sm text-slate-600 mb-5">{lang === 'ar'
            ? 'هذا الحساب موجود في النظام ولكنه غير نشط حاليًا. تواصل مع الإدارة إذا كنت تعتقد أن هذه الحالة غير صحيحة.'
            : 'This account exists in the system but is currently inactive. Contact administration if you believe this is incorrect.'}</p>
          <button onClick={handleLogout} className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white hover:bg-slate-800">
            {lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
          </button>
        </div>
      </main>
    );
  }

  if (currentUser.registrationOnly && currentUser.registrationMode === 'staff') {
    return <StaffRegistration user={currentUser} lang={lang} onLogout={handleLogout} onApproved={async () => {
      const member = await db.getCurrentUser();
      if (member && !member.registrationOnly) { setCurrentUser(member); setActiveRole(member.role); setCurrentTab('dashboard'); await loadAllData(); }
    }} />;
  }

  // A staff application must belong to the applicant's own Auth account.
  // Never render the application form using an already-active manager/parent/staff session.
  if (currentTab === 'staff-registration' && !currentUser.registrationOnly) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 sm:p-8 flex items-center justify-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-xl rounded-2xl bg-white p-6 sm:p-8 shadow-xl text-slate-900">
          <h1 className="text-xl font-black mb-2">{lang === 'ar' ? 'طلب انضمام مدير / موظف / مدرب' : 'Manager / staff / coach application'}</h1>
          <p className="text-sm text-slate-600 mb-5">{lang === 'ar'
            ? 'أنت مسجل الدخول حاليًا بحساب موجود في النظام. لحماية الحسابات، يجب أن يكون طلب الانضمام مرتبطًا بحساب المتقدم نفسه، وليس بحساب المدير أو ولي الأمر الحالي.'
            : 'You are currently signed in with an existing account. For account safety, the application must belong to the applicant’s own account, not the current manager or parent account.'}</p>
          <button onClick={async () => { await handleLogout(); window.location.search = '?view=staff-registration'; }} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500">
            {lang === 'ar' ? 'تسجيل الخروج والبدء بحساب المتقدم' : 'Sign out and continue with applicant account'}
          </button>
        </div>
      </main>
    );
  }

  if (currentUser.role === 'parent') {
    return <ParentPortal key={currentUser.authUserId} openRegistration={currentTab === 'registration'} user={currentUser} players={data.players} subscriptions={data.subscriptions}
      attendance={data.attendance} evaluations={data.evaluations} settings={data.settings} lang={lang} setLang={setLang} onLogout={handleLogout} onRefresh={async () => { const member = await db.getCurrentUser(); if (member) setCurrentUser(member); await loadAllData(); }} />;
  }

  return (
    <div
      className={`flex min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-800'}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        lang={lang}
        setLang={setLang}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        currentUser={currentUser}
        academyName={data.settings?.name}
        logoUrl={data.settings?.logoUrl}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Header */}
        <header className={`border-b py-3 sm:py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-sm shrink-0 transition-colors duration-300 ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={lang === 'ar' ? 'فتح القائمة' : 'Open menu'}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <h1 className={`text-sm sm:text-lg font-black tracking-tight leading-tight ${
                darkMode ? 'text-white' : 'text-slate-900'
              }`}>
                {viewTitles[safeCurrentTab]}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
                <Target className="h-3 w-3 text-emerald-500" />
                {data.settings?.name?.trim() || t.academyName} · {roleLabels[activeRole]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Clock className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">{currentTime}</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={lang === 'ar' ? 'الإشعارات' : 'Notifications'}
                className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Bell className="h-5 w-5 text-slate-500" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className={`fixed sm:absolute left-3 right-3 sm:right-auto sm:left-0 sm:w-80 mt-2 rounded-2xl shadow-2xl border z-50 animate-fadeIn ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">{t.notifications}</h3>
                      {data.notifications.length > 0 && (
                        <button
                          onClick={() => {
                            const unreadIds = data.notifications.filter(n => !n.read).map(n => n.id);
                            const read = data.notifications.map((n) => ({ ...n, read: true }));
                            setData((p) => ({ ...p, notifications: read }));
                            void db.markNotificationsRead(unreadIds).then(loadAllData).catch(handleSyncError);
                          }}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          {t.markAllRead}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {data.notifications.length === 0 ? (
                        <div className="py-8 text-center">
                          <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-400 font-semibold">{t.noNotifications}</p>
                        </div>
                      ) : (
                        data.notifications.slice(0, 10).map((n) => (
                          <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${darkMode ? 'border-slate-800/50' : 'border-slate-50'} ${!n.read ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{n.title}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                            <p className="text-[9px] text-slate-400 mt-1">{new Date(n.timestamp).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-black text-slate-800 dark:text-white">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400">{roleLabels[activeRole]}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Sync error toast */}
        {syncError && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs font-bold text-red-700 dark:text-red-300 flex-1">{syncError}</p>
            <button onClick={() => setSyncError(null)} className="text-red-400 hover:text-red-600 text-xs font-bold cursor-pointer">&times;</button>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto animate-fadeIn">
            <ErrorBoundary lang={lang}>
              <Suspense fallback={<ViewLoader />}>
                {renderView()}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function supabaseUnsubscribe(channel: ReturnType<typeof db.subscribe>) {
  try { supabase.removeChannel(channel); } catch { /* ignore */ }
}
