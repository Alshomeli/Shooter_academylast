import { EvaluationCard } from '@/components/EvaluationCard';
import { EvaluationProgressInsights } from '@/components/EvaluationProgressInsights';
import { TelegramLinkCard } from '@/components/TelegramLinkCard';
import { supabase } from '@/lib/supabase';
import { getSubscriptionReminders } from '@/lib/reminders';
import { PreplatformCoverage } from '@/components/PreplatformCoverage';
import { PublicHomeLink } from '@/components/PublicHomeLink';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clipboard, CreditCard, FileText, FileUp, Instagram, LogOut, Plus, Printer, RefreshCw, Star, UserRound, CalendarCheck2, WalletCards } from 'lucide-react';
import { Badge, Modal } from '@/components/ui';
import { errorMessage, fetchMyApplications } from '@/lib/registration';
import type { RegistrationApplication } from '@/types';
import { planLabel } from '@/lib/i18n';
import type { Attendance, CurrentUser, Lang, PaymentProof, Player, PlayerDocument, PlayerEvaluation, Settings, Subscription, Team, Training } from '@/types';
import { db } from '@/lib/store';
import { prepareFamilyReceiptIntake } from '@/lib/family-receipt-intake';
import { siblingPaymentGroups } from '@/lib/family-payment-groups';
import { familyPaymentsEnabled, getClaimedFamilySubscriptionIds } from '@/lib/family-receipt-queue';
import { submitFamilyReceiptForReview, resubmitFamilyReceiptForReview } from '@/lib/family-receipt-upload';
import { tr } from '@/lib/i18n';
import { uploadPlayerFile } from '@/lib/uploads';
import { Home, Users, Upload, Shield, Sun, Moon, Trophy } from 'lucide-react';

import { ParentActivities } from '@/components/ParentActivities';
import { readPublicContent } from '@/lib/site-content';

const Registration = lazy(() => import('@/views/Registration').then((module) => ({ default: module.Registration })));

const bahrainToday = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bahrain', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));

