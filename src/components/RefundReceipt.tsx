import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { paymentMethodLabel } from '@/lib/i18n';
import { errorMessage } from '@/lib/registration';
import type { Lang, Settings, Subscription } from '@/types';

type Refund = {
  id: string; refund_receipt_number: number | string; amount: number | string;
  reason: string; payment_method: string; created_at: string;
  original_payment_id: string; transaction_id: string;
};

export function RefundReceipt({ subscription, playerName, recipientName, settings, lang, onClose }: {
  subscription: Subscription; playerName: string; recipientName?: string;
  settings?: Settings | null; lang: Lang; onClose: () => void;
}) {
  const ar = lang === 'ar';
  const [rows, setRows] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await supabase.from('subscription_support')
          .select('id,refund_receipt_number,amount,reason,payment_method,created_at,original_payment_id,transaction_id')
          .eq('subscription_id', subscription.id).eq('purpose', 'withdrawal').order('created_at');
        if (result.error) throw result.error;
        if (active) setRows(result.data || []);
      } catch (e) { if (active) setError(errorMessage(e, ar)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [subscription.id, ar]);
  const print = () => {
    document.body.classList.add('receipt-printing');
    const cleanup = () => document.body.classList.remove('receipt-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };
  return <div className="receipt-overlay fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" dir={ar ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-label={ar ? 'فاتورة استرداد الاشتراك' : 'Subscription refund receipt'}>
    <div className="receipt-print-root mx-auto w-full max-w-3xl rounded-2xl bg-white text-slate-900 shadow-xl">
      <div className="receipt-content space-y-4 p-6">
        <header className="border-b-2 border-red-700 pb-3"><h2 className="text-xl font-black text-red-700">{settings?.name || 'SHOOTER ACADEMY'}</h2><h3 className="font-bold">{ar ? 'فاتورة استرداد الاشتراك' : 'Subscription refund receipt'}</h3></header>
        <p>{ar ? 'اللاعب' : 'Player'}: <strong>{playerName}</strong> · {ar ? 'ولي الأمر / المستلم' : 'Parent / recipient'}: <strong>{recipientName || '—'}</strong></p>
        <p className="text-sm">{ar ? 'الاشتراك الملغى' : 'Cancelled subscription'}: <span dir="ltr">{subscription.id}</span> · {subscription.startDate} — {subscription.endDate}</p>
        {loading && <p role="status">{ar ? 'جارٍ تحميل فواتير الاسترداد…' : 'Loading refund receipts…'}</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {!loading && !error && rows.length === 0 && <p role="status">{ar ? 'لم يُسجّل استرداد فعلي لهذا الاشتراك بعد. إلغاء الاشتراك وحده لا يصدر فاتورة استرداد.' : 'No actual refund has been recorded. Cancellation alone does not issue a refund receipt.'}</p>}
        {rows.map(row => <article key={row.id} className="space-y-2 rounded-xl border p-4">
          <div className="flex flex-wrap justify-between gap-2 font-bold"><span dir="ltr">SR-{String(row.refund_receipt_number).padStart(6, '0')}</span><time>{new Intl.DateTimeFormat(ar ? 'ar-BH' : 'en-GB', { timeZone: 'Asia/Bahrain', dateStyle: 'medium' }).format(new Date(row.created_at))}</time></div>
          <p className="text-lg font-black">{ar ? 'المبلغ المُعاد فعليًا' : 'Amount actually returned'}: {Number(row.amount).toFixed(3)} BHD</p>
          <p>{ar ? 'طريقة الاسترداد' : 'Refund method'}: {paymentMethodLabel(row.payment_method, lang)}</p>
          <p>{ar ? 'السبب' : 'Reason'}: {row.reason}</p>
          <p className="break-all text-xs">{ar ? 'مرجع الدفع الأصلي' : 'Original payment reference'}: <span dir="ltr">{row.original_payment_id}</span></p>
          <p className="break-all text-xs">{ar ? 'مرجع الاسترداد' : 'Refund reference'}: <span dir="ltr">{row.transaction_id}</span></p>
        </article>)}
        {rows.length > 0 && <><p className="font-bold">{ar ? 'إجمالي المبالغ المُعادة' : 'Total returned'}: {(rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 1000), 0) / 1000).toFixed(3)} BHD</p><p className="text-xs text-slate-500">{ar ? 'تحل فاتورة الاسترداد محل إيصال الاشتراك الملغى في العرض. يبقى الدفع الأصلي محفوظًا ومرتبطًا بالاسترداد.' : 'This refund receipt replaces the cancelled subscription receipt in this view. The original payment remains preserved and linked.'}</p><div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs"><span className="border-t pt-2">{ar ? 'توقيع المستلم' : 'Recipient signature'}</span><span className="border-t pt-2">{ar ? 'توقيع الإدارة' : 'Academy signature'}</span></div></>}
      </div>
      <div className="receipt-no-print flex justify-end gap-2 border-t p-4"><button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 font-bold">{ar ? 'إغلاق' : 'Close'}</button><button disabled={loading || !!error || rows.length === 0} onClick={print} className="flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50"><Printer className="h-4 w-4" />{ar ? 'طباعة' : 'Print'}</button></div>
    </div>
  </div>;
}
