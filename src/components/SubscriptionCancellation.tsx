import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal, inputCls } from '@/components/ui';
import { errorMessage } from '@/lib/registration';
import type { Subscription, Lang } from '@/types';

export function SubscriptionCancellation({ subscription, lang, onClose, onSaved }: {
  subscription: Subscription; lang: Lang; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const ar = lang === 'ar';
  const cancelled = subscription.status === 'cancelled';
  const [available, setAvailable] = useState(0);
  const [due, setDue] = useState(0);
  const [returned, setReturned] = useState(0);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('cash');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [payments, refunds, cancellation] = await Promise.all([
          supabase.from('transactions').select('amount').eq('subscription_id', subscription.id).eq('type', 'revenue').eq('category', 'subscription'),
          supabase.from('subscription_support').select('amount,purpose').eq('subscription_id', subscription.id),
          supabase.from('subscription_cancellations').select('refund_due,reason').eq('subscription_id', subscription.id).maybeSingle(),
        ]);
        for (const result of [payments, refunds, cancellation]) if (result.error) throw result.error;
        if (!active) return;
        const total = (payments.data || []).reduce((s, r) => s + Number(r.amount), 0);
        const allReturned = (refunds.data || []).reduce((s, r) => s + Number(r.amount), 0);
        const withdrawalReturned = (refunds.data || []).filter(r => r.purpose === 'withdrawal').reduce((s, r) => s + Number(r.amount), 0);
        setAvailable(Math.max(0, Math.round((total - allReturned) * 1000) / 1000));
        setReturned(withdrawalReturned);
        setDue(Number(cancellation.data?.refund_due || 0));
        setReason(cancellation.data?.reason || '');
        setAmount(cancelled ? Math.max(0, Number(cancellation.data?.refund_due || 0) - withdrawalReturned).toFixed(3) : '0');
        setLoading(false);
        setLoadFailed(false);
      } catch (e) { if (active) { setError(errorMessage(e, ar)); setLoadFailed(true); setLoading(false); } }
    }
    void load();
    return () => { active = false; };
  }, [subscription.id, cancelled, ar]);
  const maximum = cancelled ? Math.min(available, Math.max(0, Math.round((due - returned) * 1000) / 1000)) : available;
  async function save() {
    if (busy || saved || loading || loadFailed) return;
    const value = Number(amount);
    if (!confirmed || !amount.trim() || !Number.isFinite(value) || value < (cancelled ? 0.001 : 0) || value > maximum || Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001 || reason.trim().length < 3) {
      setError(ar ? 'تحقق من المبلغ والسبب والتأكيد.' : 'Check the amount, reason and confirmation.'); return;
    }
    setBusy(true); setError('');
    try {
      const result = cancelled
        ? await supabase.rpc('record_withdrawal_refund', { p_request_id: requestId, p_subscription_id: subscription.id, p_amount: value, p_reason: reason.trim(), p_method: method })
        : await supabase.rpc('cancel_subscription', { p_request_id: requestId, p_subscription_id: subscription.id, p_refund_due: value, p_reason: reason.trim() });
      if (result.error) throw result.error;
      setSaved(true);
      try { await onSaved(); onClose(); }
      catch { setError(ar ? 'تم الحفظ. أغلق النافذة وحدّث الصفحة.' : 'Saved. Close this dialog and refresh.'); }
    } catch (e) { setError(errorMessage(e, ar)); }
    finally { setBusy(false); }
  }
  return <Modal open onClose={() => { if (!busy) onClose(); }} title={cancelled ? (ar ? 'استرداد بعد إلغاء الاشتراك' : 'Refund after cancellation') : (ar ? 'إلغاء الاشتراك لعدم الانضمام أو الانسحاب' : 'Cancel subscription for withdrawal')}>
    <div className="space-y-4 text-sm dark:text-slate-100" dir={ar ? 'rtl' : 'ltr'}>
      <p>{ar ? 'الإلغاء يوقف هذا الاشتراك فقط ويحفظ الدفع والإيصال والسجل السابق. لا يمنح إعفاءً، ولا يحذف اللاعب أو يغيّر اشتراكات إخوته. يُوقف اللاعب إذا لم يكن لديه اشتراك ساري آخر.' : 'Cancellation ends this subscription only, preserving payment, receipt and history. It does not grant an exemption, delete the player or change siblings’ subscriptions. The player becomes inactive if no other current subscription covers them.'}</p>
      <p>{ar ? 'بعد تسجيل الاسترداد الفعلي، تصدر فاتورة استرداد. يُوقف حساب ولي الأمر إذا كان له ابن واحد فقط وأصبح موقوفًا، ويبقى قائمًا عند تعدد الأبناء.' : 'Recording the actual refund issues a refund receipt. A parent with one child becomes inactive when that child is inactive; parents with multiple children retain their account.'}</p>
      <p>{ar ? 'تحدد الإدارة المبلغ المستحق وفق السياسة المعتمدة. تسجيل الإلغاء لا يعني إعادة المال. سجّل الاسترداد بعد تسليمه فعليًا؛ هذه الشاشة لا تنفذ تحويلًا بنكيًا.' : 'Management determines the approved refund under academy policy. Cancellation does not return money. Record a refund only after delivery; this screen does not execute bank transfers.'}</p>
      {cancelled && <p role="status">{ar ? 'المستحق' : 'Approved'}: {due.toFixed(3)} BHD · {ar ? 'المُعاد بسبب الانسحاب' : 'Withdrawal refunds'}: {returned.toFixed(3)} BHD · {due > returned ? (ar ? 'بانتظار استكمال الاسترداد' : 'Refund pending') : (ar ? 'لا يوجد مبلغ استرداد معلق' : 'No pending refund')}</p>}
      <p>{ar ? 'الحد المتاح بعد خصم جميع المبالغ المُعادة' : 'Available after all prior refunds'}: {maximum.toFixed(3)} BHD</p>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {loading ? <p>{ar ? 'جارٍ تحميل السجل…' : 'Loading history…'}</p> : <>
        <label className="block">{cancelled ? (ar ? 'المبلغ الذي أُعيد فعليًا' : 'Amount actually returned') : (ar ? 'المبلغ المعتمد للاسترداد؛ صفر للإلغاء دون استرداد' : 'Approved refund; zero for cancellation without refund')}<input className={inputCls} type="number" min={cancelled ? '0.001' : '0'} max={maximum} step="0.001" value={amount} onChange={e => setAmount(e.target.value)} disabled={busy || saved} /></label>
        <label className="block">{ar ? 'السبب' : 'Reason'}<textarea className={inputCls} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} disabled={busy || saved} /></label>
        {cancelled && <label className="block">{ar ? 'طريقة الإرجاع' : 'Refund method'}<select className={inputCls} value={method} onChange={e => setMethod(e.target.value)} disabled={busy || saved}><option value="cash">{ar ? 'نقدًا' : 'Cash'}</option><option value="transfer">{ar ? 'تحويل بنكي' : 'Bank transfer'}</option><option value="benefit">{ar ? 'بنفت' : 'Benefit'}</option><option value="card">{ar ? 'بطاقة' : 'Card'}</option></select></label>}
        <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy || saved} />{cancelled ? (ar ? 'أؤكد إعادة هذا المبلغ فعليًا للاعب أو ولي الأمر' : 'I confirm this amount was actually returned to the player or parent') : (ar ? 'أؤكد إلغاء هذا الاشتراك واعتماد المبلغ الموضح للاسترداد' : 'I confirm cancellation and approve the stated refund amount')}</label>
        <button onClick={() => void save()} disabled={busy || saved || loading || loadFailed || !confirmed || (cancelled && maximum <= 0)} className="rounded-xl bg-brand-600 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? (ar ? 'جارٍ الحفظ' : 'Saving') : cancelled ? (ar ? 'تسجيل المبلغ المُعاد' : 'Record completed refund') : (ar ? 'إلغاء الاشتراك وتسجيل المستحق' : 'Cancel and record refund due')}</button>
      </>}
    </div>
  </Modal>;
}
