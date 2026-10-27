import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal, inputCls } from '@/components/ui';
import { errorMessage } from '@/lib/registration';
import type { Subscription, Lang } from '@/types';

interface SupportRow { id: string; amount: number; reason: string; created_at: string; payment_method: string; purpose: string }
export function SubscriptionSupport({ subscription, lang, onClose, onSaved }: {
 subscription: Subscription; lang: Lang; onClose: () => void; onSaved: () => Promise<void>;
}) {
 const ar=lang==='ar';
 const [rows,setRows]=useState<SupportRow[]>([]);
 const [paidAmount,setPaidAmount]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [amount,setAmount]=useState('');
 const [reason,setReason]=useState('');
 const [method,setMethod]=useState('cash');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [saved,setSaved]=useState(false);
 const [requestId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{
  let active=true;
  async function load() {
   setLoading(true); setError('');
   try {
    const [history,payments]=await Promise.all([
     supabase.from('subscription_support').select('id,amount,reason,created_at,payment_method,purpose').eq('subscription_id',subscription.id).order('created_at',{ascending:false}),
     supabase.from('transactions').select('amount').eq('subscription_id',subscription.id).eq('type','revenue').eq('category','subscription'),
    ]);
    if(history.error) throw history.error;
    if(payments.error) throw payments.error;
    if(!active)return;
    setRows(history.data||[]);
    setPaidAmount((payments.data||[]).reduce((sum,r)=>sum+Number(r.amount),0));
   } catch(e) { if(active)setError(errorMessage(e,ar)); }
   finally { if(active)setLoading(false); }
  }
  void load();
  return()=>{active=false;};
 },[subscription.id,ar]);
 const granted=rows.reduce((sum,r)=>sum+Number(r.amount),0);
 const remaining=Math.max(0,Math.round((paidAmount-granted)*1000)/1000);
 const save=async()=>{
  if(busy||saved||loading||error)return;
  const value=Number(amount);
  if(!confirmed||!amount.trim()||!Number.isFinite(value)||value<=0||value>remaining||Math.abs(value*1000-Math.round(value*1000))>0.000001||reason.trim().length<3){
   setError(ar?'أدخل مبلغًا صحيحًا وسبب الإعفاء وأكد تسليم المبلغ.':'Enter a valid amount and reason, and confirm the refund was delivered.');return;
  }
  setBusy(true);setError('');
  const {error:e}=await supabase.rpc('grant_subscription_support',{p_request_id:requestId,p_subscription_id:subscription.id,p_amount:value,p_reason:reason.trim(),p_method:method});
  if(e){setError(errorMessage(e,ar));setBusy(false);return;}
  setSaved(true);
  try{await onSaved();onClose();}catch{setError(ar?'تم تسجيل الدعم. تعذّر تحديث العرض؛ أغلق النافذة وحدّث الصفحة.':'Support recorded. Refresh failed; close this dialog and reload.');}
  finally{setBusy(false);}
 };
 return <Modal open onClose={()=>{if(!busy)onClose();}} title={ar?'رد رسوم بسبب الإعفاء — مع استمرار الاشتراك':'Exemption refund — subscription continues'}>
  <div className="space-y-4 text-sm dark:text-slate-100" dir={ar?'rtl':'ltr'}>
   <p>{ar?'يستمر اللاعب في التدريب بهذا الاشتراك. هذا الإجراء لا يلغي الاشتراك ولا يشمل الأشهر القادمة. يُسجَّل المبلغ المرتجع كعملية مستقلة؛ يبقى الدفع والإيصال الأصليان محفوظين. هذا تسجيل لاسترداد تم بالفعل، ولا ينفّذ تحويلًا بنكيًا.':'The player continues under this subscription; it is not cancelled and future periods are not waived. Records a completed refund separately and preserves the original payment and receipt. This does not execute a bank transfer.'}</p>
   <p>{ar?'الدفع الأصلي':'Original payment'}: {paidAmount.toFixed(3)} BHD · {ar?'إجمالي المبالغ المُعادة سابقًا':'All previous refunds'}: {granted.toFixed(3)} BHD · {ar?'المتاح':'Available'}: {remaining.toFixed(3)} BHD</p>
   {error&&<p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
   <label className="block">{ar?'مبلغ الرسوم المُعادة بسبب الإعفاء':'Exemption refund amount'}<input className={inputCls} type="number" min="0.001" max={remaining} step="0.001" value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy||saved}/></label>
   <label className="block">{ar?'سبب الإعفاء':'Reason'}<textarea className={inputCls} value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} disabled={busy||saved}/></label>
   <label className="block">{ar?'طريقة إرجاع المبلغ':'Refund method'}<select className={inputCls} value={method} onChange={e=>setMethod(e.target.value)} disabled={busy||saved}>
    <option value="cash">{ar?'نقدًا':'Cash'}</option><option value="transfer">{ar?'تحويل بنكي':'Bank transfer'}</option><option value="benefit">{ar?'بنفت':'Benefit'}</option><option value="card">{ar?'بطاقة':'Card'}</option>
   </select></label>
   <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy||saved}/>{ar?'أؤكد إرجاع المبلغ فعليًا للاعب أو ولي الأمر':'I confirm the amount was actually returned to the player or parent'}</label>
   <button onClick={()=>void save()} disabled={busy||saved||loading||!!error||!confirmed||remaining<=0} className="rounded-xl bg-brand-600 px-4 py-2 font-bold text-white disabled:opacity-50">{busy?(ar?'جارٍ الحفظ':'Saving'):(ar?'تسجيل رد الرسوم بسبب الإعفاء':'Record exemption refund')}</button>
   {rows.length>0&&<div className="space-y-2 border-t pt-3 dark:border-slate-700"><h3 className="font-bold">{ar?'سجل المبالغ المُعادة':'Refund history'}</h3>{rows.map(r=><p key={r.id}>{Number(r.amount).toFixed(3)} BHD · {r.purpose === 'withdrawal' ? (ar ? 'انسحاب' : 'Withdrawal') : (ar ? 'إعفاء' : 'Exemption')} · {r.reason} · {new Date(r.created_at).toLocaleDateString(ar?'ar-BH':'en-BH')}</p>)}</div>}
  </div>
 </Modal>;
}
