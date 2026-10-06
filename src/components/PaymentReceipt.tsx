import { Printer } from 'lucide-react';
import type { Lang, Parent, Player, Settings, Subscription, Transaction } from '@/types';
import { paymentMethodLabel } from '@/lib/i18n';

type Props = {
  subscription: Subscription;
  transactions: Transaction[];
  players: Player[];
  parents: Parent[];
  settings?: Settings | null;
  lang: Lang;
  officialReceiptNumber?: number;
  onClose: () => void;
};

export function PaymentReceipt({ subscription, transactions, players, parents, settings, lang, officialReceiptNumber, onClose }: Props) {
  const ar = lang === 'ar';
  const player = players.find((p) => p.id === subscription.playerId);
  const parent = parents.find((p) => p.id === player?.parentId);
  const tx = transactions.find((t) => t.subscriptionId === subscription.id);
  const rawReference = tx?.id || subscription.id;
  const number = officialReceiptNumber != null
    ? `SA-${String(officialReceiptNumber).padStart(6, '0')}`
    : rawReference.replace(/^txn-/, '').slice(0, 12).toUpperCase();
  const date = tx?.transactionDate || subscription.paidAt?.slice(0, 10) || '-';
  const payer = parent?.name || player?.parentName || player?.name || '-';
  const method = subscription.paymentMethod || 'cash';
  const methodChecks = [
    { key: 'cash', labelAr: 'نقداً', labelEn: 'Cash', checked: method === 'cash' },
    { key: 'benefit', labelAr: 'بنفت / تحويل', labelEn: 'Benefit / Transfer', checked: ['benefit', 'benefitpay', 'bank_transfer'].includes(method) },
    { key: 'card', labelAr: 'بطاقة', labelEn: 'Card', checked: method === 'card' },
  ];
  const brandName = settings?.name?.trim() || 'SHOOTER ACADEMY';
  const academyLogo = '/شعار_أكاديمية_شوتر_ثلاثي_الأبعاد copy 2.png';
  return (
    <div className="receipt-overlay fixed inset-0 z-50 bg-black/50 p-4 overflow-y-auto" dir={ar ? 'rtl' : 'ltr'}>
      <div className="receipt-print-root max-w-2xl mx-auto bg-white rounded-2xl shadow-xl">
        <div className="p-6 sm:p-8 text-slate-900">
          <div className="flex justify-between gap-4 pb-5 border-b-2 border-red-700">
            <div className="flex items-center gap-3">
              <img src={academyLogo} alt={brandName} className="h-16 w-16 object-contain" />
              <div>
                <div className="text-2xl font-black text-red-700">{brandName}</div>
                <div className="text-xs font-bold text-slate-500">{ar ? 'إيصال استلام' : 'RECEIPT'}</div>
                {(settings?.phone || settings?.email) && <div className="mt-1 text-[10px] text-slate-400">{[settings.phone, settings.email].filter(Boolean).join(' · ')}</div>}
              </div>
            </div>
            <div className="text-xs text-end"><div><b>{ar ? 'رقم الإيصال:' : 'Receipt No:'}</b> {number}</div><div><b>{ar ? 'التاريخ:' : 'Date:'}</b> {date}</div></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 py-5 text-sm">
            <Field label={ar ? 'استلمنا من' : 'Received from'} value={payer} />
            <Field label={ar ? 'عن اللاعب' : 'For player'} value={player?.name || '-'} />
            <Field label={ar ? 'المبلغ' : 'Amount'} value={subscription.amount.toFixed(3) + ' BHD'} />
            <Field label={ar ? 'طريقة الدفع' : 'Payment method'} value={paymentMethodLabel(subscription.paymentMethod || 'cash', lang)} />
          </div>
          <div className="py-4 border-t text-xs text-slate-600 space-y-1">
            <div><b>{ar ? 'البيان:' : 'For:'}</b> {ar ? 'سداد اشتراك الأكاديمية' : 'Academy subscription payment'}</div>
            <div><b>{ar ? 'فترة الاشتراك:' : 'Subscription period:'}</b> {subscription.startDate} - {subscription.endDate}</div>
            <div><b>{ar ? 'مرجع العملية:' : 'Transaction reference:'}</b> <span dir="ltr">{rawReference}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 py-4 border-t text-xs">
            {methodChecks.map((item) => (
              <div key={item.key} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 p-2 bg-white">
                <span className="inline-flex h-4 w-4 items-center justify-center border border-slate-500 text-[10px] font-black">{item.checked ? '✓' : ''}</span>
                <span>{ar ? item.labelAr : item.labelEn}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-8 pt-12 text-xs text-center"><div className="border-t pt-2">{ar ? 'توقيع المستلم' : 'Receiver signature'}</div><div className="border-t pt-2">{ar ? 'توقيع الدافع' : 'Payer signature'}</div></div>
          {(settings?.phone || settings?.email || settings?.address) && (
            <div className="mt-8 border-t pt-3 text-center text-[10px] text-slate-400">
              {[settings?.phone, settings?.email, settings?.address].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="receipt-no-print flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold">{ar ? 'إغلاق' : 'Close'}</button>
          <button onClick={() => {
            document.body.classList.add('receipt-printing');
            const cleanup = () => document.body.classList.remove('receipt-printing');
            window.addEventListener('afterprint', cleanup, { once: true });
            window.print();
            window.setTimeout(cleanup, 1500);
          }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-bold"><Printer className="h-4 w-4"/>{ar ? 'طباعة' : 'Print'}</button>
        </div>
      </div>
    </div>
  );
}
function Field({label,value}:{label:string;value:string}) { return <div className="p-3 rounded-xl bg-slate-50"><span className="block text-xs text-slate-500">{label}</span><strong>{value}</strong></div>; }
