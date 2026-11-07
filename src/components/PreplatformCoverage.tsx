import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {academyToday} from '@/lib/report-dates';
import {errorMessage} from '@/lib/registration';
import {inputCls} from '@/components/ui';
import type {Lang} from '@/types';

export function PreplatformCoverage({playerId,lang,onSaved,readOnly=false}:{playerId:string;lang:Lang;onSaved?:()=>Promise<void>;readOnly?:boolean}) {
 const ar=lang==='ar';
 const [existing,setExisting]=useState<{covered_from:string;next_due_date:string}|null>(null);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [from,setFrom]=useState(academyToday()),[due,setDue]=useState(''),[amount,setAmount]=useState('25'),[reason,setReason]=useState('');
 useEffect(()=>{
  let alive=true;setReady(false);setExisting(null);setError('');
  supabase.from('preplatform_coverage').select('covered_from,next_due_date').eq('player_id',playerId).maybeSingle().then(({data,error:e})=>{
   if(!alive)return;if(e)setError(errorMessage(e,ar));else{setExisting(data);setReady(true);}
  });return()=>{alive=false;};
 },[playerId,ar]);
 const save=async()=>{
  if(busy||!ready||existing)return;
  setBusy(true);setError('');
  try{
   const {error:e}=await supabase.rpc('approve_preplatform_coverage',{p_player_id:playerId,p_covered_from:from,p_next_due_date:due,p_monthly_amount:Number(amount),p_reason:reason.trim()});
   if(e)throw e;
   setExisting({covered_from:from,next_due_date:due});
   try{await onSaved?.();}catch{setError(ar?'تم الاعتماد؛ حدّث الصفحة لعرض البيانات الجديدة.':'Approved; reload to refresh the view.');}
  }catch(e){setError(errorMessage(e,ar));}finally{setBusy(false);}
 };
 if(readOnly&&!existing)return error?<p role="alert" className="text-sm text-red-500">{error}</p>:null;
 return <div className="rounded-xl border border-blue-200 dark:border-blue-900 p-3 space-y-3 text-sm dark:text-slate-100">
  <h4 className="font-bold">{ar?'اشتراك مدفوع قبل المنصة':'Subscription paid before joining the platform'}</h4>
  {error&&<p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
  {existing?<p>{ar?'دفع سابق معتمد، دون قبض جديد. بداية التغطية':'Previous payment approved; no new cash receipt. Coverage starts'}: {existing.covered_from} · {ar?'أول استحقاق قادم':'First subsequent payment due'}: {existing.next_due_date}</p>:<>
   <p>{ar?'بعد اعتماد التسجيل: وثّق الفترة المدفوعة سابقًا وحدد أول استحقاق شهري. لا تُنشأ حركة مالية أو إيصال جديد، ولا يُعد اللاعب معفيًا.':'After registration approval, record existing paid coverage and the first monthly due date. No cash transaction or new receipt is created; this is not an exemption.'}</p>
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
    <label>{ar?'بداية الفترة المدفوعة':'Paid period starts'}<input className={inputCls} type="date" max={academyToday()} value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>{ar?'أول موعد دفع قادم':'Next payment date'}<input className={inputCls} type="date" min={academyToday()} value={due} onChange={e=>setDue(e.target.value)}/></label>
    <label>{ar?'الرسوم الشهرية القادمة (د.ب)':'Future monthly fee (BHD)'}<input className={inputCls} type="number" min="0.001" max="25" step="0.001" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   </div>
   <label className="block">{ar?'مرجع الدفع السابق / ملاحظة الاعتماد':'Previous payment reference / approval note'}<input className={inputCls} value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>
   <button type="button" onClick={()=>void save()} disabled={busy||!ready||!due||due<=academyToday()||reason.trim().length<3} className="rounded-lg bg-blue-700 px-3 py-2 font-bold text-white disabled:opacity-50">{busy?(ar?'جارٍ الاعتماد':'Approving'):(ar?'اعتماد الدفع السابق وتحديد الاستحقاق':'Approve previous payment and schedule next due')}</button>
  </>}
 </div>;
}
