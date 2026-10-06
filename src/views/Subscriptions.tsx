import { getLifecycleStatus, type LifecycleStatus } from '@/lib/report-dates';
import { calcEndDate } from '@/lib/subscription-dates';
import { errorMessage } from '@/lib/registration';
import { useEffect, useState, useMemo, useDeferredValue, type FormEvent } from 'react';
import {
  Wallet, Plus, Search, CheckCircle, Clock, TrendingUp, TrendingDown,
  Receipt, DollarSign, Calendar, Edit2, Trash2, Bell, AlertCircle, Loader2,
} from 'lucide-react';
import type { Subscription, Player, Parent, Transaction, Staff, Settings, Lang, Role, PaymentProof } from '@/types';
import { db } from '@/lib/store';
import { Badge, Modal, ConfirmDialog, PageHeader, EmptyState, StatCard, FormField, FormError, SaveButton, inputCls } from '@/components/ui';
import { RemindersPanel } from '@/components/RemindersPanel';
import { PaymentReceipt } from '@/components/PaymentReceipt';
import { reminderStats, getSubscriptionReminders } from '@/lib/reminders';
import { tr, planLabel, categoryLabel, paymentMethodLabel } from '@/lib/i18n';

interface SubscriptionsProps {
  subscriptions: Subscription[];
  transactions: Transaction[];
  players: Player[];
  parents: Parent[];
  staff: Staff[];
  settings: Settings | null;
  onPayment: (sub: Subscription, method: string) => Promise<void>;
  onSubscriptionsChange: (s: Subscription[]) => Promise<void>;
  onTransactionsChange: (t: Transaction[]) => void;
  onRefresh: () => Promise<void>;
  activeRole: Role;
  lang: Lang;
}

/* ----------------------------- Constants ----------------------------- */

const DEFAULT_PLAN_AMOUNTS: Record<Subscription['planType'], number> = {
  monthly: 35,
  quarterly: 90,
  annual: 320,
  semi_annual: 180,
};

function getPlanAmounts(settings: Settings | null): Record<Subscription['planType'], number> {
  if (!settings) return DEFAULT_PLAN_AMOUNTS;
  return {
    monthly: settings.subscriptionFeeMonthly ?? DEFAULT_PLAN_AMOUNTS.monthly,
    quarterly: settings.subscriptionFeeQuarterly ?? DEFAULT_PLAN_AMOUNTS.quarterly,
    annual: settings.subscriptionFeeYearly ?? DEFAULT_PLAN_AMOUNTS.annual,
    semi_annual: settings.subscriptionFeeSemiAnnual ?? DEFAULT_PLAN_AMOUNTS.semi_annual,
  };
}

const PLAN_COLORS: Record<Subscription['planType'], 'blue' | 'amber' | 'emerald'> = {
  monthly: 'blue',
  quarterly: 'amber',
  annual: 'emerald',
  semi_annual: 'blue',
};

const CATEGORY_COLORS: Record<string, 'emerald' | 'blue' | 'amber' | 'slate'> = {
  subscription: 'emerald',
  salary: 'blue',
  equipment: 'amber',
  rent: 'slate',
  other: 'slate',
};

const todayISO = () => new Date().toISOString().substring(0, 10);

const LIFECYCLE_BADGE: Record<LifecycleStatus, { color: 'emerald' | 'amber' | 'red' | 'blue'; key: 'subActive' | 'subExpiring' | 'subExpired' | 'subFuture' }> = {
  active:   { color: 'emerald', key: 'subActive' },
  expiring: { color: 'amber',   key: 'subExpiring' },
  expired:  { color: 'red',     key: 'subExpired' },
  future:   { color: 'blue',    key: 'subFuture' },
};


/* ----------------------------- Main ----------------------------- */