export function ParentPortal({ user, players, subscriptions, attendance, teams, trainings, evaluations, settings, lang, setLang, darkMode, setDarkMode, onLogout, onRefresh, openRegistration = false }: {
  openRegistration?: boolean; user: CurrentUser; players: Player[]; subscriptions: Subscription[]; attendance: Attendance[]; teams: Team[]; trainings: Training[]; evaluations: PlayerEvaluation[]; settings: Settings | null; lang: Lang;
  darkMode: boolean; setDarkMode: (darkMode: boolean) => void; setLang: (lang: Lang) => void; onLogout: () => void; onRefresh: () => Promise<void>;
}) {
  const ar = lang === 'ar';
  const academyName = settings?.name || (ar ? 'أكاديمية Shooter' : 'Shooter Academy');
  const benefitIban = settings?.benefitIban || '';
  const benefitAccountName = settings?.benefitAccountName || '';
  const paymentInstructions = ar ? (settings?.paymentInstructionsAr || '') : (settings?.paymentInstructionsEn || '');
  const text = (a: string, e: string) => ar ? a : e;
  const [apps, setApps] = useState<RegistrationApplication[]>([]);
  const [error, setError] = useState('');
  const [uploadCategory, setUploadCategory] = useState<'photo' | 'document' | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [monthlyStar, setMonthlyStar] = useState<{name:string;heading:string;body:string;image:string;playerId:string;video:string}|null>(null);
  const [monthlyStarOpen, setMonthlyStarOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    void readPublicContent().then(items => {
      if (!alive) return;
      const contact = items.find(item => item.kind === 'contact')?.payload;
      if (!contact?.featured_name?.trim() || !contact.featured_image) return;
      const video = items.find(item => item.kind === 'video' && item.id === contact.featured_video_id)?.payload.video || '';
      setMonthlyStar({
        playerId: contact.featured_player_id || '',
        video,
        name: lang === 'en' && contact.featured_name_en ? contact.featured_name_en : contact.featured_name,
        heading: (lang === 'en' && contact.featured_heading_en ? contact.featured_heading_en : contact.featured_heading) || (lang === 'ar' ? 'لاعب الشهر' : 'Player of the Month'),
        body: (lang === 'en' && contact.featured_body_en ? contact.featured_body_en : contact.featured_body) || '',
        image: contact.featured_image,
      });
    }).catch(() => { /* Featured content is optional; parent data remains usable. */ });
    return () => { alive = false; };
  }, [lang]);
  const sections = [
    { id: 'overview', ar: 'الرئيسية', en: 'Home', icon: Home },
    { id: 'children', ar: 'أبنائي', en: 'My children', icon: Users },
    { id: 'subscriptions', ar: 'الاشتراكات', en: 'Subscriptions', icon: CreditCard },
    { id: 'documents', ar: 'المستندات', en: 'Documents', icon: FileText },
    { id: 'evaluations', ar: 'التقييمات', en: 'Evaluations', icon: Star },
    { id: 'trainings', ar: 'التدريبات', en: 'Training', icon: CalendarCheck2 },
    { id: 'competitions', ar: 'المنافسات', en: 'Competitions', icon: Trophy },
    { id: 'attendance', ar: 'الحضور', en: 'Attendance', icon: CalendarCheck2 },
  ];
  const navigate = (id: string) => {
    setActiveSection(id);
    document.getElementById('parent-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [ready, setReady] = useState(false);
  const [entryNoticeDismissed, setEntryNoticeDismissed] = useState(false);
  const [noticeLoaded, setNoticeLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    setNoticeLoaded(false);
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!alive || error || data.user?.id !== user.authUserId) return;
      setEntryNoticeDismissed(Boolean(data.user.user_metadata?.parent_intro_seen_at));
      setNoticeLoaded(true);
    });
    return () => { alive = false; };
  }, [user.authUserId]);
  const dismissEntryNotice = () => {
    setEntryNoticeDismissed(true);
    // Presentation preference only; this metadata never grants access.
    void supabase.auth.updateUser({ data: { parent_intro_seen_at: new Date().toISOString() } }).then(({ error }) => {
      if (error) setError(text('تعذر حفظ إغلاق الرسالة. قد تظهر مرة أخرى عند الدخول.', 'Could not save dismissal. The message may appear again next time.'));
    });
  };
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
  const [familyReceiptOpen, setFamilyReceiptOpen] = useState(false);
  const [familyPeriod, setFamilyPeriod] = useState('');
  const [familyReceiptFile, setFamilyReceiptFile] = useState<File | null>(null);
  const [familyReceiptError, setFamilyReceiptError] = useState('');
  const [familyReceiptBusy, setFamilyReceiptBusy] = useState(false);
  const [familyClaimedIds, setFamilyClaimedIds] = useState<string[]>([]);
  const [familyCorrections,setFamilyCorrections] = useState<Array<{id:string;status:string;review_note:string|null}>>([]);
  const [correctionReceiptId,setCorrectionReceiptId] = useState('');

  const familyGroups = siblingPaymentGroups(
    subscriptions.filter(s => s.startDate <= bahrainToday()), players.map(p => p.id),
    [...paymentProofs.filter(proof => ['pending','needs_info','approved'].includes(proof.status)).map(proof => proof.subscriptionId), ...familyClaimedIds],
  );
  const selectedFamilyGroup = familyGroups.find(group => group.period === familyPeriod) || familyGroups[0];
  const familyUnpaid = selectedFamilyGroup?.subscriptions || [];
  const familyTotal = selectedFamilyGroup?.amount || 0;
  const previewFamilyReceipt = () => {
    setFamilyReceiptError('');
    if (familyUnpaid.length < 2) {
      setFamilyReceiptError(text('لا توجد اشتراكات أشقاء مؤهلة لنفس الفترة.', 'No eligible sibling subscriptions for the same period.'));
      return;
    }
    if (!familyReceiptFile || !user.authUserId) {
      setFamilyReceiptError(text('يجب تسجيل الدخول واختيار الإيصال.', 'Sign in and select a receipt.'));
      return;
    }
    try {
      prepareFamilyReceiptIntake(user.authUserId, familyUnpaid.map(sub => ({
        subscriptionId: sub.id, playerId: sub.playerId || '', parentUserId: user.authUserId!,
        amount: sub.amount, status: 'unpaid' as const,
        startDate: sub.startDate, endDate: sub.endDate,
      })), transferDate, familyReceiptFile);
    } catch (error) {
      setFamilyReceiptError(errorMessage(error, ar));
      return;
    }
    setFamilyReceiptError(familyPaymentsEnabled
      ? text('تم التحقق من بيانات الإيصال. يمكنك إرساله لمراجعة المدير، ولن تُعتمد الدفعة تلقائياً.', 'Receipt details validated. You can submit for manager review; payment is never approved automatically.')
      : text('تم التحقق من البيانات الأولية. رفع الإيصال الموحد غير مفعّل بعد؛ استخدم الدفع الفردي حالياً.', 'Details validated. Shared receipt upload is not enabled yet; use individual payments for now.'));
  };
  const correctFamilyReceipt = async () => {
    if (!familyPaymentsEnabled || !familyReceiptFile || !correctionReceiptId || familyReceiptBusy) return;
    try {
      setFamilyReceiptBusy(true);setFamilyReceiptError('');
      await resubmitFamilyReceiptForReview(correctionReceiptId,transferDate,familyReceiptFile);
      const {data,error}=await dbGetFamilyCorrections();
      if(error) throw error;
      setFamilyCorrections(data||[]);
      setFamilyReceiptOpen(false);setFamilyReceiptFile(null);setCorrectionReceiptId('');
      await onRefresh();
    } catch(e){setFamilyReceiptError(errorMessage(e,ar));}
    finally{setFamilyReceiptBusy(false);}
  };
  const dbGetFamilyCorrections = async () => {
    const {supabase}=await import('@/lib/supabase');
    return supabase.from('family_payment_receipts').select('id,status,review_note')
      .in('status',['needs_info','rejected']).order('created_at',{ascending:false});
  };
  const sendFamilyReceipt = async () => {
    if (!familyPaymentsEnabled || familyReceiptBusy) return;
    if (!familyReceiptFile || !user.authUserId || familyUnpaid.length < 2) {
      setFamilyReceiptError(text('اختر إيصالاً واشتراكات أشقاء مؤهلة.','Select a receipt and eligible sibling subscriptions.'));
      return;
    }
    const dues = familyUnpaid.map(sub => ({
      subscriptionId: sub.id, playerId: sub.playerId || '', parentUserId: user.authUserId!,
      amount: sub.amount, status: 'unpaid' as const, startDate: sub.startDate, endDate: sub.endDate,
    }));
    try {
      setFamilyReceiptBusy(true);setFamilyReceiptError('');
      await submitFamilyReceiptForReview(dues,transferDate,familyReceiptFile);
      setFamilyReceiptOpen(false);setFamilyReceiptFile(null);
      setFamilyClaimedIds(await getClaimedFamilySubscriptionIds());
      await onRefresh();
    } catch (e) {
      setFamilyReceiptError(errorMessage(e,ar));
    } finally {setFamilyReceiptBusy(false);}
  };
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) || players[0];
  const playerSubscriptions = selectedPlayer ? subscriptions.filter((s) => s.playerId === selectedPlayer.id).sort((a,b) => b.startDate.localeCompare(a.startDate)) : [];
  const playerAttendance = selectedPlayer ? attendance.filter((a) => a.playerId === selectedPlayer.id) : [];
  const playerEvaluations = selectedPlayer ? evaluations.filter((e) => e.playerId === selectedPlayer.id && e.status === 'published').sort((a,b) => b.evaluationDate.localeCompare(a.evaluationDate)) : [];
  const presentCount = playerAttendance.filter(a=>a.status==='present').length;
  const attendanceRate = playerAttendance.length ? Math.round((presentCount/playerAttendance.length)*100) : 0;
  const selectedTeam = teams.find(t => t.id === selectedPlayer?.teamId);
  const nextTraining = trainings.filter(t => t.teamId === selectedPlayer?.teamId && t.sessionDate.slice(0,10) >= bahrainToday()).sort((a,b) => a.sessionDate.localeCompare(b.sessionDate))[0];
  const latestEvaluation = playerEvaluations[0];
  const currentSubscription = playerSubscriptions.find(s=>s.status==='unpaid') || playerSubscriptions[0];
  const renewalNotices = getSubscriptionReminders(subscriptions.filter(s => players.some(p => p.id === s.playerId)), players, []).filter(r => r.subscription.status === 'paid' && r.daysUntilExpiry <= 3);
  const approvedPayments = playerSubscriptions.filter(s=>s.status==='paid');
  const entryPayment = subscriptions.find(sub =>
    sub.status === 'unpaid' && sub.startDate <= bahrainToday()
    && players.some(player => player.id === sub.playerId)
    && !familyClaimedIds.includes(sub.id)
    && !paymentProofs.some(proof => proof.subscriptionId === sub.id
      && ['pending', 'needs_info', 'approved'].includes(proof.status)),
  );
  const needsRegistrationIntro = players.length === 0
    && !apps.some(app => ['pending', 'under_review', 'needs_info', 'approved'].includes(app.status));
  const entryNoticeOpen = noticeLoaded && ready && !error && !entryNoticeDismissed
    && (needsRegistrationIntro || !!entryPayment);
  const selectedDocuments = selectedPlayer ? playerDocuments.filter(d=>d.playerId===selectedPlayer.id&&d.fileCategory!=='photo') : [];
  const load = useCallback(async () => {
    try { const [myApps, proofs, docs, claims] = await Promise.all([fetchMyApplications(), db.getPaymentProofs(), db.getPlayerDocuments(), getClaimedFamilySubscriptionIds()]); setFamilyClaimedIds(claims); if(familyPaymentsEnabled){const {data}=await dbGetFamilyCorrections();setFamilyCorrections(data||[]);} setApps(myApps); setPaymentProofs(proofs); setPlayerDocuments(docs); const photos=docs.filter(d=>d.playerId&&d.fileCategory==='photo'); const newest=photos.filter((d,i)=>photos.findIndex(p=>p.playerId===d.playerId)===i); const pairs=await Promise.all(newest.map(async d=>[d.playerId!,await db.getPlayerDocumentUrl(d.filePath)] as const)); setPhotoUrls(Object.fromEntries(pairs)); setError(''); setReady(true); }
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
  const uploadAttachment = async () => {
    if (!attachment || !uploadCategory || !selectedPlayer || attachmentBusy) return;
    if (uploadCategory === 'photo' && !['image/jpeg','image/png','image/webp'].includes(attachment.type)) {
      setAttachmentError(text('اختر صورة بصيغة JPG أو PNG أو WebP.', 'Choose a JPG, PNG or WebP image.')); return;
    }
    setAttachmentBusy(true); setAttachmentError('');
    try {
      await uploadPlayerFile(selectedPlayer.id, attachment, uploadCategory);
      setUploadCategory(null); setAttachment(null); await load();
    } catch (e) { setAttachmentError(errorMessage(e, ar)); }
    finally { setAttachmentBusy(false); }
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
  return <main id="parent-overview" className={`parent-portal parent-arena min-h-screen p-3 sm:p-6 ${darkMode ? 'dark text-slate-100' : 'arena-light text-slate-900'}`} dir={ar ? 'rtl' : 'ltr'}>
    <div className="max-w-7xl mx-auto space-y-4">
      <header className="arena-header">
        <a href="#parent-overview" className="arena-brand"><img src={settings?.logoUrl || '/1790474303638.jpg'} alt={academyName} /><span><strong>{text('أكاديمية شوتر', 'Shooter Academy')}</strong><small>SHOOTER ACADEMY</small></span></a>
        <div className="arena-account"><UserRound className="h-8 w-8"/><div><strong>{text('مرحبًا، ', 'Welcome, ')}{user.name}</strong><small>{text('ولي الأمر', 'Parent')}</small></div></div>
        <div className="arena-actions"><PublicHomeLink lang={lang} darkMode={darkMode}/><button type="button" className="arena-theme-toggle" onClick={() => setDarkMode(!darkMode)} aria-label={text('الوضع النهاري', 'Light mode')} aria-pressed={!darkMode} title={darkMode ? text('تفعيل الوضع النهاري', 'Switch to light mode') : text('تفعيل الوضع الليلي', 'Switch to dark mode')}>{darkMode ? <Sun className="h-4 w-4" aria-hidden="true"/> : <Moon className="h-4 w-4" aria-hidden="true"/>}<span>{darkMode ? text('نهاري', 'Light') : text('ليلي', 'Dark')}</span></button><button onClick={() => setLang(ar ? 'en' : 'ar')}>{ar ? 'English' : 'العربية'}</button><button onClick={() => void refresh()} aria-label={text('تحديث البيانات', 'Refresh data')}><RefreshCw className="h-4 w-4"/></button><button onClick={onLogout} aria-label={text('تسجيل الخروج','Sign out')}><LogOut className="h-4 w-4"/></button></div>
        <nav className="arena-top-nav" aria-label={text('القائمة الرئيسية لولي الأمر','Parent main navigation')}>
          {sections.map(item=><button key={item.id} aria-current={activeSection===item.id?'page':undefined} onClick={()=>navigate(item.id)} className={activeSection===item.id?'active':''}><item.icon className="h-4 w-4"/>{ar?item.ar:item.en}</button>)}
        </nav>
      </header>
      <div className="arena-hero"><img className="arena-hero-image" src={ar ? '/images/Screenshot_٢٠٢٦١٠١٨_٠٤٠٣٠٢_Chrome.jpg' : '/images/Screenshot_٢٠٢٦١٠١٨_٠٤٠٢٤٣_Chrome.jpg'} alt={text('شغف اليوم. أبطال الغد. هنا تبدأ رحلتك الكروية.', "Today's passion. Tomorrow's champions. Your football journey starts here.")} /></div>
      <nav aria-label={text('التواصل مع الأكاديمية وموقعها', 'Academy social links and location')} className="arena-social-bar">
        <a href="https://www.instagram.com/shooter.academy.bh/" target="_blank" rel="noopener noreferrer" className="arena-social-link" aria-label={text('إنستغرام الأكاديمية', 'Academy Instagram')}>
          <span className="arena-social-icon arena-social-instagram"><Instagram aria-hidden="true" /></span><span>{text('إنستغرام', 'Instagram')}</span>
        </a>
        <a href="https://wa.me/97332287776" target="_blank" rel="noopener noreferrer" className="arena-social-link" aria-label={text('واتساب الأكاديمية', 'Academy WhatsApp')}>
          <span className="arena-social-icon arena-social-whatsapp"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 1.9 17.7L.3 23.5l6-1.6A11.8 11.8 0 0 0 20.5 3.5ZM12 21.7a9.7 9.7 0 0 1-4.9-1.3l-.4-.2-3.5.9.9-3.4-.3-.5A9.8 9.8 0 1 1 12 21.7Zm5.4-7.3c-.3-.1-1.7-.8-2-.9-.2-.1-.4-.1-.6.2l-.9 1.1c-.2.2-.3.2-.6.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.4.1-.6l.6-.7.3-.5c.1-.2 0-.4 0-.5L9.4 7c-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.7 1.2 2.9c.1.2 2 3.1 4.9 4.4l1.6.6c.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3Z"/></svg></span><span>{text('واتساب', 'WhatsApp')}</span>
        </a>
        <a href="https://www.facebook.com/share/19dvUn2fcE/" target="_blank" rel="noopener noreferrer" className="arena-social-link" aria-label={text('فيسبوك الأكاديمية', 'Academy Facebook')}>
          <span className="arena-social-icon arena-social-facebook"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 22v-9h3l.5-3H14V8c0-.9.3-1.5 1.6-1.5h2V3.8c-.4-.1-1.6-.2-2.9-.2-2.8 0-4.7 1.7-4.7 4.8V10H7v3h3v9z"/></svg></span><span>{text('فيسبوك', 'Facebook')}</span>
        </a>
        <a href="https://www.tiktok.com/@shooter_academy" target="_blank" rel="noopener noreferrer" className="arena-social-link" aria-label={text('تيك توك الأكاديمية', 'Academy TikTok')}>
          <span className="arena-social-icon arena-social-tiktok"><svg viewBox="0 0 24 24" aria-hidden="true"><path className="arena-tiktok-note" d="M14 3h3a5 5 0 0 0 4 4v3a8 8 0 0 1-4-1.3V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3Z" fill="currentColor"/></svg></span><span>{text('تيك توك', 'TikTok')}</span>
        </a>
        <a href="https://snapchat.com/t/9UngPGSW" target="_blank" rel="noopener noreferrer" className="arena-social-link" aria-label={text('سناب شات الأكاديمية', 'Academy Snapchat')}>
          <span className="arena-social-icon arena-social-snapchat"><svg viewBox="0 0 24 24" fill="white" stroke="black" strokeWidth="1.15" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5c-3 0-4.6 2.2-4.6 5.1l.1 2.2c-.5.3-1.2-.3-1.7-.3-.7 0-1 .8-.3 1.2l1.8.9c-.4 2-1.8 3.7-4 4.5-.5.2-.5.7.1.9l2.1.5.5 1.5c.2.4 1.3 0 2.1.2 1.2.2 2.1 1.5 3.9 1.5s2.7-1.3 3.9-1.5c.8-.2 1.9.2 2.1-.2l.5-1.5 2.1-.5c.6-.2.6-.7.1-.9-2.2-.8-3.6-2.5-4-4.5l1.8-.9c.7-.4.4-1.2-.3-1.2-.5 0-1.2.6-1.7.3l.1-2.2c0-2.9-1.6-5.1-4.6-5.1Z"/></svg></span><span>{text('سناب شات', 'Snapchat')}</span>
        </a>
        <a href="https://maps.app.goo.gl/h7MjBm9kDBykRmkKA?g_st=ac" target="_blank" rel="noopener noreferrer" className="arena-social-link" aria-label={text('موقع الأكاديمية على خرائط Google: شارع 28، حالة النعيم 997، البحرين', 'Academy on Google Maps: Road 28, Halat Naim 997, Bahrain')} title="Road 28, Halat Naim 997, Bahrain">
          <span className="arena-social-icon arena-social-maps"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M12 2a8 8 0 0 0-8 8c0 2.6 1.5 4.8 3.2 7L12 10Z"/><path fill="#EA4335" d="M12 2a8 8 0 0 1 8 8l-8 4-4-4Z"/><path fill="#FBBC04" d="m4.3 12.1 5.1-5.2 5.2 5.2-5.9 6.8c-1.9-2.4-3.7-4.7-4.4-6.8Z"/><path fill="#34A853" d="m20 10-8 12-3.3-3.1 7-8.9Z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg></span><span>{text('الموقع', 'Location')}</span>
        </a>
      </nav>
      {monthlyStar?.playerId && players.some(player => player.id === monthlyStar.playerId) && <p role="status" className="rounded-xl border border-amber-400 bg-amber-50 p-4 font-bold text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">{text('مبروك! تم اختيار ابنكم لاعب الشهر في أكاديمية شوتر. نفتخر فيه وبجهوده.','Congratulations! Your child is Shooter Academy Player of the Month. We are proud of their dedication.')}</p>}
      {monthlyStar && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100" aria-label={text('تكريم لاعب الشهر','Player of the Month recognition')}>
        <div className="flex flex-wrap items-center gap-4">
          <img src={monthlyStar.image} alt={monthlyStar.name} loading="lazy" className="h-24 w-24 rounded-xl object-contain" />
          <div className="min-w-0 flex-1 space-y-1"><p className="text-xs font-bold">{monthlyStar.heading}</p><h2 className="text-xl font-black">{monthlyStar.name}</h2>
            <button type="button" onClick={()=>setMonthlyStarOpen(true)} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">{text('شاهد تكريم لاعب الشهر','View player recognition')}</button>
          </div>
        </div>
      </section>}
      <Modal open={monthlyStarOpen && !!monthlyStar} onClose={()=>setMonthlyStarOpen(false)} title={monthlyStar?.heading || text('لاعب الشهر','Player of the Month')}>
        {monthlyStar&&<div className="space-y-3 text-center"><img src={monthlyStar.image} alt={monthlyStar.name} className="mx-auto max-h-72 w-full object-contain"/><h3 className="text-xl font-black">{monthlyStar.name}</h3><p className="whitespace-pre-wrap">{monthlyStar.body}</p>{monthlyStar.video&&<video controls playsInline preload="metadata" className="w-full rounded-xl" src={monthlyStar.video} aria-label={text('فيديو تكريم لاعب الشهر','Player of the Month recognition video')}/>}</div>}
      </Modal>
      <TelegramLinkCard lang={lang} />
      {error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}
      {renewalNotices.map(({ subscription, player, daysUntilExpiry }) => <div key={subscription.id} role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><strong>{player?.name}</strong><p>{daysUntilExpiry < 0 ? text('انتهت فترة الاشتراك. يرجى مراجعة الإدارة للتجديد؛ الفترة السابقة مسددة.', 'The subscription has expired. Contact the academy to renew; the previous period is paid.') : text(`ينتهي الاشتراك خلال ${daysUntilExpiry} يوم. يرجى مراجعة الإدارة للتجديد.`, `Subscription expires in ${daysUntilExpiry} days. Contact the academy to renew.`)}</p></div>)}
      <div id="parent-children" className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">{text('المتابعة العائلية', 'Family overview')}</p><h2 className="mt-1 text-xl font-black">{text('أبنائي', 'My children')}</h2><p className="mt-1 text-sm text-slate-500">{players.length ? text('اختر لاعبًا لعرض الحضور والاشتراكات والتقييمات', 'Select a player to view attendance, subscriptions, and evaluations') : text('ستظهر بيانات الأبناء هنا بعد اعتماد الطلب وربط الحساب.', 'Your children will appear here after the academy approves the application and links your account.')}</p></div><button disabled={!ready} onClick={() => setEditor('new')} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 disabled:opacity-50"><Plus className="h-4 w-4" />{text('طلب تسجيل أبناء', 'Register children')}</button></div>
      {!players.length && <p className="text-slate-500">{text('ستظهر بيانات الأبناء هنا بعد اعتماد الطلب وربط الحساب.', 'Your children will appear here after the academy approves the application and links your account.')}</p>}
      {players.length > 0 && <div className="arena-player-layout">
        <aside className="arena-children space-y-3"><div className="flex items-center justify-between px-1"><span className="text-xs font-black text-slate-500">{text('اللاعبون', 'Players')}</span><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500 shadow-sm dark:bg-slate-900">{players.length}</span></div>
          {players.map((player) => <button key={player.id} onClick={() => setSelectedPlayerId(player.id)} className={`group w-full text-start rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${selectedPlayer?.id === player.id ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-900/10 dark:bg-brand-950/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
            <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-slate-800 grid place-items-center overflow-hidden">{photoUrls[player.id]?<img src={photoUrls[player.id]} alt="" className="w-full h-full object-cover"/>:<UserRound className="h-5 w-5" />}</div><div><p className="font-black">{player.name}</p><p className="text-xs text-slate-500">#{player.jerseyNumber || '—'} · {player.position || text('لم يحدد المركز','Position pending')}</p></div></div>
          </button>)}
        </aside>
        {selectedPlayer && <section className="arena-player-content">
          <div className="arena-profile overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 dark:from-brand-950/30 dark:via-slate-900 dark:to-blue-950/20"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex flex-wrap items-center gap-4"><div className="h-32 w-32 sm:h-40 sm:w-40 shrink-0 rounded-3xl border-4 border-white bg-white shadow-xl ring-2 ring-brand-200/60 dark:ring-brand-500/30 dark:border-slate-800 dark:bg-slate-800 grid place-items-center overflow-hidden">{photoUrls[selectedPlayer.id]?<img src={photoUrls[selectedPlayer.id]} alt="" className="w-full h-full object-cover"/>:<UserRound className="h-7 w-7"/>}</div><div><h2 className="text-xl sm:text-3xl font-black tracking-tight break-words">{selectedPlayer.name}</h2><p className="text-sm text-slate-500">{text('ملف اللاعب','Player profile')} · #{selectedPlayer.jerseyNumber || '—'}</p><p className="mt-1 text-xs text-slate-400">{selectedTeam?.name} · {selectedTeam?.ageGroup}</p><p className="mt-2 text-sm">{selectedPlayer.position || text('المركز لم يُحدد','Position pending')}</p><button onClick={()=>{setAttachmentError('');setAttachment(null);setUploadCategory('photo')}} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white"><Upload className="h-4 w-4"/>{text('تحميل صورة اللاعب','Upload player photo')}</button><p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{text('ولي الأمر: ', 'Guardian: ')}{user.name}</p></div></div><Badge color={selectedPlayer.status === 'active' ? 'green' : 'amber'}>{selectedPlayer.status === 'active' ? text('نشط','Active') : text('غير نشط','Inactive')}</Badge></div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><CalendarCheck2 className="h-4 w-4"/>{text('نسبة الحضور','Attendance rate')}</div><p className="font-black text-lg mt-1">{playerAttendance.length ? `${attendanceRate}%` : '—'}</p><p className="text-[10px] text-slate-400">{playerAttendance.length ? `${presentCount}/${playerAttendance.length}` : text('لا توجد بيانات بعد', 'No data yet')}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><Star className="h-4 w-4"/>{text('آخر تقييم','Latest evaluation')}</div><p className="font-black text-lg mt-1">{latestEvaluation?.overallScore!=null?latestEvaluation.overallScore.toFixed(1)+'/5':'—'}</p><p className="text-[10px] text-slate-400">{latestEvaluation?.evaluationDate||text('لا يوجد بعد','None yet')}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><CreditCard className="h-4 w-4"/>{text('حالة الاشتراك','Subscription')}</div><p className="font-black text-lg mt-1">{currentSubscription?(currentSubscription.status==='paid'?text('مدفوع','Paid'):currentSubscription.startDate>bahrainToday()?text('استحقاق قادم','Upcoming payment'):text('مطلوب الدفع','Payment due')):'—'}</p><p className="text-[10px] text-slate-400">{currentSubscription?.endDate||''}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><FileText className="h-4 w-4"/>{text('الملفات','Documents')}</div><p className="font-black text-lg mt-1">{selectedDocuments.length}</p><p className="text-[10px] text-slate-400">{text('ملفات متاحة للحساب','available files')}</p></div>
            </div></div>
          </div>

          <div className="arena-card rounded-2xl border p-5 space-y-3"><h3 className="font-black">{text('التدريب القادم','Next training')}</h3>{nextTraining ? <><p className="text-lg font-bold">{nextTraining.title}</p><p className="text-sm text-slate-300" dir="ltr">{nextTraining.sessionDate} {selectedTeam?.trainingTime || ''}</p><p className="text-sm text-slate-400">{text('الملعب: ','Pitch: ')}{selectedTeam?.pitchNumber || '—'}</p><p className="text-sm text-slate-400">{nextTraining.objectives}</p></> : <p className="text-sm text-slate-400">{text('لم يُحدد تدريب قادم بعد.','No upcoming training scheduled.')}</p>}</div>
          <div id="parent-subscriptions" className="arena-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-brand-600"/><h3 className="font-black">{text('الاشتراكات والمدفوعات','Subscriptions & payments')}</h3></div>
            {selectedPlayerId && <PreplatformCoverage key={selectedPlayerId} playerId={selectedPlayerId} lang={lang} readOnly />}
            {familyUnpaid.length > 1 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="font-bold">{text('ملخص اشتراكات الأشقاء', 'Sibling subscriptions summary')}</p>
                <p>{familyUnpaid.length} {text('اشتراكات غير مدفوعة', 'unpaid subscriptions')} · {familyTotal.toFixed(3)} BHD · {selectedFamilyGroup?.period}</p>
                {familyGroups.length > 1 && (
                  <label className="mt-2 block font-semibold">
                    {text('فترة الاشتراك', 'Billing period')}
                    <select value={selectedFamilyGroup?.period || ''} onChange={event => { setFamilyPeriod(event.target.value); setFamilyReceiptError(''); }} className="mt-1 w-full rounded-lg border border-amber-600 bg-white p-2 text-slate-900 dark:bg-slate-800 dark:text-white">
                      {familyGroups.map(group => <option key={group.period} value={group.period}>{group.period} — {group.amount.toFixed(3)} BHD</option>)}
                    </select>
                  </label>
                )}
                <button type="button" onClick={() => { setFamilyReceiptFile(null); setFamilyReceiptError(''); setFamilyReceiptOpen(true); }} className="mt-2 rounded-lg border border-amber-600 px-3 py-2 font-bold">
                  {text('معاينة إيصال موحد (تجريبي)', 'Preview shared receipt (beta)')}
                </button>
                <p className="mt-1 text-xs">{familyPaymentsEnabled ? text('الإيصال يخضع لمراجعة المدير قبل اعتماد الدفع.', 'The receipt requires manager review before payment approval.') : text('الميزة قيد التطوير ولا ترسل دفعات حالياً.', 'This feature is in development and does not submit payments.')}</p>
              </div>
            )}
            {familyPaymentsEnabled && familyCorrections.length>0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20 space-y-2">
              <p className="text-sm font-bold">{text('إيصال عائلي يحتاج تصحيحاً','Family receipt requires correction')}</p>
              {familyCorrections.map(r=><p key={r.id} className="text-xs">{r.review_note||r.status}</p>)}
              <button type="button" className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm font-bold"
                onClick={()=>{setFamilyReceiptFile(null);setCorrectionReceiptId(familyCorrections[0].id);setFamilyReceiptError('');setFamilyReceiptOpen(true);}}>
                {text('إعادة رفع الإيصال العائلي','Upload corrected family receipt')}
              </button>
            </div>}
            {playerSubscriptions.length === 0 && <p className="text-sm text-slate-400">{text('لا توجد اشتراكات بعد.', 'No subscriptions yet.')}</p>}
            {playerSubscriptions.map((sub) => {
              const relatedProofs = paymentProofs.filter((p) => p.subscriptionId === sub.id).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
              const proof = relatedProofs.find((p) => ['pending','needs_info','approved'].includes(p.status));
              const latestRejected = !proof ? relatedProofs.find((p) => p.status === 'rejected') : undefined;
              return <div key={sub.id} className="border-t dark:border-slate-700 pt-3 flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-bold text-sm">{planLabel(sub.planType,lang)} · {sub.amount} {text('د.ب','BHD')}</p><p className="text-xs text-slate-500" dir="ltr">{sub.startDate} — {sub.endDate}</p>{proof?.status==='needs_info'&&proof.reviewNote&&<p className="mt-1 text-xs font-bold text-amber-700">{text('ملاحظة الإدارة: ','Academy note: ')}{proof.reviewNote}</p>}{latestRejected?.reviewNote&&<p className="mt-1 text-xs font-bold text-red-700">{text('سبب عدم الاعتماد: ','Rejection reason: ')}{latestRejected.reviewNote}</p>}</div>
                <div className="flex items-center gap-2"><Badge color={sub.status==='paid'?'green':'amber'}>{sub.status==='paid'?text('مدفوع','Paid'):text('غير مدفوع','Unpaid')}</Badge>
                {proof && <Badge color={proof.status==='approved'?'green':'amber'}>{proofStatus(proof.status)}</Badge>}{proof?.status==='needs_info'&&<button onClick={()=>{setResubmittingProof(proof);setPayingSubscription(sub);setPaymentNote('')}} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold">{text('استكمال الإثبات','Resubmit proof')}</button>}
                {sub.status==='unpaid' && sub.startDate<=bahrainToday() && !proof && !familyClaimedIds.includes(sub.id) && <button onClick={()=>{setResubmittingProof(null);setPayingSubscription(sub)}} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold">{text('دفع الاشتراك','Pay subscription')}</button>}</div>
              </div>;
            })}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-brand-600"/><div><h3 className="font-black">{text('سجل المدفوعات السابقة','Payment history')}</h3><p className="text-xs text-slate-500">{text('الاشتراكات التي اعتمدت كمدفوعة','Subscriptions approved as paid')}</p></div></div>
            {approvedPayments.length===0?<p className="text-sm text-slate-500 py-1">{text('لا توجد مدفوعات معتمدة حتى الآن.','No approved payments yet.')}</p>:approvedPayments.map(sub=><div key={sub.id} className="border-t dark:border-slate-700 pt-3 flex items-center justify-between gap-3"><div><p className="font-bold text-sm">{planLabel(sub.planType,lang)}</p><p className="text-xs text-slate-500" dir="ltr">{sub.startDate} — {sub.endDate}</p></div><div className="text-end"><p className="font-black text-brand-600">{sub.amount} {text('د.ب','BHD')}</p><Badge color="green">{text('مدفوع','Paid')}</Badge>{(()=>{const approved=paymentProofs.find(p=>p.subscriptionId===sub.id&&p.status==='approved'&&p.receiptNumber);return approved?<button onClick={()=>printReceipt(approved,sub)} className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-600"><Printer className="h-3.5 w-3.5"/>{text('الإيصال','Receipt')} SA-{String(approved.receiptNumber).padStart(6,'0')}</button>:null})()}</div></div>)}
          </div>

          <div id="parent-documents" className="arena-card bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">{text('الصور والمستندات','Photos & documents')}</h3><button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white" onClick={()=>{setAttachmentError('');setAttachment(null);setUploadCategory('document')}}><Plus className="h-4 w-4"/>{text('إضافة مستند','Add document')}</button></div>
            <p className="text-xs text-slate-400">{text('يمكنك إضافة المرفقات بعد موافقة المدير. تظهر فقط للحسابات المخوّلة.', 'You can add attachments after approval. Only authorized accounts can view them.')}</p>
            {selectedDocuments.length===0 && <p className="text-sm text-slate-400">{text('لم تُرفع مستندات بعد.','No documents uploaded yet.')}</p>}
            {selectedDocuments.map(d=><button key={d.id} onClick={async()=>{try {const url=await db.getPlayerDocumentUrl(d.filePath);window.open(url,'_blank','noopener,noreferrer');}catch(e){setError(errorMessage(e,ar));}}} className="w-full flex justify-between gap-3 border-t dark:border-slate-700 pt-3 text-sm"><span className="font-bold break-all">{d.fileName}</span><span className="text-brand-400 shrink-0">{text('عرض','View')}</span></button>)}
          </div>

          <div id="parent-attendance" className="arena-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2"><CalendarCheck2 className="h-5 w-5 text-brand-600"/><div><h3 className="font-black">{text('آخر سجلات الحضور','Recent attendance')}</h3><p className="text-xs text-slate-500">{text('آخر الأنشطة المسجلة للاعب','Latest recorded player sessions')}</p></div></div>
            {playerAttendance.length===0?<p className="text-sm text-slate-500 py-1">{text('لا يوجد حضور مسجل حتى الآن.','No attendance has been recorded yet.')}</p>:[...playerAttendance].sort((a,b)=>b.sessionDate.localeCompare(a.sessionDate)).slice(0,5).map(a=><div key={a.id} className="border-t dark:border-slate-700 pt-3 flex items-center justify-between gap-3"><div><p className="font-bold text-sm">{a.sessionType==='match'?text('مباراة','Match'):text('تدريب','Training')}</p><p className="text-xs text-slate-500" dir="ltr">{a.sessionDate}</p></div><Badge color={a.status==='present'?'green':a.status==='absent'?'red':'amber'}>{a.status==='present'?text('حاضر','Present'):a.status==='absent'?text('غائب','Absent'):text('بعذر','Excused')}</Badge></div>)}
          </div>

          <div id="parent-evaluations" className="arena-card bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl p-5 space-y-3"><h3 className="font-black">{tr(lang).playerEvaluations}</h3>{playerEvaluations.length===0 && <p className="text-sm text-slate-400">{text('لا توجد تقييمات منشورة بعد.','No published evaluations yet.')}</p>}
            <EvaluationProgressInsights evaluations={playerEvaluations} lang={lang} compact />
            {playerEvaluations.slice(0,5).map(ev => <EvaluationCard key={ev.id} ev={ev} player={selectedPlayer || undefined} lang={lang} />)}
          </div>
        </section>}
      </div>}
      <ParentActivities lang={lang} />
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{text('الطلبات', 'Requests')}</p><h2 className="mt-1 text-xl font-black">{text('طلبات التسجيل', 'Registration applications')}</h2></div></div>
      {!ready && !error && <p role="status">{text('جارٍ التحميل…', 'Loading…')}</p>}
      {apps.map(app => <article key={app.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-2 shadow-sm"><div className="flex justify-between gap-3"><p className="font-bold">{app.children.map(c => c.fullName).join('، ')}</p><Badge>{statusLabel(app.status)}</Badge></div>{app.reviewNotes && <p className="text-sm text-amber-700">{app.reviewNotes}</p>}{['draft', 'needs_info'].includes(app.status) && <button className="text-brand-700 font-bold text-sm" onClick={() => setEditor(app)}>{text('استكمال الطلب', 'Continue application')}</button>}</article>)}
      <Modal open={!!uploadCategory} closeDisabled={attachmentBusy} onClose={()=>{if(!attachmentBusy)setUploadCategory(null)}} title={uploadCategory==='photo'?text('تحميل صورة اللاعب','Upload player photo'):text('تحميل مستند','Upload document')}>
        <div className="space-y-4"><p className="font-bold">{selectedPlayer?.name}</p>
          <p className="text-sm text-slate-400">{uploadCategory==='photo'?text('JPG، PNG، WebP. تُضغط الصور تلقائيًا.','JPG, PNG, WebP. Images are compressed automatically.'):text('PDF حتى 5 ميغابايت، أو صورة JPG، PNG، WebP.','PDF up to 5 MB, or a JPG, PNG, WebP image.')}</p>
          <label className="block text-sm font-bold">{text('اختر الملف','Choose file')}<input key={uploadCategory} type="file" disabled={attachmentBusy} accept={uploadCategory==='photo'?'image/jpeg,image/png,image/webp':'application/pdf,image/jpeg,image/png,image/webp'} onChange={e=>setAttachment(e.target.files?.[0]||null)} className="mt-3 block w-full text-sm"/></label>
          {attachmentError&&<p role="alert" className="text-sm text-red-400">{attachmentError}</p>}
          <button disabled={!attachment||attachmentBusy} onClick={()=>void uploadAttachment()} className="w-full rounded-xl bg-brand-600 px-4 py-3 font-bold text-white disabled:opacity-50">{attachmentBusy?text('جارٍ الرفع…','Uploading…'):text('رفع وحفظ','Upload & save')}</button>
          <p className="flex items-center gap-2 text-xs text-slate-400"><Shield className="h-4 w-4"/>{text('مرفق خاص مرتبط بهذا اللاعب فقط.','Private attachment linked to this player.')}</p>
        </div>
      </Modal>
      <Modal open={familyReceiptOpen} onClose={() => setFamilyReceiptOpen(false)} title={text('معاينة إيصال الأشقاء', 'Sibling receipt preview')}>
        <div className="space-y-3">
          <p className="text-sm font-bold">{familyUnpaid.length} {text('اشتراكات', 'subscriptions')} — {familyTotal.toFixed(3)} BHD</p>
          {familyUnpaid.map(sub => <p key={sub.id} className="text-xs border-b py-1">{players.find(p => p.id === sub.playerId)?.name} — {sub.amount.toFixed(3)} BHD</p>)}
          <label className="block text-sm">{text('تاريخ التحويل', 'Transfer date')}<input className="mt-1 block w-full rounded border p-2" type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}/></label>
          <label className="block text-sm">{text('صورة الإيصال أو PDF', 'Receipt image or PDF')}<input className="mt-1 block w-full" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFamilyReceiptFile(e.target.files?.[0] || null)}/></label>
          {familyReceiptError && <p role="status" className="text-xs text-amber-800 dark:text-amber-200">{familyReceiptError}</p>}
          <button type="button" onClick={previewFamilyReceipt} className="rounded-lg bg-brand-600 px-4 py-2 font-bold text-white">{text('فحص البيانات دون إرسال', 'Validate without submitting')}</button>
          {familyPaymentsEnabled && familyCorrections.length>0 && <div className="space-y-2">
            <label className="block text-sm font-bold">{text('إعادة إرسال إيصال يحتاج مراجعة','Resubmit a reviewed receipt')}</label>
            <select className="w-full rounded-lg border p-2 bg-transparent" value={correctionReceiptId} onChange={e=>setCorrectionReceiptId(e.target.value)}>
              <option value="">{text('اختر الإيصال السابق','Select existing receipt')}</option>
              {familyCorrections.map(r=><option key={r.id} value={r.id}>{r.status} — {r.review_note||r.id}</option>)}
            </select>
            <button type="button" disabled={familyReceiptBusy||!familyReceiptFile||!correctionReceiptId}
              onClick={()=>void correctFamilyReceipt()} className="rounded-lg bg-brand-600 px-4 py-2 text-white font-bold disabled:opacity-50">
              {text('إعادة إرسال الإيصال للتصحيح','Resubmit receipt correction')}
            </button>
          </div>}
          {familyPaymentsEnabled ? <button type="button" disabled={familyReceiptBusy || !familyReceiptFile} onClick={()=>void sendFamilyReceipt()} className="rounded-lg bg-brand-600 px-4 py-2 text-white font-bold disabled:opacity-50">{familyReceiptBusy?text('جارٍ إرسال الطلب','Submitting request'):text('إرسال الإيصال لمراجعة المدير','Submit receipt for manager review')}</button> : <p className="text-xs text-slate-500">{text('لن يُرفع ملف أو تُنشأ معاملة مالية من هذه المعاينة.', 'This preview neither uploads files nor creates financial transactions.')}</p>}
        </div>
      </Modal>
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
      <section aria-label={text('معلومات الأكاديمية والسياسات', 'Academy information and policies')} className="rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <h2 className="font-black text-base">{text('معلومات مهمة لأولياء الأمور', 'Important information for guardians')}</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{text('تُدفع رسوم الاشتراك مقدمًا. إرسال إثبات التحويل لا يعني اعتماد الدفع؛ يتم اعتماد الاشتراك بعد مراجعة الإدارة للإثبات.', 'Subscription fees are paid in advance. Uploading a transfer receipt does not confirm payment; the academy must review and approve it.')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer font-bold">{text('الخصوصية وحماية البيانات', 'Privacy and data protection')}</summary><p className="mt-2 text-slate-600 dark:text-slate-300">{text('تُستخدم بيانات ولي الأمر واللاعب لإدارة التسجيل والتدريب والحضور والتقييمات والاشتراكات والتواصل المرتبط بالأكاديمية. لا تُعرض ملفات اللاعبين إلا للحسابات المخولة وفق صلاحيات النظام. للاستفسار عن البيانات أو طلب تصحيحها، تواصل مع الأكاديمية.', 'Guardian and player information is used for registration, training, attendance, evaluations, subscriptions, and academy communications. Player records are available only to authorized accounts under system permissions. Contact the academy with data questions or correction requests.')}</p></details>
          <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer font-bold">{text('الشروط والأحكام', 'Terms and conditions')}</summary><p className="mt-2 text-slate-600 dark:text-slate-300">{text('يجب تقديم معلومات تسجيل صحيحة. تخضع طلبات التسجيل واعتماد الدفعات لمراجعة الإدارة. تُحدد تفاصيل الاشتراك ومواعيده في سجل الاشتراك الخاص باللاعب. تُراجع طلبات الإلغاء أو الاسترداد مع إدارة الأكاديمية وفق الشروط المعلنة عند الاشتراك.', 'Registration details must be accurate. Applications and payment approvals are subject to academy review. Plan dates and amounts are shown in the player subscription record. Cancellation and refund requests are reviewed by academy management under the terms disclosed at enrollment.')}</p></details>
        </div>
        <nav className="mt-3 flex flex-wrap gap-4 text-xs font-bold"><a className="text-brand-700 underline dark:text-brand-400" href="/privacy" target="_blank" rel="noopener noreferrer">{text('سياسة الخصوصية كاملة', 'Full privacy policy')}</a><a className="text-brand-700 underline dark:text-brand-400" href="/terms" target="_blank" rel="noopener noreferrer">{text('الشروط والأحكام كاملة', 'Full terms and conditions')}</a></nav>
        <p className="mt-4 text-xs text-slate-500">{text('للتواصل: shooter.academy.bh@gmail.com · +973 3228 7776', 'Contact: shooter.academy.bh@gmail.com · +973 3228 7776')}</p>
      </section>
      <Modal open={entryNoticeOpen} onClose={dismissEntryNotice} title={text('خطوتك التالية', 'Your next step')}>
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <strong className="block text-base">{entryPayment
              ? text('الاشتراك المطلوب دفعه', 'Subscription awaiting payment')
              : text('رسوم الاشتراك الشهري: 25 د.ب لكل لاعب', 'Monthly subscription: BHD 25 per player')}</strong>
            {entryPayment ? <>
              <p className="mt-2 font-bold">{players.find(player => player.id === entryPayment.playerId)?.name} · {entryPayment.amount.toFixed(3)} {text('د.ب', 'BHD')}</p>
              <p className="mt-2">{text('أرسل إثبات التحويل ليتمكن المدير من مراجعته واعتماد الدفع. رفع الإيصال وحده لا يعني اعتماد الاشتراك.', 'Submit your transfer receipt for the manager to review and approve payment. Uploading a receipt alone does not confirm the subscription.')}</p>
            </> : <p className="mt-2">{text('يراجع المدير التسجيل ويحدد أي خصم، ثم يصلك المبلغ النهائي قبل الدفع. لا تدفع قبل استلام الموافقة.', 'The manager reviews your application and may approve a discount. You will receive the final amount before payment. Do not pay until approval.')}</p>}
          </div>
          <button type="button" onClick={() => {
            dismissEntryNotice();
            if (entryPayment) {
              setEditor(null);
              setSelectedPlayerId(entryPayment.playerId);
              setResubmittingProof(null);
              setPayingSubscription(entryPayment);
            } else setEditor('new');
          }} className="w-full rounded-xl bg-brand-600 px-4 py-3 font-black text-white">{entryPayment ? text('عرض تفاصيل الدفع', 'View payment details') : text('متابعة تسجيل الأبناء', 'Continue children registration')}</button>
          <button type="button" onClick={dismissEntryNotice} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-bold dark:border-slate-600">{text('لاحقًا', 'Later')}</button>
        </div>
      </Modal>
      <Modal open={editor !== null && !entryNoticeOpen} closeDisabled={registrationBusy} onClose={() => { if (!registrationBusy) setEditor(null); }} title={text('تسجيل الأبناء', 'Children registration')} size="xl">
        {registrationBusy && <p role="status" className="mb-3 text-sm text-slate-500">{text('انتظر اكتمال الحفظ أو رفع الملفات قبل إغلاق الطلب.', 'Wait for saving or uploads to finish before closing the application.')}</p>}
        {editor && <Suspense fallback={<p role="status" className="text-sm text-slate-500">{text('جارٍ تحميل نموذج التسجيل…', 'Loading registration form…')}</p>}>
          <Registration key={editor === 'new' ? 'new' : editor.id} initial={editor === 'new' ? undefined : editor} lang={lang} onSaved={refresh} onBusyChange={setRegistrationBusy} onExit={() => { if (!registrationBusy) setEditor(null); }} />
        </Suspense>}
      </Modal>
      <nav className="arena-bottom-nav" aria-label={text('التنقل السريع','Quick navigation')}>{sections.filter(x=>!['attendance','trainings','competitions'].includes(x.id)).map(item=><button key={item.id} onClick={()=>navigate(item.id)} aria-current={activeSection===item.id?'page':undefined}><item.icon className="h-5 w-5"/><span>{ar?item.ar:item.en}</span></button>)}</nav>
    </div>
  </main>;
}



