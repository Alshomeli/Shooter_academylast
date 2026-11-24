import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import type { Lang, Match, Team, Tournament, Training } from '@/types';
import { supabase } from '@/lib/supabase';

type Activities = {
  teams: Pick<Team, 'id' | 'name' | 'ageGroup'>[];
  trainings: (Pick<Training, 'id' | 'teamId' | 'title' | 'sessionDate' | 'durationMinutes'> & { status?: string })[];
  matches: Pick<Match, 'id' | 'teamId' | 'opponent' | 'matchDate' | 'location' | 'result' | 'academyScore' | 'opponentScore'>[];
  tournaments: Pick<Tournament, 'id' | 'name' | 'organizer' | 'season' | 'startDate' | 'endDate' | 'teamsCount'>[];
};

type Period = 'upcoming' | 'past' | 'all';
export function ParentActivities({ lang }: { lang: Lang }) {
  const [data, setData] = useState<Activities>({ teams: [], trainings: [], matches: [], tournaments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await supabase.rpc('get_parent_academy_activities');
        if (result.error || !result.data) throw new Error('Activities unavailable');
        const value = result.data as Activities;
        if (![value.teams, value.trainings, value.matches, value.tournaments].every(Array.isArray)) throw new Error('Invalid activities');
        if (!cancelled) { setData(value); setError(false); }
      } catch { if (!cancelled) setError(true); }
      finally { busy = false; if (!cancelled) setLoading(false); }
    };
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [retry]);
  const { teams, trainings, matches, tournaments } = data;
  const ar = lang === 'ar';
  const text = (a: string, e: string) => ar ? a : e;
  const [period, setPeriod] = useState<Period>('upcoming');
  const [teamId, setTeamId] = useState('all');
  const [limit, setLimit] = useState(6);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bahrain', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => today.find(p => p.type === type)?.value || '';
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  const inPeriod = (date: string) => period === 'all' || (period === 'past' ? date.slice(0,10) < day : date.slice(0,10) >= day);
  const teamName = (id: string) => teams.find(t => t.id === id)?.name || text('فريق غير محدد', 'Team not specified');
  const dateLabel = (date: string) => {
    if (!date) return text('لم يحدد الموعد', 'Date pending');
    const parsed = new Date(`${date.slice(0,10)}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat(ar ? 'ar-BH' : 'en-BH', { dateStyle: 'medium', timeZone: 'Asia/Bahrain' }).format(parsed);
  };
  const order = (a: string, b: string) => period === 'past' ? b.localeCompare(a) : a.localeCompare(b);
  const sessions = trainings.filter(t => (teamId === 'all' || t.teamId === teamId) && inPeriod(t.sessionDate)).sort((a,b) => order(a.sessionDate,b.sessionDate));
  const games = matches.filter(m => (teamId === 'all' || m.teamId === teamId) && inPeriod(m.matchDate)).sort((a,b) => order(a.matchDate,b.matchDate));
  // Tournaments have no team mapping; they are academy-wide announcements.
  const cups = tournaments.filter(t => inPeriod(t.endDate || t.startDate)).sort((a,b) => order(a.startDate,b.startDate));
  const results = { scheduled: text('مجدولة', 'Scheduled'), win: text('فوز', 'Win'), loss: text('خسارة', 'Loss'), draw: text('تعادل', 'Draw') };
  const card = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 text-sm';
  return <div className="space-y-4">
    {loading && <p role="status">{text('جارٍ تحميل أنشطة الأكاديمية…', 'Loading academy activities…')}</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-800"><p>{text('تعذر تحميل الأنشطة. حاول مرة أخرى.', 'Could not load activities. Please try again.')}</p><button className="mt-2 font-bold underline" onClick={() => { setLoading(true); setRetry(n => n + 1); }}>{text('إعادة المحاولة', 'Retry')}</button></div>}
    <section id="parent-trainings" className="arena-card rounded-2xl border p-4 sm:p-5 space-y-4" aria-labelledby="parent-training-title">
      <div><h2 id="parent-training-title" className="text-lg font-black flex items-center gap-2"><CalendarDays className="h-5 w-5 text-brand-600"/>{text('تدريبات الأكاديمية', 'Academy training')}</h2><p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{text('جداول جميع الفرق متاحة لجميع أولياء الأمور للعرض.', 'All team schedules are available for all guardians to view.')}</p></div>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm font-bold flex flex-col gap-1">{text('الفترة', 'Period')}<select value={period} onChange={e => { setPeriod(e.target.value as Period); setLimit(6); }} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900"><option value="upcoming">{text('القادم والحالي', 'Upcoming & current')}</option><option value="past">{text('السابق', 'Past')}</option><option value="all">{text('الكل', 'All')}</option></select></label>
        <label className="text-sm font-bold flex flex-col gap-1">{text('الفريق — التدريبات والمباريات', 'Team — training & matches')}<select value={teamId} onChange={e => { setTeamId(e.target.value); setLimit(6); }} className="max-w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900"><option value="all">{text('جميع الفرق', 'All teams')}</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sessions.slice(0,limit).map(t => {
        return <article key={t.id} className={card}><h3 className="font-black">{t.title}</h3><p className="font-semibold">{teamName(t.teamId)}</p><p>{dateLabel(t.sessionDate)}</p><p>{t.durationMinutes} {text('دقيقة', 'min')}</p>{t.status && <p className="font-bold">{({scheduled: text('مجدول', 'Scheduled'), completed: text('مكتمل', 'Completed'), cancelled: text('ملغى', 'Cancelled')} as Record<string,string>)[t.status] || t.status}</p>}</article>;
      })}</div>
      {!loading && !error && !sessions.length && <p className="text-sm text-slate-600 dark:text-slate-300">{text('لا توجد تدريبات ضمن الاختيار الحالي.', 'No training sessions match these filters.')}</p>}
      {sessions.length > limit && <button onClick={() => setLimit(n => n + 6)} className="text-sm font-bold text-brand-600 underline">{text('عرض المزيد', 'Show more')}</button>}
    </section>
    <section id="parent-competitions" className="arena-card rounded-2xl border p-4 sm:p-5 space-y-4" aria-labelledby="parent-competition-title">
      <h2 id="parent-competition-title" className="text-lg font-black flex items-center gap-2"><Trophy className="h-5 w-5 text-brand-600"/>{text('المباريات والبطولات والمنافسات', 'Matches, tournaments & competitions')}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">{text('حسب الفترة والفريق المختارين أعلاه. البطولات تشمل الأكاديمية كاملة.', 'Uses the period and team filters above. Tournaments cover the whole academy.')}</p>
      <h3 className="font-black">{text('المباريات', 'Matches')}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{games.slice(0,limit).map(m => <article key={m.id} className={card}><h4 className="font-black">{teamName(m.teamId)} {text('ضد', 'vs')} {m.opponent}</h4><p>{dateLabel(m.matchDate)}</p><p className="flex items-center gap-1"><MapPin className="h-4 w-4 shrink-0"/>{m.location || text('الموقع لم يحدد', 'Location pending')}</p><p className="font-bold">{results[m.result]}{m.result !== 'scheduled' && <> · <bdi>{m.academyScore} – {m.opponentScore}</bdi> <span className="text-xs">{text('(الأكاديمية – المنافس)', '(Academy – opponent)')}</span></>}</p></article>)}</div>
      {!loading && !error && !games.length && <p className="text-sm text-slate-600 dark:text-slate-300">{text('لا توجد مباريات ضمن الاختيار الحالي.', 'No matches match these filters.')}</p>}
      {games.length > limit && <button onClick={() => setLimit(n => n + 6)} className="text-sm font-bold text-brand-600 underline">{text('عرض المزيد من المباريات', 'Show more matches')}</button>}
      <h3 className="font-black pt-3 border-t border-slate-200 dark:border-slate-700">{text('البطولات والمنافسات', 'Tournaments & competitions')}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cups.slice(0,limit).map(t => <article key={t.id} className={card}><h4 className="font-black">{t.name}</h4><p>{t.organizer} · {t.season}</p><p>{dateLabel(t.startDate)} — {dateLabel(t.endDate)}</p><p>{t.teamsCount} {text('فرق مشاركة', 'participating teams')}</p></article>)}</div>
      {!loading && !error && !cups.length && <p className="text-sm text-slate-600 dark:text-slate-300">{text('لا توجد بطولات ضمن الفترة المختارة.', 'No tournaments in the selected period.')}</p>}
      {cups.length > limit && <button onClick={() => setLimit(n => n + 6)} className="text-sm font-bold text-brand-600 underline">{text('عرض المزيد من البطولات', 'Show more tournaments')}</button>}
    </section>
  </div>;
}
