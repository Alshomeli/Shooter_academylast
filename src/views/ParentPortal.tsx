import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clipboard, CreditCard, FileText, FileUp, LogOut, Plus, Printer, RefreshCw, Star, UserRound, CalendarCheck2, WalletCards } from 'lucide-react';
import { Registration } from '@/views/Registration';
import { Badge, Modal } from '@/components/ui';
import { errorMessage, fetchMyApplications } from '@/lib/registration';
import type { RegistrationApplication } from '@/types';
import { planLabel } from '@/lib/i18n';
import type { Attendance, CurrentUser, Lang, PaymentProof, Player, PlayerDocument, PlayerEvaluation, Settings, Subscription } from '@/types';
import { db } from '@/lib/store';
import { tr } from '@/lib/i18n';

const bahrainToday = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bahrain', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));

export function ParentPortal({ user, players, subscriptions, attendance, evaluations, settings, lang, setLang, onLogout, onRefresh, openRegistration = false }: {
  openRegistration?: boolean; user: CurrentUser; players: Player[]; subscriptions: Subscription[]; attendance: Attendance[]; evaluations: PlayerEvaluation[]; settings: Settings | null; lang: Lang;
  setLang: (lang: Lang) => void; onLogout: () => void; onRefresh: () => Promise<void>;
}) {
  const ar = lang === 'ar';
  const academyName = settings?.name || (ar ? 'أكاديمية Shooter' : 'Shooter Academy');
  const benefitIban = settings?.benefitIban || '';
  const benefitAccountName = settings?.benefitAccountName || '';
  const paymentInstructions = ar ? (settings?.paymentInstructionsAr || '') : (settings?.paymentInstructionsEn || '');
  const text = (a: string, e: string) => ar ? a : e;
  const [apps, setApps] = useState<RegistrationApplication[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [editor, setEditor] = useState<RegistrationApplication | 'new' | null>(openRegistration ? 'new' : null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || '');
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [playerDocuments, setPlayerDocuments] = useState<PlayerDocument[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string,string>>({});
  const [payingSubscription, setPayingSubscription] = useState<Subscription | null>(null);
  const [resubmittingProof, setResubmittingProof] = useState<PaymentProof | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [transferDate, setTransferDate] = useState(bahrainToday());
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) || players[0];
  const playerSubscriptions = selectedPlayer ? subscriptions.filter((s) => s.playerId === selectedPlayer.id).sort((a,b) => b.startDate.localeCompare(a.startDate)) : [];
  const playerAttendance = selectedPlayer ? attendance.filter((a) => a.playerId === selectedPlayer.id) : [];
  const playerEvaluations = selectedPlayer ? evaluations.filter((e) => e.playerId === selectedPlayer.id && e.status === 'published').sort((a,b) => b.evaluationDate.localeCompare(a.evaluationDate)) : [];
  const presentCount = playerAttendance.filter(a=>a.status==='present').length;
  const attendanceRate = playerAttendance.length ? Math.round((presentCount/playerAttendance.length)*100) : 0;
  const latestEvaluation = playerEvaluations[0];
  const currentSubscription = playerSubscriptions.find(s=>s.status==='unpaid') || playerSubscriptions[0];
  const approvedPayments = playerSubscriptions.filter(s=>s.status==='paid');
  const selectedDocuments = selectedPlayer ? playerDocuments.filter(d=>d.playerId===selectedPlayer.id&&d.fileCategory!=='photo') : [];
  const load = useCallback(async () => {
    try { const [myApps, proofs, docs] = await Promise.all([fetchMyApplications(), db.getPaymentProofs(), db.getPlayerDocuments()]); setApps(myApps); setPaymentProofs(proofs); setPlayerDocuments(docs); const photos=docs.filter(d=>d.playerId&&d.fileCategory==='photo'); const pairs=await Promise.all(photos.map(async d=>[d.playerId!,await db.getPlayerDocumentUrl(d.filePath)] as const)); setPhotoUrls(Object.fromEntries(pairs)); setError(''); setReady(true); }
    catch (e) { setError(errorMessage(e, lang === 'ar')); }
  }, [lang]);
  useEffect(() => {
    void load();
    const refreshVisible = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refreshVisible, 60000);
    window.addEventListener('focus', refreshVisible);
    return () => { clearInterval(timer); window.removeEventListener('focus', refreshVisible); };
  }, [load]);
  const statusLabel = (status: RegistrationApplication['status']) => ({ draft: text('مسودة', 'Draft'), pending: text('بانتظار المراجعة', 'Pending review'), under_review: text('قيد المراجعة', 'Under review'), needs_info: text('يحتاج استكمال', 'More information needed'), approved: text('مقبول', 'Approved'), rejected: text('مرفوض', 'Rejected') })[status];
  const refresh = async () => { await load(); await onRefresh(); };
  const submitProof = async () => {
    if (!payingSubscription || !selectedPlayer || !paymentFile) return;
    try {
      setPaymentBusy(true); setError('');
      if (resubmittingProof) await db.resubmitPaymentProof(resubmittingProof, transferDate, paymentFile, paymentNote);
      else await db.submitPaymentProof(payingSubscription, selectedPlayer.id, transferDate, paymentFile, paymentNote);
      setPayingSubscription(null); setResubmittingProof(null); setPaymentFile(null); setPaymentNote('');
      await refresh();
    } catch (e) { setError(errorMessage(e, ar)); }
    finally { setPaymentBusy(false); }
  };
  const printReceipt = (proof: PaymentProof, sub: Subscription) => {
    if (!proof.receiptNumber || !selectedPlayer) return;
    const number = `SA-${String(proof.receiptNumber).padStart(6,'0')}`;
    const reviewed = proof.reviewedAt ? new Date(proof.reviewedAt).toLocaleString(lang==='ar'?'ar-BH':'en-BH') : proof.transferDate;
    const w = window.open('', '_blank', 'width=760,height=900');
    if (!w) return;
    w.opener = null;
    const safeAcademyName = escapeHtml(academyName);
    const safePlayerName = escapeHtml(selectedPlayer.name);
    const safePlan = escapeHtml(planLabel(sub.planType,lang));
    const safeReviewed = escapeHtml(reviewed);
    w.document.write(`<!doctype html><html dir="${lang==='ar'?'rtl':'ltr'}"><head><meta charset="utf-8"><title>${number}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#172033}.box{max-width:680px;margin:auto;border:1px solid #ddd;border-radius:18px;padding:28px}.muted{color:#64748b}.row{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #eee;padding:12px 0}.total{font-size:24px;font-weight:800;color:#059669}.stamp{margin-top:24px;padding:12px;background:#ecfdf5;border-radius:12px;color:#047857;font-weight:700}@media print{button{display:none}}</style></head><body><div class="box"><h1>${safeAcademyName}</h1><div class="muted">${lang==='ar'?'إيصال دفع اشتراك':'Subscription Payment Receipt'} · ${number}</div><div style="height:20px"></div><div class="row"><span>${lang==='ar'?'اللاعب':'Player'}</span><b>${safePlayerName}</b></div><div class="row"><span>${lang==='ar'?'الخطة':'Plan'}</span><b>${safePlan}</b></div><div class="row"><span>${lang==='ar'?'فترة الاشتراك':'Subscription period'}</span><b dir="ltr">${sub.startDate} — ${sub.endDate}</b></div><div class="row"><span>${lang==='ar'?'طريقة الدفع':'Payment method'}</span><b>Benefit / IBAN</b></div><div class="row"><span>${lang==='ar'?'تاريخ التحويل':'Transfer date'}</span><b>${proof.transferDate}</b></div><div class="row"><span>${lang==='ar'?'تاريخ الاعتماد':'Approved at'}</span><b>${safeReviewed}</b></div><div class="row"><span>${lang==='ar'?'المبلغ':'Amount'}</span><span class="total">${proof.amount.toFixed(3)} BHD</span></div><div class="stamp">${lang==='ar'?'تم التحقق من التحويل واعتماد الدفعة من الأكاديمية.':'Transfer verified and payment approved by the academy.'}</div><p class="muted" style="font-size:11px;margin-top:20px">${lang==='ar'?'هذا الإيصال صادر إلكترونيًا من النظام.':'This receipt was issued electronically by the system.'}</p><button onclick="window.print()" style="margin-top:16px;padding:10px 18px">${lang==='ar'?'طباعة / حفظ PDF':'Print / Save PDF'}</button></div></body></html>`);
    w.document.close();
  };
  const proofStatus = (status: PaymentProof['status']) => ({
    pending: text('بانتظار مراجعة الإدارة', 'Pending academy review'),
    approved: text('تم اعتماد الدفعة', 'Payment approved'),
    rejected: text('مرفوض', 'Rejected'),
    needs_info: text('يحتاج استكمال', 'More information needed'),
  })[status];
  return <main className="parent-portal min-h-screen bg-slate-100/80 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-8" dir={ar ? 'rtl' : 'ltr'}>
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-5 sm:p-7 text-white shadow-xl shadow-slate-300/30 dark:shadow-none"><div className="absolute -top-16 -end-10 h-44 w-44 rounded-full bg-brand-400/15 blur-3xl" /><div className="relative flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">{academyName}</p><h1 className="mt-2 text-2xl sm:text-3xl font-black">{text('بوابة ولي الأمر', 'Parent portal')}</h1><p className="mt-1 text-sm text-slate-300">{text(`مرحبًا ${user.name}، هذه متابعة أبنائك في مكان واحد`, `Welcome ${user.name}, your children’s progress at a glance`)}</p></div><div className="flex items-center gap-2"><button onClick={() => setLang(ar ? 'en' : 'ar')} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20">{ar ? 'English' : 'العربية'}</button><button onClick={() => void refresh()} className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-white transition hover:bg-white/20" aria-label={text('تحديث البيانات', 'Refresh data')}><RefreshCw className="h-4 w-4" /></button><button onClick={onLogout} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-900 transition hover:bg-brand-50"><LogOut className="h-4 w-4" />{text('خروج', 'Sign out')}</button></div></div></header>
      {error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">{text('المتابعة العائلية', 'Family overview')}</p><h2 className="mt-1 text-xl font-black">{text('أبنائي', 'My children')}</h2><p className="mt-1 text-sm text-slate-500">{players.length ? text('اختر لاعبًا لعرض الحضور والاشتراكات والتقييمات', 'Select a player to view attendance, subscriptions, and evaluations') : text('ستظهر بيانات الأبناء هنا بعد اعتماد الطلب وربط الحساب.', 'Your children will appear here after the academy approves the application and links your account.')}</p></div><button disabled={!ready} onClick={() => setEditor('new')} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 disabled:opacity-50"><Plus className="h-4 w-4" />{text('طلب تسجيل أبناء', 'Register children')}</button></div>
      {!players.length && <p className="text-slate-500">{text('ستظهر بيانات الأبناء هنا بعد اعتماد الطلب وربط الحساب.', 'Your children will appear here after the academy approves the application and links your account.')}</p>}
      {players.length > 0 && <div className="grid lg:grid-cols-[260px_1fr] gap-5">
        <aside className="space-y-3"><div className="flex items-center justify-between px-1"><span className="text-xs font-black text-slate-500">{text('اللاعبون', 'Players')}</span><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500 shadow-sm dark:bg-slate-900">{players.length}</span></div>
          {players.map((player) => <button key={player.id} onClick={() => setSelectedPlayerId(player.id)} className={`group w-full text-start rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${selectedPlayer?.id === player.id ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-900/10 dark:bg-brand-950/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
            <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-slate-800 grid place-items-center overflow-hidden">{photoUrls[player.id]?<img src={photoUrls[player.id]} alt="" className="w-full h-full object-cover"/>:<UserRound className="h-5 w-5" />}</div><div><p className="font-black">{player.name}</p><p className="text-xs text-slate-500">#{player.jerseyNumber || '—'} · {player.position || text('لم يحدد المركز','Position pending')}</p></div></div>
          </button>)}
        </aside>
        {selectedPlayer && <section className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 dark:from-brand-950/30 dark:via-slate-900 dark:to-blue-950/20"><div className="flex flex-wrap justify-between gap-4"><div className="flex items-center gap-3"><div className="h-16 w-16 rounded-2xl bg-white shadow-sm dark:bg-slate-800 grid place-items-center overflow-hidden">{photoUrls[selectedPlayer.id]?<img src={photoUrls[selectedPlayer.id]} alt="" className="w-full h-full object-cover"/>:<UserRound className="h-7 w-7"/>}</div><div><h2 className="text-xl font-black">{selectedPlayer.name}</h2><p className="text-sm text-slate-500">{text('ملف اللاعب','Player profile')}</p></div></div><Badge color={selectedPlayer.status === 'active' ? 'green' : 'amber'}>{selectedPlayer.status === 'active' ? text('نشط','Active') : text('غير نشط','Inactive')}</Badge></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><CalendarCheck2 className="h-4 w-4"/>{text('نسبة الحضور','Attendance rate')}</div><p className="font-black text-lg mt-1">{attendanceRate}%</p><p className="text-[10px] text-slate-400">{presentCount}/{playerAttendance.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><Star className="h-4 w-4"/>{text('آخر تقييم','Latest evaluation')}</div><p className="font-black text-lg mt-1">{latestEvaluation?.overallScore!=null?latestEvaluation.overallScore.toFixed(1)+'/5':'—'}</p><p className="text-[10px] text-slate-400">{latestEvaluation?.evaluationDate||text('لا يوجد بعد','None yet')}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><CreditCard className="h-4 w-4"/>{text('حالة الاشتراك','Subscription')}</div><p className="font-black text-lg mt-1">{currentSubscription?(currentSubscription.status==='paid'?text('مدفوع','Paid'):text('مطلوب الدفع','Payment due')):'—'}</p><p className="text-[10px] text-slate-400">{currentSubscription?.endDate||''}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><FileText className="h-4 w-4"/>{text('الملفات','Documents')}</div><p className="font-black text-lg mt-1">{selectedDocuments.length}</p><p className="text-[10px] text-slate-400">{text('ملفات متاحة للحساب','available files')}</p></div>
            </div></div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-brand-600"/><h3 className="font-black">{text('الاشتراكات والمدفوعات','Subscriptions & payments')}</h3></div>
            {playerSubscriptions.map((sub) => {
              const relatedProofs = paymentProofs.filter((p) => p.subscriptionId === sub.id).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
              const proof = relatedProofs.find((p) => ['pending','needs_info','approved'].includes(p.status));
              const latestRejected = !proof ? relatedProofs.find((p) => p.status === 'rejected') : undefined;
              return <div key={sub.id} className="border-t dark:border-slate-700 pt-3 flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-bold text-sm">{planLabel(sub.planType,lang)} · {sub.amount} {text('د.ب','BHD')}</p><p className="text-xs text-slate-500" dir="ltr">{sub.startDate} — {sub.endDate}</p>{proof?.status==='needs_info'&&proof.reviewNote&&<p className="mt-1 text-xs font-bold text-amber-700">{text('ملاحظة الإدارة: ','Academy note: ')}{proof.reviewNote}</p>}{latestRejected?.reviewNote&&<p className="mt-1 text-xs font-bold text-red-700">{text('سبب عدم الاعتماد: ','Rejection reason: ')}{latestRejected.reviewNote}</p>}</div>
                <div className="flex items-center gap-2"><Badge color={sub.status==='paid'?'green':'amber'}>{sub.status==='paid'?text('مدفوع','Paid'):text('غير مدفوع','Unpaid')}</Badge>
                {proof && <Badge color={proof.status==='approved'?'green':'amber'}>{proofStatus(proof.status)}</Badge>}{proof?.status==='needs_info'&&<button onClick={()=>{setResubmittingProof(proof);setPayingSubscription(sub);setPaymentNote('')}} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold">{text('استكمال الإثبات','Resubmit proof')}</button>}
                {sub.status==='unpaid' && !proof && <button onClick={()=>{setResubmittingProof(null);setPayingSubscription(sub)}} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold">{text('دفع الاشتراك','Pay subscription')}</button>}</div>
              </div>;
            })}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-brand-600"/><div><h3 className="font-black">{text('سجل المدفوعات السابقة','Payment history')}</h3><p className="text-xs text-slate-500">{text('الاشتراكات التي اعتمدت كمدفوعة','Subscriptions approved as paid')}</p></div></div>
            {approvedPayments.length===0?<p className="text-sm text-slate-500 py-3">{text('لا توجد مدفوعات معتمدة حتى الآن.','No approved payments yet.')}</p>:approvedPayments.map(sub=><div key={sub.id} className="border-t dark:border-slate-700 pt-3 flex items-center justify-between gap-3"><div><p className="font-bold text-sm">{planLabel(sub.planType,lang)}</p><p className="text-xs text-slate-500" dir="ltr">{sub.startDate} — {sub.endDate}</p></div><div className="text-end"><p className="font-black text-brand-600">{sub.amount} {text('د.ب','BHD')}</p><Badge color="green">{text('مدفوع','Paid')}</Badge>{(()=>{const approved=paymentProofs.find(p=>p.subscriptionId===sub.id&&p.status==='approved'&&p.receiptNumber);return approved?<button onClick={()=>printReceipt(approved,sub)} className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-600"><Printer className="h-3.5 w-3.5"/>{text('الإيصال','Receipt')} SA-{String(approved.receiptNumber).padStart(6,'0')}</button>:null})()}</div></div>)}
          </div>

          {selectedDocuments.length > 0 && <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl p-5 space-y-3">
            <h3 className="font-black">{text('مستندات اللاعب','Player documents')}</h3>
            {selectedDocuments.map(d=><button key={d.id} onClick={async()=>window.open(await db.getPlayerDocumentUrl(d.filePath),'_blank','noopener,noreferrer')} className="w-full flex justify-between gap-3 border-t dark:border-slate-700 pt-3 text-sm"><span className="font-bold">{d.fileName}</span><span className="text-brand-600">{text('عرض','View')}</span></button>)}
          </div>}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2"><CalendarCheck2 className="h-5 w-5 text-brand-600"/><div><h3 className="font-black">{text('آخر سجلات الحضور','Recent attendance')}</h3><p className="text-xs text-slate-500">{text('آخر الأنشطة المسجلة للاعب','Latest recorded player sessions')}</p></div></div>
            {playerAttendance.length===0?<p className="text-sm text-slate-500 py-3">{text('لا يوجد حضور مسجل حتى الآن.','No attendance has been recorded yet.')}</p>:[...playerAttendance].sort((a,b)=>b.sessionDate.localeCompare(a.sessionDate)).slice(0,5).map(a=><div key={a.id} className="border-t dark:border-slate-700 pt-3 flex items-center justify-between gap-3"><div><p className="font-bold text-sm">{a.sessionType==='match'?text('مباراة','Match'):text('تدريب','Training')}</p><p className="text-xs text-slate-500" dir="ltr">{a.sessionDate}</p></div><Badge color={a.status==='present'?'green':a.status==='absent'?'red':'amber'}>{a.status==='present'?text('حاضر','Present'):a.status==='absent'?text('غائب','Absent'):text('متأخر','Late')}</Badge></div>)}
          </div>

          {playerEvaluations.length > 0 && <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl p-5 space-y-3"><h3 className="font-black">{tr(lang).playerEvaluations}</h3>
            {playerEvaluations.slice(0,5).map((ev)=><div key={ev.id} className="border-t dark:border-slate-700 pt-3"><div className="flex justify-between"><span className="text-xs text-slate-500">{ev.evaluationDate}</span>{ev.overallScore!=null&&<strong className="text-brand-600">{ev.overallScore.toFixed(1)}/5</strong>}</div>{ev.strengths&&<p className="text-sm mt-1">{ev.strengths}</p>}{ev.coachRecommendation&&<p className="text-xs text-blue-600 mt-1">{ev.coachRecommendation}</p>}</div>)}
          </div>}
        </section>}
      </div>}
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{text('الطلبات', 'Requests')}</p><h2 className="mt-1 text-xl font-black">{text('طلبات التسجيل', 'Registration applications')}</h2></div></div>
      {!ready && !error && <p role="status">{text('جارٍ التحميل…', 'Loading…')}</p>}
      {apps.map(app => <article key={app.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-2 shadow-sm"><div className="flex justify-between gap-3"><p className="font-bold">{app.children.map(c => c.fullName).join('، ')}</p><Badge>{statusLabel(app.status)}</Badge></div>{app.reviewNotes && <p className="text-sm text-amber-700">{app.reviewNotes}</p>}{['draft', 'needs_info'].includes(app.status) && <button className="text-brand-700 font-bold text-sm" onClick={() => setEditor(app)}>{text('استكمال الطلب', 'Continue application')}</button>}</article>)}
      <Modal open={!!payingSubscription} closeDisabled={paymentBusy} onClose={() => { if(!paymentBusy){setPayingSubscription(null);setResubmittingProof(null);} }} title={text('إثبات دفع الاشتراك','Subscription payment proof')}>
        {payingSubscription && <div className="space-y-4">
          <div className="rounded-xl bg-brand-50 dark:bg-brand-950/20 p-4"><p className="text-sm text-slate-500">{text('المبلغ المطلوب','Amount due')}</p><p className="text-2xl font-black">{payingSubscription.amount} {text('د.ب','BHD')}</p></div>
          {benefitIban ? <div className="rounded-xl border dark:border-slate-700 p-4"><p className="text-xs text-slate-500">{text('IBAN للتحويل عبر Benefit','IBAN for Benefit transfer')}</p><div className="flex items-center justify-between gap-3 mt-1"><code className="font-bold break-all" dir="ltr">{benefitIban}</code><button onClick={()=>navigator.clipboard.writeText(benefitIban || '')} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800"><Clipboard className="h-4 w-4"/></button></div>{benefitAccountName&&<p className="text-xs mt-2">{benefitAccountName}</p>}</div> : <div className="rounded-xl bg-amber-50 text-amber-800 p-4 text-sm font-bold">{text('لم تضف الإدارة رقم IBAN للدفع بعد.','The academy has not configured the payment IBAN yet.')}</div>}
          <p className="text-sm text-slate-600 dark:text-slate-300">{paymentInstructions}</p>
          <label className="block text-sm font-bold">{text('تاريخ التحويل','Transfer date')}<input type="date" value={transferDate} onChange={e=>setTransferDate(e.target.value)} className="mt-1 w-full rounded-lg border dark:border-slate-700 bg-transparent p-2"/></label>
          <label className="block text-sm font-bold">{text('صورة/إيصال التحويل','Transfer screenshot / receipt')}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setPaymentFile(e.target.files?.[0]||null)} className="mt-1 block w-full text-sm"/></label>
          <label className="block text-sm font-bold">{text('ملاحظة (اختياري)','Note (optional)')}<textarea value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} className="mt-1 w-full rounded-lg border dark:border-slate-700 bg-transparent p-2"/></label>
          <button disabled={!benefitIban || !paymentFile || paymentBusy} onClick={()=>void submitProof()} className="w-full flex justify-center items-center gap-2 rounded-xl bg-brand-600 text-white font-black py-3 disabled:opacity-50"><FileUp className="h-4 w-4"/>{paymentBusy?text('جارٍ الرفع...','Uploading...'):text('إرسال إثبات الدفع للإدارة','Send proof to academy')}</button>
          <p className="text-xs text-slate-500 flex gap-1"><CheckCircle2 className="h-4 w-4 shrink-0"/>{text('لن يعتبر الاشتراك مدفوعًا حتى تراجع الإدارة الإثبات وتعتمده.','The subscription remains unpaid until the academy reviews and approves the proof.')}</p>
        </div>}
      </Modal>
      <Modal open={editor !== null} closeDisabled={registrationBusy} onClose={() => { if (!registrationBusy) setEditor(null); }} title={text('تسجيل الأبناء', 'Children registration')} size="xl">
        {registrationBusy && <p role="status" className="mb-3 text-sm text-slate-500">{text('انتظر اكتمال الحفظ أو رفع الملفات قبل إغلاق الطلب.', 'Wait for saving or uploads to finish before closing the application.')}</p>}
        {editor && <Registration key={editor === 'new' ? 'new' : editor.id} initial={editor === 'new' ? undefined : editor} lang={lang} onSaved={refresh} onBusyChange={setRegistrationBusy} onExit={() => { if (!registrationBusy) setEditor(null); }} />}
      </Modal>
    </div>
  </main>;
}