export function Subscriptions({
  subscriptions,
  transactions,
  players,
  parents,
  staff,
  settings,
  onSubscriptionsChange,
  onTransactionsChange,
  onPayment,
  onRefresh,
  activeRole,
  lang,
}: SubscriptionsProps) {
  const planAmounts = getPlanAmounts(settings);
  const t = tr(lang);
  const isAr = lang === 'ar';
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'transactions' | 'reminders' | 'proofs'>('subscriptions');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddSub, setShowAddSub] = useState(false);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [showAddTrans, setShowAddTrans] = useState(false);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);
  const [deleteTransId, setDeleteTransId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [receiptSub, setReceiptSub] = useState<Subscription | null>(null);
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [proofBusy, setProofBusy] = useState<string | null>(null);
  const [proofError, setProofError] = useState('');
  const [proofReview, setProofReview] = useState<PaymentProof | null>(null);
  const [proofReviewNote, setProofReviewNote] = useState('');
  const [proofReviewStatus, setProofReviewStatus] = useState<'rejected' | 'needs_info'>('needs_info');

  const [paymentTarget, setPaymentTarget] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentError, setPaymentError] = useState('');
  const canPay = activeRole === 'manager' || activeRole === 'accountant';
  const canSeeFinance = activeRole === 'manager' || activeRole === 'accountant';
  const isManager = activeRole === 'manager';
  const canManage = activeRole === 'manager' || activeRole === 'accountant' || activeRole === 'receptionist';
  useEffect(() => {
    if (!canSeeFinance) return;
    db.getPaymentProofs().then(setPaymentProofs).catch((e) => setProofError(errorMessage(e, isAr)));
  }, [canSeeFinance, subscriptions.length]);

  const refreshProofs = async () => setPaymentProofs(await db.getPaymentProofs());
  const approveProof = async (proof: PaymentProof) => {
    try { setProofBusy(proof.id); setProofError(''); await db.approvePaymentProof(proof.id); await Promise.all([refreshProofs(), onRefresh()]); }
    catch (e) { setProofError(errorMessage(e, isAr)); }
    finally { setProofBusy(null); }
  };
  const openProof = async (proof: PaymentProof) => {
    try { const url = await db.getPaymentProofUrl(proof.proofPath); window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (e) { setProofError(errorMessage(e, isAr)); }
  };
  const submitProofReview = async () => {
    if (!proofReview || !proofReviewNote.trim()) return;
    try { setProofBusy(proofReview.id); await db.reviewPaymentProof(proofReview.id, proofReviewStatus, proofReviewNote); setProofReview(null); setProofReviewNote(''); await Promise.all([refreshProofs(), onRefresh()]); }
    catch (e) { setProofError(errorMessage(e, isAr)); }
    finally { setProofBusy(null); }
  };
  const recorderName = staff.find((s) => s.role === activeRole)?.name || (isAr ? 'النظام' : 'System');

  const STATUS_FILTERS = useMemo(() => [
    { value: 'all', label: t.all },
    { value: 'paid', label: t.paid },
    { value: 'unpaid', label: t.unpaid },
  ], [t]);

  /* ---- KPIs ---- */
  const totalRevenue = useMemo(
    () => transactions.filter((tx) => tx.type === 'revenue').reduce((sum, tx) => sum + tx.amount, 0),
    [transactions],
  );
  const totalExpenses = useMemo(
    () => transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0),
    [transactions],
  );
  const netProfit = totalRevenue - totalExpenses;
  const paidCount = subscriptions.filter((s) => s.status === 'paid').length;
  const netProfitColor: string = netProfit >= 0 ? 'emerald' : 'red';

  /* ---- Filtered subscriptions ---- */
  const filteredSubs = useMemo(() => {
    return subscriptions.filter((sub) => {
      const player = players.find((p) => p.id === sub.playerId);
      if (deferredSearch) {
        const q = deferredSearch.toLowerCase();
        if (!player?.name.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      return true;
    });
  }, [subscriptions, players, deferredSearch, statusFilter]);

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)),
    [transactions],
  );

  const playerOf = (id: string) => players.find((p) => p.id === id);

  /* ---- Handlers ---- */
  const handleMarkPaid = async () => {
    if (!paymentTarget || markingPaidId) return;
    setMarkingPaidId(paymentTarget.id); setPaymentError('');
    try { await onPayment(paymentTarget, paymentMethod); setPaymentTarget(null); }
    catch (error) { setPaymentError(errorMessage(error, isAr)); }
    finally { setMarkingPaidId(null); }
  };

  const handleSaveSub = async (data: Omit<Subscription, 'id'>, id?: string) => {
    if (id) {
      await onSubscriptionsChange(subscriptions.map((s) => (s.id === id ? { ...data, id } : s)));
    } else {
      await onSubscriptionsChange([...subscriptions, { ...data, id: `sub-${Date.now()}` }]);
    }
    setShowAddSub(false);
    setEditSub(null);
  };

  const handleDeleteSub = async () => {
    if (deleteSubId) await onSubscriptionsChange(subscriptions.filter((s) => s.id !== deleteSubId));
    setDeleteSubId(null);
  };

  const handleSaveTrans = async (data: Omit<Transaction, 'id'>) => {
    await onTransactionsChange([{ ...data, id: `txn-${Date.now()}` }, ...transactions]);
    setShowAddTrans(false);
  };

  const handleDeleteTrans = async () => {
    if (deleteTransId) await onTransactionsChange(transactions.filter((tx) => tx.id !== deleteTransId));
    setDeleteTransId(null);
  };

  const addLabel = activeTab === 'subscriptions' ? t.addSubscription : t.addTransaction;

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t.subscriptions}
        subtitle={isAr
          ? (canSeeFinance ? `${subscriptions.length} اشتراك · ${transactions.length} معاملة مالية` : `${subscriptions.length} اشتراك`)
          : (canSeeFinance ? `${subscriptions.length} subscriptions · ${transactions.length} transactions` : `${subscriptions.length} subscriptions`)}
      >
        {((activeTab === 'subscriptions' && canManage) || (activeTab === 'transactions' && canPay)) && (
          <button
            onClick={() => (activeTab === 'subscriptions' ? setShowAddSub(true) : setShowAddTrans(true))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        )}
      </PageHeader>

      {/* ---------------- KPIs ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {canSeeFinance && <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label={t.totalRevenue}
          value={`${totalRevenue.toLocaleString()} ${t.currency}`}
          color="emerald"
          sublabel={t.financialInput}
        />}
        {canSeeFinance && <StatCard
          icon={<Receipt className="h-5 w-5" />}
          label={t.totalExpenses}
          value={`${totalExpenses.toLocaleString()} ${t.currency}`}
          color="red"
          sublabel={t.operatingExpenses}
        />}
        {canSeeFinance && <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label={t.netProfit}
          value={`${netProfit >= 0 ? '+' : '−'}${Math.abs(netProfit).toLocaleString()} ${t.currency}`}
          color={netProfitColor}
          sublabel={netProfit >= 0 ? t.netProfitPositive : t.netProfitNegative}
        />}
        <StatCard
          icon={<CheckCircle className="h-5 w-5" />}
          label={t.paidSubscriptions}
          value={paidCount}
          color="blue"
          sublabel={`${t.ofTotal} ${subscriptions.length}`}
        />
      </div>

      {/* ---------------- Tabs ---------------- */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
            activeTab === 'subscriptions'
              ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4" />
          {t.subscriptionsTab}
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {subscriptions.length}
          </span>
        </button>
        {canSeeFinance && <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Receipt className="h-4 w-4" />
          {t.transactionsTab}
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {transactions.length}
          </span>
        </button>}
        {canSeeFinance && <button onClick={() => setActiveTab('proofs')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${activeTab === 'proofs' ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
          <Receipt className="h-4 w-4" />{isAr ? 'إثباتات الدفع' : 'Payment proofs'}<span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700">{paymentProofs.filter(p=>p.status==='pending').length}</span>
        </button>}
        <button
          onClick={() => setActiveTab('reminders')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
            activeTab === 'reminders'
              ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="h-4 w-4" />
          {t.remindersTab}
        </button>
      </div>

      {/* ---------------- Subscriptions Tab ---------------- */}
      {activeTab === 'subscriptions' && (
        <>
          {/* Search + status filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-56">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlayer}
                className="w-full bg-white dark:bg-slate-900 text-sm py-2.5 pr-10 pl-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FILTERS.map((sf) => (
                <button
                  key={sf.value}
                  onClick={() => setStatusFilter(sf.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    statusFilter === sf.value
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {filteredSubs.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-8 w-8" />}
              title={t.noMatchingSubs}
              subtitle={t.noMatchingSubsHint}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredSubs.map((sub) => {
                const player = playerOf(sub.playerId);
                const isPaid = sub.status === 'paid';
                return (
                  <div
                    key={sub.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                      {/* Player */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-40">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-900/30 dark:to-brand-900/10 flex items-center justify-center text-sm font-black text-brand-600 dark:text-brand-400 shrink-0">
                          {(player?.name || '?').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {player?.name || t.unknownPlayer}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge color={PLAN_COLORS[sub.planType]}>{planLabel(sub.planType, lang)}</Badge>
                          </div>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="min-w-28">
                        <p className="text-[11px] font-bold text-slate-400 mb-0.5 lg:hidden">{t.amount}</p>
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {sub.amount.toLocaleString()}{' '}
                          <span className="text-xs font-bold text-slate-400">{t.currency}</span>
                        </p>
                      </div>

                      {/* Dates */}
                      <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 min-w-48">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span dir="ltr">{sub.startDate}</span>
                        </div>
                        <span className="text-slate-300 dark:text-slate-600">→</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span dir="ltr">{sub.endDate}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="min-w-24 flex flex-wrap gap-1.5">
                        <Badge color={isPaid ? 'emerald' : 'amber'}>
                          {isPaid ? (
                            <>
                              <CheckCircle className="h-3 w-3" /> {t.paid}
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" /> {t.unpaid}
                            </>
                          )}
                        </Badge>
                        {(() => { const lc = getLifecycleStatus(sub); const cfg = LIFECYCLE_BADGE[lc]; return <Badge color={cfg.color}>{t[cfg.key]}</Badge>; })()}
                      </div>

                      {/* Payment method */}
                      <div className="hidden lg:block min-w-24 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {sub.paymentMethod ? paymentMethodLabel(sub.paymentMethod, lang) : '—'}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 ms-auto">
                        {isPaid && (
                          <button onClick={() => setReceiptSub(sub)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 transition cursor-pointer">
                            <Receipt className="h-3.5 w-3.5" /> {isAr ? 'إيصال' : 'Receipt'}
                          </button>
                        )}
                        {!isPaid && canPay && (
                          <button
                            onClick={() => { setPaymentTarget(sub); setPaymentError(''); setPaymentMethod('cash'); }}
                            disabled={markingPaidId === sub.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {markingPaidId === sub.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}{' '}
                            {markingPaidId === sub.id ? t.processing : t.confirmPayment}
                          </button>
                        )}
                        {isManager && !isPaid && (
                          <>
                            <button
                              onClick={() => setEditSub(sub)}
                              className="flex items-center justify-center p-1.5 rounded-lg text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition cursor-pointer"
                              title={t.edit}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteSubId(sub.id)}
                              className="flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer"
                              title={t.delete}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mobile-only dates */}
                    <div className="flex md:hidden items-center gap-2 text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span dir="ltr">{sub.startDate}</span>
                      </div>
                      <span className="text-slate-300 dark:text-slate-600">→</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span dir="ltr">{sub.endDate}</span>
                      </div>
                      <span className="ms-auto font-semibold">
                        {sub.paymentMethod ? paymentMethodLabel(sub.paymentMethod, lang) : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'proofs' && canSeeFinance && <div className="space-y-3">
        {proofError && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{proofError}</p>}
        {paymentProofs.length===0 ? <EmptyState icon={<Receipt className="h-8 w-8"/>} title={isAr?'لا توجد إثباتات دفع':'No payment proofs'} subtitle={isAr?'ستظهر طلبات أولياء الأمور هنا بعد رفع إيصال التحويل.':'Parent transfer proofs will appear here after upload.'}/> :
        paymentProofs.map((proof)=>{
          const player=playerOf(proof.playerId);
          return <div key={proof.id} className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-48"><p className="font-black">{player?.name || t.unknownPlayer}</p><p className="text-xs text-slate-500">{proof.amount} {t.currency} · {proof.transferDate}</p>{proof.receiptNumber&&<p className="text-xs font-black text-brand-600 mt-1">{isAr?'رقم الإيصال':'Receipt'}: SA-{String(proof.receiptNumber).padStart(6,'0')}</p>}{proof.parentNote&&<p className="text-xs mt-1">{proof.parentNote}</p>}{proof.reviewedAt&&<p className="text-[10px] text-slate-400 mt-1">{isAr?'تمت المراجعة':'Reviewed'}: {new Date(proof.reviewedAt).toLocaleString(isAr?'ar-BH':'en-BH')}</p>}</div>
            <Badge color={proof.status==='approved'?'emerald':proof.status==='rejected'?'red':'amber'}>{proof.status==='pending'?(isAr?'بانتظار المراجعة':'Pending review'):proof.status==='approved'?(isAr?'معتمد':'Approved'):proof.status==='needs_info'?(isAr?'يحتاج استكمال':'Needs info'):(isAr?'مرفوض':'Rejected')}</Badge>
            <button onClick={()=>void openProof(proof)} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">{isAr?'عرض الإثبات':'View proof'}</button>
            {proof.status==='pending'&&<><button disabled={proofBusy===proof.id} onClick={()=>void approveProof(proof)} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold disabled:opacity-50">{isAr?'اعتماد':'Approve'}</button><button onClick={()=>{setProofReview(proof);setProofReviewStatus('needs_info');setProofReviewNote('')}} className="px-3 py-2 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">{isAr?'مراجعة':'Review'}</button></>}
            {proof.reviewNote&&<p className="w-full text-xs text-slate-500">{proof.reviewNote}</p>}
          </div>;
        })}
      </div>}

      {/* ---------------- Transactions Tab ---------------- */}
      {activeTab === 'transactions' && (
        <>
          {sortedTransactions.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-8 w-8" />}
              title={t.noTransactions}
              subtitle={t.noTransactionsHint}
            />
          ) : (
            <div className="space-y-2.5">
              {sortedTransactions.map((tx) => {
                const isRevenue = tx.type === 'revenue';
                return (
                  <div
                    key={tx.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      {/* Type icon */}
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          isRevenue
                            ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isRevenue ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      </div>

                      {/* Description + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge color={CATEGORY_COLORS[tx.category] || 'slate'}>
                            {categoryLabel(tx.category, lang)}
                          </Badge>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span dir="ltr">{tx.transactionDate}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1">
                            · {tx.recordedBy}
                          </span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div
                        className={`text-sm font-black shrink-0 ${
                          isRevenue ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isRevenue ? '+' : '−'}
                        {tx.amount.toLocaleString()}{' '}
                        <span className="text-xs font-bold opacity-70">{t.currency}</span>
                      </div>

                      {/* Delete */}
                      {isManager && !tx.subscriptionId && (
                        <button
                          onClick={() => setDeleteTransId(tx.id)}
                          className="flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer shrink-0"
                          title={t.delete}
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
        </>
      )}

      {/* ---------------- Reminders & Analytics Tab ---------------- */}
      {activeTab === 'reminders' && (
        <RemindersAnalyticsTab subscriptions={subscriptions} players={players} parents={parents} lang={lang} />
      )}

      <Modal open={!!proofReview} onClose={()=>setProofReview(null)} title={isAr?'مراجعة إثبات الدفع':'Review payment proof'}>
        <div className="space-y-4">
          <select value={proofReviewStatus} onChange={e=>setProofReviewStatus(e.target.value as 'rejected'|'needs_info')} className={inputCls}><option value="needs_info">{isAr?'يحتاج استكمال':'Needs more information'}</option><option value="rejected">{isAr?'رفض':'Reject'}</option></select>
          <textarea value={proofReviewNote} onChange={e=>setProofReviewNote(e.target.value)} className={inputCls} rows={4} placeholder={isAr?'سبب المراجعة مطلوب':'Review reason is required'}/>
          <button disabled={!proofReviewNote.trim() || !!proofBusy} onClick={()=>void submitProofReview()} className="w-full rounded-xl bg-amber-600 text-white py-2.5 font-bold disabled:opacity-50">{isAr?'حفظ القرار':'Save decision'}</button>
        </div>
      </Modal>
      <Modal open={!!paymentTarget} onClose={() => { if (!markingPaidId) setPaymentTarget(null); }} title={t.confirmPayment}>
        <div className="space-y-4">
          {paymentError && <p role="alert" className="text-sm text-red-600">{paymentError}</p>}
          <p>{paymentTarget && playerOf(paymentTarget.playerId)?.name} · {paymentTarget?.amount} {t.currency}</p>
          <FormField label={t.paymentMethod}><select className={inputCls} value={paymentMethod} disabled={!!markingPaidId} onChange={e => setPaymentMethod(e.target.value)}>
            {['cash', 'bank_transfer', 'benefit', 'card'].map(method => <option key={method} value={method}>{paymentMethodLabel(method, lang)}</option>)}
          </select></FormField>
          <button className="bg-brand-600 text-white rounded-lg py-2 px-4 disabled:opacity-50" disabled={!!markingPaidId} onClick={() => void handleMarkPaid()}>{markingPaidId ? t.processing : t.confirmPayment}</button>
        </div>
      </Modal>
      {receiptSub && <PaymentReceipt subscription={receiptSub} transactions={transactions} players={players} parents={parents} settings={settings} lang={lang} officialReceiptNumber={paymentProofs.find((proof) => proof.subscriptionId === receiptSub.id && proof.status === 'approved')?.receiptNumber} onClose={() => setReceiptSub(null)} />}

      {/* ---------------- Modals ---------------- */}
      {(showAddSub || editSub) && (
        <SubscriptionForm
          subscription={editSub}
          players={players}
          planAmounts={planAmounts}
          lang={lang}
          onSave={handleSaveSub}
          onClose={() => {
            setShowAddSub(false);
            setEditSub(null);
          }}
        />
      )}

      {showAddTrans && (
        <TransactionForm
          staff={staff}
          activeRole={activeRole}
          lang={lang}
          recorderName={recorderName}
          onSave={handleSaveTrans}
          onClose={() => setShowAddTrans(false)}
        />
      )}

      {/* ---------------- Delete confirmations ---------------- */}
      <ConfirmDialog
        open={!!deleteSubId}
        onClose={() => setDeleteSubId(null)}
        onConfirm={handleDeleteSub}
        title={t.deleteSubscription}
        message={t.deleteSubscriptionConfirm}
        confirmLabel={t.delete}
      />
      <ConfirmDialog
        open={!!deleteTransId}
        onClose={() => setDeleteTransId(null)}
        onConfirm={handleDeleteTrans}
        title={t.deleteTransaction}
        message={t.deleteTransactionConfirm}
        confirmLabel={t.delete}
      />
    </div>
  );
}

/* ----------------------- Subscription Form ----------------------- */

function SubscriptionForm({
  subscription,
  players,
  planAmounts,
  lang,
  onSave,
  onClose,
}: {
  subscription: Subscription | null;
  players: Player[];
  planAmounts: Record<Subscription['planType'], number>;
  lang: Lang;
  onSave: (data: Omit<Subscription, 'id'>, id?: string) => void;
  onClose: () => void;
}) {
  const t = tr(lang);
  const today = todayISO();
  const [form, setForm] = useState({
    playerId: subscription?.playerId || '',
    planType: subscription?.planType || ('monthly' as Subscription['planType']),
    amount: subscription?.amount ?? planAmounts.monthly,
    startDate: subscription?.startDate || today,
    endDate: subscription?.endDate || calcEndDate(today, 'monthly'),
    status: subscription?.status || ('unpaid' as Subscription['status']),

  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handlePlanChange = (planType: Subscription['planType']) => {
    setForm((f) => ({
      ...f,
      planType,
      amount: planAmounts[planType],
      endDate: calcEndDate(f.startDate, planType),
    }));
  };

  const handleStartChange = (startDate: string) => {
    setForm((f) => ({
      ...f,
      startDate,
      endDate: calcEndDate(startDate, f.planType),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (!form.playerId) e2.playerId = t.selectPlayerError;
    if (!form.amount || form.amount <= 0) e2.amount = t.amountError;
    if (!form.startDate) e2.startDate = t.startDateRequired;
    if (!form.endDate) e2.endDate = t.endDateRequired;
    if (form.startDate && form.endDate && form.startDate > form.endDate) e2.endDate = t.endDateAfterStart;

    setErrors(e2);
    if (Object.keys(e2).length > 0) return;

    if (saving) return;
    setSaving(true); setSaveError('');
    try {
    await onSave(
      {
        version: subscription?.version,
        playerId: form.playerId,
        planType: form.planType,
        amount: Number(form.amount) || 0,
        startDate: form.startDate,
        endDate: form.endDate,
        status: 'unpaid',
      },
      subscription?.id,
    );

    } catch { setSaveError(lang === 'ar' ? 'تعذر حفظ التغيير. راجع الرسالة وحاول مجددًا.' : 'Could not save this change. Review the error and retry.'); }
    finally { setSaving(false); }
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const activePlayers = players.filter((p) => p.status === 'active');

  return (
    <Modal open onClose={onClose} title={subscription ? t.editSubscription : t.addNewSubscription} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        {Object.keys(errors).length > 0 && (
          <FormError message={t.fixFields} />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={t.player} error={errors.playerId}>
            <select
              value={form.playerId}
              onChange={(e) => { set('playerId', e.target.value); setErrors((p) => ({ ...p, playerId: '' })); }}
              className={`${inputCls} ${errors.playerId ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              required
            >
              <option value="">{t.selectPlayer}</option>
              {activePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {subscription &&
                !activePlayers.find((p) => p.id === subscription.playerId) &&
                (() => {
                  const p = players.find((pl) => pl.id === subscription.playerId);
                  return p ? (
                    <option value={p.id}>{p.name} ({t.notActive})</option>
                  ) : null;
                })()}
            </select>
          </FormField>

          <FormField label={t.planType}>
            <select
              value={form.planType}
              onChange={(e) => handlePlanChange(e.target.value as Subscription['planType'])}
              className={inputCls}
            >
              <option value="monthly">{planLabel('monthly', lang)} — {planAmounts.monthly}</option>
              <option value="quarterly">{planLabel('quarterly', lang)} — {planAmounts.quarterly}</option>
              <option value="semi_annual">{planLabel('semi_annual', lang)} — {planAmounts.semi_annual}</option>
              <option value="annual">{planLabel('annual', lang)} — {planAmounts.annual}</option>
            </select>
          </FormField>

          <FormField label={t.amount} error={errors.amount}>
            <input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => { set('amount', Number(e.target.value) || 0); setErrors((p) => ({ ...p, amount: '' })); }}
              className={`${inputCls} ${errors.amount ? 'border-red-400 ring-1 ring-red-400' : ''}`}
            />
          </FormField>



          <FormField label={t.startDate} error={errors.startDate}>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => { handleStartChange(e.target.value); setErrors((p) => ({ ...p, startDate: '' })); }}
              className={`${inputCls} ${errors.startDate ? 'border-red-400 ring-1 ring-red-400' : ''}`}
            />
          </FormField>

          <FormField label={t.endDate} error={errors.endDate}>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => { set('endDate', e.target.value); setErrors((p) => ({ ...p, endDate: '' })); }}
              className={`${inputCls} ${errors.endDate ? 'border-red-400 ring-1 ring-red-400' : ''}`}
            />
          </FormField>


        </div>

        {/* Auto-fill hint */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-50/60 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/20 text-[11px] text-brand-700 dark:text-brand-400 font-semibold">
          <DollarSign className="h-4 w-4 shrink-0" />
          {t.autoFillHint}
        </div>

        <div className="flex gap-2 justify-end pt-1">
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

/* ----------------------- Transaction Form ----------------------- */

function TransactionForm({
  staff,
  activeRole,
  lang,
  recorderName,
  onSave,
  onClose,
}: {
  staff: Staff[];
  activeRole: Role;
  lang: Lang;
  recorderName: string;
  onSave: (data: Omit<Transaction, 'id'>) => void;
  onClose: () => void;
}) {
  const t = tr(lang);
  const today = todayISO();
  const defaultRecorder = staff.find((s) => s.role === activeRole)?.name || recorderName;

  const [form, setForm] = useState({
    type: 'revenue' as Transaction['type'],
    category: 'other' as Transaction['category'],
    amount: 0,
    transactionDate: today,
    description: '',
    recordedBy: defaultRecorder,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (!form.description.trim()) e2.description = t.descriptionRequired;
    if (!form.amount || form.amount <= 0) e2.amount = t.amountError;
    setErrors(e2);
    if (Object.keys(e2).length > 0) return;

    if (saving) return;
    setSaving(true); setSaveError('');
    try {
    await onSave({
      type: form.type,
      category: form.category,
      amount: Number(form.amount) || 0,
      transactionDate: form.transactionDate,
      description: form.description,
      recordedBy: form.recordedBy,
    });

    } catch { setSaveError(lang === 'ar' ? 'تعذر حفظ التغيير. راجع الرسالة وحاول مجددًا.' : 'Could not save this change. Review the error and retry.'); }
    finally { setSaving(false); }
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal open onClose={onClose} title={t.addTransactionTitle} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        {Object.keys(errors).length > 0 && (
          <FormError message={t.fixFields} />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={t.transactionType}>
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value as Transaction['type'])}
              className={inputCls}
            >
              <option value="revenue">{t.revenue}</option>
              <option value="expense">{t.expense}</option>
            </select>
          </FormField>

          <FormField label={t.category}>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={inputCls}
            >
              <option value="salary">{t.catSalary}</option>
              <option value="equipment">{t.catEquipment}</option>
              <option value="rent">{t.catRent}</option>
              <option value="other">{t.catOther}</option>
            </select>
          </FormField>

          <FormField label={t.amount} error={errors.amount}>
            <input
              type="number"
              min={0}
              value={form.amount || ''}
              onChange={(e) => { set('amount', Number(e.target.value) || 0); setErrors((p) => ({ ...p, amount: '' })); }}
              className={`${inputCls} ${errors.amount ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              placeholder="0"
              required
            />
          </FormField>

          <FormField label={t.transactionDate}>
            <input
              type="date"
              value={form.transactionDate}
              onChange={(e) => set('transactionDate', e.target.value)}
              className={inputCls}
            />
          </FormField>

          <div className="col-span-2">
            <FormField label={t.description} error={errors.description}>
              <input
                type="text"
                value={form.description}
                onChange={(e) => { set('description', e.target.value); setErrors((p) => ({ ...p, description: '' })); }}
                className={`${inputCls} ${errors.description ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                placeholder={t.descriptionPlaceholder}
                required
              />
            </FormField>
          </div>

          <FormField label={t.recordedBy}>
            <select
              value={form.recordedBy}
              onChange={(e) => set('recordedBy', e.target.value)}
              className={inputCls}
            >
              <option value="">{t.selectStaff}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex gap-2 justify-end pt-1">
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

/* ----------------------- Reminders & Analytics Tab ----------------------- */

function RemindersAnalyticsTab({
  subscriptions,
  players,
  parents,
  lang,
}: {
  subscriptions: Subscription[];
  players: Player[];
  parents: Parent[];
  lang: Lang;
}) {
  const t = tr(lang);
  const isAr = lang === 'ar';
  const stats = reminderStats(subscriptions, players, parents);
  const reminders = getSubscriptionReminders(subscriptions, players, parents);

  const totalSubs = subscriptions.length;
  const paidSubs = subscriptions.filter((s) => s.status === 'paid').length;
  const collectionRate = totalSubs > 0 ? Math.round((paidSubs / totalSubs) * 100) : 0;

  // Bar chart data: paid vs unpaid per plan type
  const planTypes: Subscription['planType'][] = ['monthly', 'quarterly', 'semi_annual', 'annual'];
  const chartData = planTypes.map((plan) => {
    const planSubs = subscriptions.filter((s) => s.planType === plan);
    const paid = planSubs.filter((s) => s.status === 'paid').length;
    const unpaid = planSubs.filter((s) => s.status === 'unpaid').length;
    return { plan, paid, unpaid, total: planSubs.length };
  });
  const maxCount = Math.max(...chartData.map((d) => Math.max(d.paid, d.unpaid)), 1);

  // Payment method distribution
  const methodCounts: Record<string, number> = {};
  for (const s of subscriptions) {
    const m = s.paymentMethod || 'cash';
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  }
  const methodEntries = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<AlertCircle className="h-5 w-5" />}
          label={t.overdueSubs}
          value={stats.overdue}
          color="red"
          sublabel={t.overdueSubsHint}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label={t.expiringSubs}
          value={stats.expiring}
          color="amber"
          sublabel={t.expiringSubsHint}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label={t.totalDue}
          value={`${stats.totalUnpaidAmount.toLocaleString()} ${t.currency}`}
          color="emerald"
          sublabel={t.totalDueHint}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={t.collectionRate}
          value={`${collectionRate}%`}
          color="blue"
          sublabel={`${paidSubs} / ${totalSubs}`}
        />
      </div>

      {/* Reminders panel (full) */}
      <RemindersPanel reminders={reminders} lang={lang} />

      {/* Analytics section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">{t.subscriptionAnalytics}</h3>
        </div>

        {/* Bar chart: paid vs unpaid per plan type */}
        <div className="space-y-4 mb-6">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t.paidVsUnpaidByPlan}
          </p>
          {chartData.map((d) => (
            <div key={d.plan}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{planLabel(d.plan, lang)}</span>
                <span className="text-[11px] text-slate-400 font-semibold">
                  {d.paid} {t.paid} · {d.unpaid} {t.unpaid}
                </span>
              </div>
              <div className="space-y-1.5">
                {/* Paid bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-brand-600 w-14 shrink-0">{t.paid}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{ width: `${(d.paid / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 w-6 text-center">
                    {d.paid}
                  </span>
                </div>
                {/* Unpaid bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-red-600 w-14 shrink-0">{t.unpaid}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${(d.unpaid / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 w-6 text-center">
                    {d.unpaid}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment patterns */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">{t.paymentPatterns}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {methodEntries.map(([method, count]) => (
              <div
                key={method}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700"
              >
                <Badge color="blue">{paymentMethodLabel(method, lang)}</Badge>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
