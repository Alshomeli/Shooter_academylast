import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, CheckCircle2, ClipboardCheck, CreditCard, FileCheck2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import type { Lang, Player, PlayerEvaluation, RegistrationApplication, Role, Subscription, Training } from '@/types';
import { fetchAllApplications } from '@/lib/registration';
import { paymentMethodLabel } from '@/lib/i18n';
import {
  cancelAIAction,
  executeAIAction,
  getAIOperationsSnapshot,
  listAIActionHistory,
  prepareAIAction,
  type AIActionHistoryItem,
  type AIOperation,
  type AIOperationsSnapshot,
  type PreparedAIAction,
} from '@/lib/ai-operations';

interface Props {
  activeRole: Role;
  lang: Lang;
  subscriptions: Subscription[];
  players: Player[];
  evaluations: PlayerEvaluation[];
  trainings: Training[];
  onCompleted: () => Promise<void>;
}

type RegistrationDecision = 'approve' | 'under_review' | 'needs_info' | 'rejected';

const inputCls =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white';

function errorText(error: unknown, ar: boolean) {
  const message = error instanceof Error ? error.message : String(error || '');
  return ar ? `تعذر إتمام العملية: ${message}` : `Unable to complete the action: ${message}`;
}

export function AIOperationsPanel({ activeRole, lang, subscriptions, players, evaluations, trainings, onCompleted }: Props) {
  const ar = lang === 'ar';
  const canPayment = activeRole === 'manager' || activeRole === 'accountant';
  const canCreateSubscription = activeRole === 'manager' || activeRole === 'accountant' || activeRole === 'receptionist';
  const canRegistration = activeRole === 'manager';
  const canAttendance = activeRole === 'manager' || activeRole === 'coach';
  const canPublishEvaluation = activeRole === 'manager' || activeRole === 'coach';

  const [apps, setApps] = useState<RegistrationApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [registrationDecision, setRegistrationDecision] = useState<RegistrationDecision>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [attendancePlayerId, setAttendancePlayerId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceType, setAttendanceType] = useState<'training' | 'match'>('training');
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | 'excused'>('present');
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [attendanceTrainingId, setAttendanceTrainingId] = useState('');
  const [selectedEvaluationId, setSelectedEvaluationId] = useState('');
  const [newSubPlayerId, setNewSubPlayerId] = useState('');
  const [newSubPlanType, setNewSubPlanType] = useState<Subscription['planType']>('monthly');
  const [newSubStartDate, setNewSubStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [prepared, setPrepared] = useState<PreparedAIAction | null>(null);
  const [history, setHistory] = useState<AIActionHistoryItem[]>([]);
  const [snapshot, setSnapshot] = useState<AIOperationsSnapshot['snapshot'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const unpaid = useMemo(() => subscriptions.filter((s) => s.status === 'unpaid'), [subscriptions]);
  const actionableApps = useMemo(
    () => apps.filter((a) => ['pending', 'under_review', 'needs_info'].includes(a.status)),
    [apps],
  );
  const draftEvaluations = useMemo(
    () => evaluations.filter((evaluation) => evaluation.status === 'draft'),
    [evaluations],
  );

  const loadApps = useCallback(async () => {
    if (!canRegistration) return;
    setLoadingApps(true);
    try {
      setApps(await fetchAllApplications());
    } catch (e) {
      setError(errorText(e, ar));
    } finally {
      setLoadingApps(false);
    }
  }, [canRegistration, ar]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await listAIActionHistory();
      setHistory(response.actions || []);
    } catch {
      // History is secondary; action controls remain usable.
    }
  }, []);

  const loadSnapshot = useCallback(async () => {
    try {
      const response = await getAIOperationsSnapshot();
      setSnapshot(response.snapshot);
    } catch {
      // The panel falls back to already-loaded app data if the read-only snapshot is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadApps();
    void loadHistory();
    void loadSnapshot();
  }, [loadApps, loadHistory, loadSnapshot]);

  const preparePayment = async () => {
    if (!selectedSubscriptionId || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      setPrepared(await prepareAIAction('record_subscription_payment', {
        subscriptionId: selectedSubscriptionId,
        paymentMethod,
      }));
    } catch (e) {
      setError(errorText(e, ar));
    } finally {
      setBusy(false);
    }
  };

  const prepareRegistration = async () => {
    if (!selectedApplicationId || busy) return;
    if ((registrationDecision === 'needs_info' || registrationDecision === 'rejected') && !reviewNotes.trim()) {
      setError(ar ? 'اكتب سبب القرار قبل تجهيز العملية.' : 'Add a reason before preparing this action.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      let operation: AIOperation = 'approve_registration';
      let params: Record<string, unknown> = { applicationId: selectedApplicationId };
      if (registrationDecision !== 'approve') {
        operation = 'review_registration';
        params = {
          applicationId: selectedApplicationId,
          status: registrationDecision,
          notes: reviewNotes.trim(),
        };
      }
      setPrepared(await prepareAIAction(operation, params));
    } catch (e) {
      setError(errorText(e, ar));
    } finally {
      setBusy(false);
    }
  };

  const prepareAttendance = async () => {
    if (!attendancePlayerId || !attendanceDate || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      setPrepared(await prepareAIAction('record_attendance', {
        playerId: attendancePlayerId,
        sessionDate: attendanceDate,
        sessionType: attendanceType,
        status: attendanceStatus,
        notes: attendanceNotes.trim(),
        trainingId: attendanceType === 'training' ? attendanceTrainingId || null : null,
      }));
    } catch (e) {
      setError(errorText(e, ar));
    } finally {
      setBusy(false);
    }
  };

  const prepareSubscriptionCreate = async () => {
    if (!newSubPlayerId || !newSubStartDate || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      setPrepared(await prepareAIAction('create_subscription', {
        playerId: newSubPlayerId,
        planType: newSubPlanType,
        startDate: newSubStartDate,
      }));
    } catch (e) {
      setError(errorText(e, ar));
    } finally {
      setBusy(false);
    }
  };

  const prepareEvaluationPublish = async () => {
    if (!selectedEvaluationId || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      setPrepared(await prepareAIAction('publish_player_evaluation', {
        evaluationId: selectedEvaluationId,
      }));
    } catch (e) {
      setError(errorText(e, ar));
    } finally {
      setBusy(false);
    }
  };

  const confirmPrepared = async () => {
    if (!prepared || busy) return;
    setBusy(true); setError('');
    try {
      await executeAIAction(prepared.requestId);
      setMessage(ar ? 'تم تنفيذ العملية وتسجيلها في سجل التدقيق.' : 'Action executed and recorded in the audit log.');
      setPrepared(null);
      await Promise.all([onCompleted(), loadApps(), loadHistory(), loadSnapshot()]);
    } catch (e) {
      setError(errorText(e, ar));
    } finally {
      setBusy(false);
    }
  };

  const cancelPrepared = async () => {
    if (!prepared || busy) return;
    setBusy(true); setError('');
    try {
      await cancelAIAction(prepared.requestId);
      setPrepared(null);
      setMessage(ar ? 'تم إلغاء العملية المجهزة بدون تغيير البيانات.' : 'Prepared action cancelled without changing data.');
      await loadHistory();
    } catch (e) {
      setError(errorText(e, ar));
    } finally {
      setBusy(false);
    }
  };

  if (!canPayment && !canCreateSubscription && !canRegistration && !canAttendance && !canPublishEvaluation) return null;

  return (
    <section className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/10 p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            {ar ? 'إجراءات إدارية آمنة' : 'Safe administrative actions'}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {ar ? 'كل تعديل يمر بمعاينة ثم تأكيد صريح قبل التنفيذ.' : 'Every mutation is previewed and requires explicit confirmation before execution.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-[10px] font-bold text-slate-400">{ar ? 'اشتراكات غير مدفوعة' : 'Unpaid subscriptions'}</p>
          <p className="mt-1 text-xl font-black text-amber-600">{canPayment ? (snapshot?.unpaidSubscriptions ?? unpaid.length) : '—'}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-[10px] font-bold text-slate-400">{ar ? 'طلبات تحتاج إجراء' : 'Applications needing action'}</p>
          <p className="mt-1 text-xl font-black text-blue-600">{canRegistration ? (snapshot?.applicationsNeedingAction ?? actionableApps.length) : '—'}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-[10px] font-bold text-slate-400">{ar ? 'تقييمات مسودة' : 'Draft evaluations'}</p>
          <p className="mt-1 text-xl font-black text-violet-600">{canPublishEvaluation ? (snapshot?.draftEvaluations ?? draftEvaluations.length) : '—'}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-[10px] font-bold text-slate-400">{ar ? 'لاعبون نشطون' : 'Active players'}</p>
          <p className="mt-1 text-xl font-black text-emerald-600">{snapshot?.activePlayers ?? players.filter((player) => player.status === 'active').length}</p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mb-4 rounded-xl border border-violet-100 dark:border-violet-900/40 bg-white/70 dark:bg-slate-900/60 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{ar ? 'آخر الإجراءات' : 'Recent actions'}</p>
            <button onClick={() => { void loadHistory(); void loadSnapshot(); }} className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
              {ar ? 'تحديث' : 'Refresh'}
            </button>
          </div>
          <div className="space-y-1.5">
            {history.slice(0, 5).map((item) => (
              <div key={item.requestId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 truncate">{item.operation}</p>
                  <p className="text-[9px] text-slate-400">{new Date(item.createdAt).toLocaleString(ar ? 'ar-BH' : 'en-BH')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${
                  item.status === 'executed'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : item.status === 'failed' || item.status === 'expired'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-bold text-red-600">{error}</div>}
      {message && <div className="mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">{message}</div>}

      {prepared ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-black text-amber-800 dark:text-amber-300">
              {ar ? 'معاينة قبل التنفيذ' : 'Preview before execution'}
            </h4>
          </div>
          <Preview action={prepared} lang={lang} players={players} />
          <p className="mt-3 text-[10px] text-amber-700/80 dark:text-amber-300/70">
            {ar ? `تنتهي صلاحية الطلب: ${new Date(prepared.expiresAt).toLocaleString('ar-BH')}` : `Expires: ${new Date(prepared.expiresAt).toLocaleString('en-BH')}`}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => void confirmPrepared()} disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {ar ? 'تأكيد وتنفيذ' : 'Confirm & execute'}
            </button>
            <button onClick={() => void cancelPrepared()} disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-2 text-xs font-black text-slate-700 dark:text-slate-200 disabled:opacity-50">
              <XCircle className="h-4 w-4" />
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {canPayment && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-black text-slate-800 dark:text-white">{ar ? 'تسجيل دفعة اشتراك' : 'Record subscription payment'}</h4>
              </div>
              <div className="space-y-3">
                <select value={selectedSubscriptionId} onChange={(e) => setSelectedSubscriptionId(e.target.value)} className={inputCls}>
                  <option value="">{ar ? 'اختر اشتراكاً غير مدفوع' : 'Select an unpaid subscription'}</option>
                  {unpaid.map((sub) => {
                    const player = players.find((p) => p.id === sub.playerId);
                    return <option key={sub.id} value={sub.id}>{player?.name || sub.playerId} — {sub.amount.toFixed(3)} BHD</option>;
                  })}
                </select>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                  {['cash', 'bank_transfer', 'benefit', 'card'].map((method) => (
                    <option key={method} value={method}>{paymentMethodLabel(method, lang)}</option>
                  ))}
                </select>
                <button onClick={() => void preparePayment()} disabled={!selectedSubscriptionId || busy}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                  {busy ? (ar ? 'جارٍ التجهيز...' : 'Preparing...') : (ar ? 'معاينة العملية' : 'Preview action')}
                </button>
              </div>
            </div>
          )}

          {canCreateSubscription && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <h4 className="text-xs font-black text-slate-800 dark:text-white">{ar ? 'إنشاء اشتراك جديد' : 'Create subscription'}</h4>
              </div>
              <div className="space-y-3">
                <select value={newSubPlayerId} onChange={(e) => setNewSubPlayerId(e.target.value)} className={inputCls}>
                  <option value="">{ar ? 'اختر اللاعب' : 'Select player'}</option>
                  {players.filter((p) => p.status === 'active').map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
                <select value={newSubPlanType} onChange={(e) => setNewSubPlanType(e.target.value as Subscription['planType'])} className={inputCls}>
                  <option value="monthly">{ar ? 'شهري' : 'Monthly'}</option>
                  <option value="quarterly">{ar ? 'ربع سنوي' : 'Quarterly'}</option>
                  <option value="semi_annual">{ar ? 'نصف سنوي' : 'Semi-annual'}</option>
                  <option value="annual">{ar ? 'سنوي' : 'Annual'}</option>
                </select>
                <input type="date" value={newSubStartDate} onChange={(e) => setNewSubStartDate(e.target.value)} className={inputCls} />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {ar ? 'السعر وتاريخ الانتهاء يحسبهما النظام من إعدادات الأكاديمية، ويبدأ الاشتراك كغير مدفوع.' : 'Price and end date are derived from academy settings; the subscription starts unpaid.'}
                </p>
                <button onClick={() => void prepareSubscriptionCreate()} disabled={!newSubPlayerId || !newSubStartDate || busy}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                  {busy ? (ar ? 'جارٍ التجهيز...' : 'Preparing...') : (ar ? 'معاينة الاشتراك' : 'Preview subscription')}
                </button>
              </div>
            </div>
          )}

          {canRegistration && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck className="h-4 w-4 text-blue-600" />
                <h4 className="text-xs font-black text-slate-800 dark:text-white">{ar ? 'إجراء على طلب تسجيل' : 'Registration action'}</h4>
              </div>
              <div className="space-y-3">
                <select value={selectedApplicationId} onChange={(e) => setSelectedApplicationId(e.target.value)} className={inputCls} disabled={loadingApps}>
                  <option value="">{loadingApps ? (ar ? 'جارٍ تحميل الطلبات...' : 'Loading applications...') : (ar ? 'اختر طلباً' : 'Select application')}</option>
                  {actionableApps.map((app) => (
                    <option key={app.id} value={app.id}>{app.parentName} — {app.status} — {app.createdAt.slice(0, 10)}</option>
                  ))}
                </select>
                <select value={registrationDecision} onChange={(e) => setRegistrationDecision(e.target.value as RegistrationDecision)} className={inputCls}>
                  <option value="approve">{ar ? 'موافقة' : 'Approve'}</option>
                  <option value="under_review">{ar ? 'قيد المراجعة' : 'Mark under review'}</option>
                  <option value="needs_info">{ar ? 'طلب معلومات إضافية' : 'Request more information'}</option>
                  <option value="rejected">{ar ? 'رفض' : 'Reject'}</option>
                </select>
                {registrationDecision !== 'approve' && (
                  <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2}
                    placeholder={ar ? 'ملاحظات المراجعة' : 'Review notes'} className={inputCls} />
                )}
                <button onClick={() => void prepareRegistration()} disabled={!selectedApplicationId || busy}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                  {busy ? (ar ? 'جارٍ التجهيز...' : 'Preparing...') : (ar ? 'معاينة العملية' : 'Preview action')}
                </button>
              </div>
            </div>
          )}

          {canAttendance && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck2 className="h-4 w-4 text-violet-600" />
                <h4 className="text-xs font-black text-slate-800 dark:text-white">{ar ? 'تسجيل حضور لاعب' : 'Record player attendance'}</h4>
              </div>
              <div className="space-y-3">
                <select value={attendancePlayerId} onChange={(e) => setAttendancePlayerId(e.target.value)} className={inputCls}>
                  <option value="">{ar ? 'اختر اللاعب' : 'Select player'}</option>
                  {players.filter((p) => p.status === 'active').map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className={inputCls} />
                  <select value={attendanceType} onChange={(e) => setAttendanceType(e.target.value as 'training' | 'match')} className={inputCls}>
                    <option value="training">{ar ? 'تدريب' : 'Training'}</option>
                    <option value="match">{ar ? 'مباراة' : 'Match'}</option>
                  </select>
                </div>
                {attendanceType === 'training' && (
                  <select
                    value={attendanceTrainingId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setAttendanceTrainingId(id);
                      const training = trainings.find((item) => item.id === id);
                      if (training) setAttendanceDate(training.sessionDate);
                    }}
                    className={inputCls}
                  >
                    <option value="">{ar ? 'بدون ربط بحصة محددة' : 'No specific training session'}</option>
                    {trainings
                      .slice()
                      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
                      .map((training) => (
                        <option key={training.id} value={training.id}>
                          {training.sessionDate} — {training.title}
                        </option>
                      ))}
                  </select>
                )}
                <select value={attendanceStatus} onChange={(e) => setAttendanceStatus(e.target.value as 'present' | 'absent' | 'excused')} className={inputCls}>
                  <option value="present">{ar ? 'حاضر' : 'Present'}</option>
                  <option value="absent">{ar ? 'غائب' : 'Absent'}</option>
                  <option value="excused">{ar ? 'غياب بعذر' : 'Excused'}</option>
                </select>
                <textarea value={attendanceNotes} onChange={(e) => setAttendanceNotes(e.target.value)} rows={2}
                  placeholder={ar ? 'ملاحظات اختيارية' : 'Optional notes'} className={inputCls} />
                <button onClick={() => void prepareAttendance()} disabled={!attendancePlayerId || !attendanceDate || busy}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                  {busy ? (ar ? 'جارٍ التجهيز...' : 'Preparing...') : (ar ? 'معاينة الحضور' : 'Preview attendance')}
                </button>
              </div>
            </div>
          )}

          {canPublishEvaluation && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck2 className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-black text-slate-800 dark:text-white">{ar ? 'نشر تقييم لاعب' : 'Publish player evaluation'}</h4>
              </div>
              <div className="space-y-3">
                <select value={selectedEvaluationId} onChange={(e) => setSelectedEvaluationId(e.target.value)} className={inputCls}>
                  <option value="">{ar ? 'اختر تقييماً مسودة' : 'Select a draft evaluation'}</option>
                  {draftEvaluations.map((evaluation) => {
                    const player = players.find((p) => p.id === evaluation.playerId);
                    return (
                      <option key={evaluation.id} value={evaluation.id}>
                        {player?.name || evaluation.playerId} — {evaluation.evaluationDate}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {ar ? 'سيتم التحقق من اكتمال الدرجات والصلاحيات قبل تجهيز النشر.' : 'Scores and permissions are validated before publishing is prepared.'}
                </p>
                <button onClick={() => void prepareEvaluationPublish()} disabled={!selectedEvaluationId || busy}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                  {busy ? (ar ? 'جارٍ التجهيز...' : 'Preparing...') : (ar ? 'معاينة النشر' : 'Preview publish')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Preview({ action, lang, players }: { action: PreparedAIAction; lang: Lang; players: Player[] }) {
  const ar = lang === 'ar';
  const p = action.preview as Record<string, unknown>;
  if (action.operation === 'record_subscription_payment') {
    const period = (p.period || {}) as Record<string, unknown>;
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
        <Item label={ar ? 'الاشتراك' : 'Subscription'} value={String(p.subscriptionId || '—')} />
        <Item label={ar ? 'المبلغ' : 'Amount'} value={`${Number(p.amount || 0).toFixed(3)} ${String(p.currency || 'BHD')}`} />
        <Item label={ar ? 'طريقة الدفع' : 'Payment method'} value={String(p.paymentMethod || '—')} />
        <Item label={ar ? 'الفترة' : 'Period'} value={`${String(period.start || '—')} → ${String(period.end || '—')}`} />
      </dl>
    );
  }
  if (action.operation === 'create_subscription') {
    const player = players.find((item) => item.id === String(p.playerId || ''));
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
        <Item label={ar ? 'اللاعب' : 'Player'} value={player?.name || String(p.playerName || p.playerId || '—')} />
        <Item label={ar ? 'الخطة' : 'Plan'} value={String(p.planType || '—')} />
        <Item label={ar ? 'المبلغ' : 'Amount'} value={`${Number(p.amount || 0).toFixed(3)} ${String(p.currency || 'BHD')}`} />
        <Item label={ar ? 'الفترة' : 'Period'} value={`${String(p.startDate || '—')} → ${String(p.endDate || '—')}`} />
        <Item label={ar ? 'الحالة بعد الإنشاء' : 'New status'} value={ar ? 'غير مدفوع' : 'Unpaid'} />
      </dl>
    );
  }
  if (action.operation === 'record_attendance') {
    const player = players.find((item) => item.id === String(p.playerId || ''));
    const statusLabel = p.attendanceStatus === 'present'
      ? (ar ? 'حاضر' : 'Present')
      : p.attendanceStatus === 'absent'
        ? (ar ? 'غائب' : 'Absent')
        : (ar ? 'غياب بعذر' : 'Excused');
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
        <Item label={ar ? 'اللاعب' : 'Player'} value={player?.name || String(p.playerName || p.playerId || '—')} />
        <Item label={ar ? 'التاريخ' : 'Date'} value={String(p.sessionDate || '—')} />
        <Item label={ar ? 'النوع' : 'Type'} value={p.sessionType === 'match' ? (ar ? 'مباراة' : 'Match') : (ar ? 'تدريب' : 'Training')} />
        <Item label={ar ? 'الحالة' : 'Status'} value={statusLabel} />
      </dl>
    );
  }
  if (action.operation === 'publish_player_evaluation') {
    const player = players.find((item) => item.id === String(p.playerId || ''));
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
        <Item label={ar ? 'اللاعب' : 'Player'} value={player?.name || String(p.playerId || '—')} />
        <Item label={ar ? 'تاريخ التقييم' : 'Evaluation date'} value={String(p.evaluationDate || '—')} />
        <Item label={ar ? 'الحالة الحالية' : 'Current status'} value={String(p.currentStatus || '—')} />
        <Item label={ar ? 'بعد التأكيد' : 'After confirmation'} value={ar ? 'منشور' : 'Published'} />
      </dl>
    );
  }
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
      <Item label={ar ? 'رقم الطلب' : 'Application'} value={String(p.applicationId || '—')} />
      <Item label={ar ? 'الحالة الحالية' : 'Current status'} value={String(p.currentStatus || '—')} />
      {p.newStatus != null && <Item label={ar ? 'الحالة الجديدة' : 'New status'} value={String(p.newStatus)} />}
      <Item label={ar ? 'نوع التسجيل' : 'Registration type'} value={String(p.registrationType || '—')} />
    </dl>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/70 dark:bg-slate-900/70 p-2.5">
      <dt className="text-[10px] font-bold text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-black break-all">{value}</dd>
    </div>
  );
}
