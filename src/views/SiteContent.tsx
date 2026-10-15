import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Eye, Upload, History, Globe } from 'lucide-react';
import type { Lang, Role, Staff } from '@/types';
import { publishContent, readContentHistory, readManagerContent, resolveContentMedia, saveContent, uploadContentFile, type ContentItem, type ContentKind, type ContentRevision } from '@/lib/site-content';
import { featuredImageStyle, featuredPlayerValidationError } from '@/lib/featured-player';
import { hasReviewedCurrentDraft } from '@/lib/content-review';
import '../academy-home.css';

const kinds: {kind:ContentKind; ar:string; en:string}[] = [
  {kind:'news',ar:'الأخبار',en:'News'},{kind:'gallery',ar:'معرض الصور',en:'Gallery'},
  {kind:'video',ar:'الفيديو',en:'Videos'},{kind:'coach',ar:'المدربون',en:'Coaches'},{kind:'contact',ar:'التواصل ولاعب الشهر',en:'Contact & featured player'},
];
const contacts = ['instagram','tiktok','facebook','whatsapp','maps'];
const box='rounded-xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const input='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100';
const button='inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
export function SiteContent({activeRole,lang,staff}:{activeRole:Role;lang:Lang;staff:Staff[]}) {
  const ar=lang==='ar';
  const [kind,setKind]=useState<ContentKind>('news');
  const [items,setItems]=useState<ContentItem[]>([]);
  const [published,setPublished]=useState<{id:string;published_at:string}[]>([]);
  const [selected,setSelected]=useState<ContentItem|null>(null);
  const [isNew,setIsNew]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [preview,setPreview]=useState<ContentItem|null>(null);
  const [history,setHistory]=useState<ContentRevision[]>([]);
  const [showHistory,setShowHistory]=useState(false);
  const reload=useCallback(async()=>{
    setLoading(true);
    try { const result=await readManagerContent();setItems(result.items);setPublished(result.published); }
    catch(e){setError(e instanceof Error?e.message:String((e as {message?:string}).message||e));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{if(activeRole==='manager') void reload();},[activeRole,reload]);
  if(activeRole!=='manager') return <p>{ar?'هذا القسم للمدير فقط.':'Manager access required.'}</p>;
  const canPublish = hasReviewedCurrentDraft(selected, preview);
  const setField=(field:string,value:string)=>{setPreview(null);setSelected(s=>s?{...s,payload:{...s.payload,[field]:value}}:s);};
  const run=async(task:()=>Promise<void>)=>{
    setBusy(true);setError('');setMessage('');
    try{await task();}catch(e){setError(e instanceof Error?e.message:String((e as {message?:string}).message||e));}finally{setBusy(false);}
  };
  const save=async()=>{
    if(!selected) throw new Error('اختر محتوى أولًا.');
    if(selected.kind!=='contact'&&!selected.payload.title?.trim()) throw new Error('العنوان مطلوب.');
    if(selected.kind==='contact') for(const key of contacts){const value=selected.payload[key];if(value){const url=new URL(value);if(url.protocol!=='https:') throw new Error('روابط التواصل يجب أن تبدأ بـ HTTPS.');}}
    const saved=await saveContent(selected,isNew);setSelected(saved);setIsNew(false);await reload();return saved;
  };
  const field=(name:string,label:string,type='text')=><label className="block space-y-1" key={name}><span className="text-sm font-bold">{label}</span><input className={input} type={type} maxLength={name==='title'?200:1000} value={selected?.payload[name]||''} onChange={e=>setField(name,e.target.value)} disabled={busy}/></label>;
  const upload=(name:string,label:string,video=false)=><label className="block space-y-2"><span className="flex items-center gap-2 text-sm font-bold"><Upload size={16}/>{label}</span><input type="file" accept={video?'video/mp4':'image/jpeg,image/png,image/webp'} disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{const path=await uploadContentFile(file,video);setPreview(null);setSelected(s=>s?{...s,payload:{...s.payload,[`${name}_path`]:path,[name]:''}}:s);setMessage('تم رفع الملف. احفظ المسودة لربطه بالمحتوى.');});e.target.value='';}}/><p className="text-xs text-slate-500 dark:text-slate-400">{selected?.payload[`${name}_path`]?'ملف مرفوع':selected?.payload[name]?'ملف من الموقع الحالي':video?'MP4 · 20 MB':'JPG / PNG / WebP · 5 MB'}</p></label>;
  return <section className="space-y-5" dir={ar?'rtl':'ltr'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{ar?'إدارة الموقع':'Website content'}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ar?'المسودات خاصة. التعديلات تظهر للزوار بعد النشر فقط.':'Drafts are private. Visitors see changes only after publishing.'}</p></div><a href="/" target="_blank" rel="noopener noreferrer" className={button}><Globe size={16}/>{ar?'فتح الموقع':'Open website'}</a></div>
    <div className="grid grid-cols-2 gap-3"><div className={box}>{ar?'منشور':'Published'} <b>{published.length}</b></div><div className={box}>{ar?'غير منشور':'Unpublished'} <b>{items.filter(i=>!published.some(p=>p.id===i.id)).length}</b></div></div>
    {error&&<div role="alert" className="rounded-lg bg-red-100 p-3 text-red-900">{error}<button className="ms-3 underline" onClick={()=>void reload()}>{ar?'إعادة التحميل':'Reload'}</button></div>}
    {message&&<p role="status" className="rounded-lg bg-green-100 p-3 text-green-900">{message}</p>}
    <nav className="flex flex-wrap gap-2" aria-label="أقسام المحتوى">{kinds.map(k=><button key={k.kind} disabled={busy} onClick={()=>{setKind(k.kind);setSelected(null);setPreview(null);setShowHistory(false);}} className={`${button} ${kind!==k.kind?'!bg-slate-600':''}`}>{ar?k.ar:k.en}</button>)}</nav>
    <div className="grid gap-5 lg:grid-cols-[minmax(230px,1fr)_2fr]">
      <div className={`${box} space-y-3`}><button className={`${button} w-full`} disabled={busy||loading||kind==='contact'&&items.some(i=>i.kind==='contact')} onClick={()=>{setSelected({id:crypto.randomUUID(),kind,payload:{},sort_order:items.length,version:1});setIsNew(true);setPreview(null);setShowHistory(false);}}><Plus size={16}/>{ar?'إضافة محتوى':'Add content'}</button>
        {loading?<p role="status">{ar?'جارٍ التحميل…':'Loading…'}</p>:items.filter(i=>i.kind===kind).map(i=><button className={`${input} text-start ${selected?.id===i.id?'!border-red-600':''}`} disabled={busy} key={i.id} onClick={()=>{setSelected({...i,payload:{...i.payload}});setIsNew(false);setPreview(null);setShowHistory(false);}}><b className="block truncate">{i.payload.title||'روابط التواصل'}</b><span className="text-xs">{published.some(p=>p.id===i.id)?'منشور':'مسودة / مخفي'} · {i.sort_order}</span></button>)}
        {!loading&&!items.some(i=>i.kind===kind)&&<p className="text-sm">{ar?'لا يوجد محتوى في هذا القسم.':'No content in this section.'}</p>}
      </div>
      {selected?<div className={`${box} space-y-4`} key={selected.id}>
        {kind==='contact'?<>
          <h3 className="font-black text-lg">روابط التواصل</h3>
          {contacts.map(c=>field(c,c,'url'))}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <h3 className="font-black text-lg">لاعب الشهر — بطاقة التكريم</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">تظل خلفية الواجهة ثابتة، وتظهر فوقها صورة اللاعب الشفافة فقط بعد نشر اسمه وصورته. استخدم PNG أو WebP بخلفية شفافة.</p>
            {field('featured_name','اسم اللاعب')}
            {field('featured_name_en','Player Name (English) — optional')}
            {field('featured_heading','عنوان بطاقة التكريم')}
            {field('featured_heading_en','Recognition Title (English) — optional')}
            <label className="block space-y-1"><span className="text-sm font-bold">نبذة وسبب التميز</span><textarea className={input} rows={3} maxLength={1800} disabled={busy} value={selected.payload.featured_body||''} onChange={e=>setField('featured_body',e.target.value)}/></label>
            <label className="block space-y-1"><span className="text-sm font-bold">Recognition Reason (English) — optional</span><textarea className={input} rows={3} maxLength={1800} disabled={busy} value={selected.payload.featured_body_en||''} onChange={e=>setField('featured_body_en',e.target.value)}/></label>
            {upload('featured_image','صورة اللاعب (PNG / WebP بخلفية شفافة مفضلة)')}
            <div className="grid gap-3 sm:grid-cols-3">
              {([['featured_left','الموقع الأفقي',-20,30,1],['featured_width','عرض اللاعب',28,70,50],['featured_height','ارتفاع اللاعب',50,100,94]] as const).map(([key,label,min,max,fallback])=><label key={key} className="block space-y-2 text-sm"><span className="font-bold">{label}: {selected.payload[key] || fallback}%</span><input className="w-full accent-red-700" type="range" min={min} max={max} step={1} value={selected.payload[key] || fallback} disabled={busy} onChange={e=>setField(key,e.target.value)}/></label>)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">استعمل معاينة قبل النشر؛ الصور والمسودات لا تظهر للزوار حتى النشر.</p>
          </div>
        </>:<>
          {field('title',kind==='coach'?'اسم المدرب':'العنوان')}
          {field('title_en',kind==='coach'?'Coach Name (English) — optional':'Title (English) — optional')}
          <label className="block space-y-1"><span className="text-sm font-bold">{kind==='coach'?'نبذة المدرب':'الوصف / التعليق'}</span><textarea className={input} rows={4} maxLength={6000} disabled={busy} value={selected.payload.body||''} onChange={e=>setField('body',e.target.value)}/></label>
          <label className="block space-y-1"><span className="text-sm font-bold">{kind==='coach'?'Coach Bio (English) — optional':'Description / Caption (English) — optional'}</span><textarea className={input} rows={4} maxLength={6000} disabled={busy} value={selected.payload.body_en||''} onChange={e=>setField('body_en',e.target.value)}/></label>
          {kind==='news'&&field('date','تاريخ الخبر','date')}
          {kind==='gallery'&&<>{field('album','اسم النشاط / الألبوم (الصور التي لها نفس الاسم تظهر ضمن مجموعة واحدة)')}{field('album_en','Album / Activity Name (English) — optional')}</>}
          {(kind==='gallery'||kind==='video')&&<label className="block space-y-1">
            <span className="text-sm font-bold">الخبر المرتبط بهذا {kind==='gallery'?'الصورة':'الفيديو'} (اختياري)</span>
            <select className={input} value={selected.payload.news_id||''} disabled={busy} onChange={e=>setField('news_id',e.target.value)}>
              <option value="">بدون خبر مرتبط</option>
              {items.filter(i=>i.kind==='news').map(n=><option key={n.id} value={n.id}>{n.payload.title}</option>)}
            </select>
            <span className="text-xs text-slate-600 dark:text-slate-300">المرفق يظهر في تفاصيل الخبر عند نشر الاثنين، وليس في أخبار أخرى.</span>
          </label>}
          {kind==='coach'&&<>{field('role','التخصص / الدور')}{field('role_en','Coach Role (English) — optional')}</>}
          {field('alt','وصف الصورة للقارئ')}
          {field('alt_en','Image Alt Text (English) — optional')}
          {kind==='video'?<>{upload('video','رفع الفيديو',true)}{upload('poster','صورة غلاف الفيديو')}</>:upload('image','رفع الصورة')}
        </>}
        <label className="block space-y-1"><span className="text-sm font-bold">ترتيب الظهور (الأصغر أولًا)</span><input className={input} type="number" min={0} max={10000} value={selected.sort_order} disabled={busy} onChange={e=>{setPreview(null);setSelected({...selected,sort_order:Math.max(0,Math.min(10000,Number(e.target.value)||0))});}}/></label>
        <p className="text-xs text-slate-500 dark:text-slate-400">الملفات المرفوعة خاصة حتى نشر المحتوى. تغيير المحتوى لا يغيّر النسخة المنشورة تلقائيًا. اضغط «معاينة» بعد أي تغيير لتفعيل زر النشر.</p>
        <div className="flex flex-wrap gap-2">
          <button className={button} disabled={busy} onClick={()=>void run(async()=>{await save();setMessage('تم حفظ المسودة.');})}><Save size={16}/>حفظ مسودة</button>
          <button className={`${button} !bg-slate-600`} disabled={busy} onClick={()=>void run(async()=>{const resolved=await resolveContentMedia([selected]);if(selected.kind==='contact'&&(selected.payload.featured_image_path||selected.payload.featured_image)&&!resolved[0]?.payload.featured_image) throw new Error('تعذّر تحميل صورة لاعب الشهر للمعاينة. تأكد من صلاحيات الملف قبل النشر.');setPreview(resolved[0]);})}><Eye size={16}/>معاينة</button>
          <button className={button} disabled={busy||!canPublish} title={canPublish?'نشر النسخة التي عاينتها':'راجع النسخة الحالية بزر معاينة أولًا'} onClick={()=>void run(async()=>{if(!hasReviewedCurrentDraft(selected,preview)) throw new Error('افتح المعاينة للنسخة الحالية قبل النشر.');if(selected.kind==='contact'){const issue=featuredPlayerValidationError(selected.payload);if(issue) throw new Error(issue);}const saved=await save();await publishContent(saved!,true);await reload();setSelected(null);setPreview(null);setMessage('تم نشر المحتوى على الصفحة العامة.');})}>نشر بعد المعاينة</button>
          {!isNew&&kind!=='contact'&&published.some(p=>p.id===selected.id)&&<button className={`${button} !bg-slate-600`} disabled={busy} onClick={()=>void run(async()=>{await publishContent(selected,false);await reload();setSelected(null);setMessage('تم إخفاء المحتوى؛ المسودة محفوظة.');})}>إخفاء</button>}
          {!isNew&&<button className={`${button} !bg-slate-600`} disabled={busy} onClick={()=>void run(async()=>{setHistory(await readContentHistory(selected.id));setShowHistory(true);})}><History size={16}/>سجل النسخ</button>}
        </div>
        {preview&&<article className="space-y-2 rounded-xl border border-red-200 p-4"><h3 className="font-black">معاينة — غير منشورة</h3>{preview.payload.image&&<img className="max-h-80 w-full object-contain" src={preview.payload.image} alt={preview.payload.alt||preview.payload.title}/>}
        {preview.payload.featured_image&&<div className="academy-home"><section className="ah-hero ah-hero-featured ah-featured-preview" aria-label="معاينة واجهة لاعب الشهر"><img className="ah-hero-image" src="/parent-hero.png" alt="خلفية واجهة الأكاديمية"/><div className="ah-hero-shade"/><img className="ah-featured-cutout" style={featuredImageStyle(preview.payload)} src={preview.payload.featured_image} alt={preview.payload.featured_name||'لاعب الشهر'}/><div className="ah-hero-content"><p className="ah-eyebrow">شغف اليوم. أبطال الغد.</p><h2 className="ah-preview-heading">هنا تبدأ رحلتك الكروية</h2><aside className="ah-featured-honor"><span>{preview.payload.featured_heading||'لاعب الشهر'}</span><strong>{preview.payload.featured_name}</strong><p>{preview.payload.featured_body}</p></aside></div></section></div>} {preview.payload.video&&<video className="max-h-80 w-full" controls playsInline src={preview.payload.video} poster={preview.payload.poster}/>}<h4 className="font-bold">{preview.payload.title}</h4><p className="whitespace-pre-wrap">{preview.payload.body}</p>{kind==='contact'&&contacts.map(c=><p className="break-all" key={c}>{c}: {preview.payload[c]}</p>)}{(preview.payload.title_en||preview.payload.body_en||preview.payload.featured_heading_en||preview.payload.featured_body_en)&&<section lang="en" dir="ltr" className="rounded-xl border border-slate-400 p-3 text-start"><h4 className="font-bold">English text preview</h4><strong>{preview.payload.title_en||preview.payload.featured_heading_en}</strong><p>{preview.payload.body_en||preview.payload.featured_body_en}</p></section>}</article>}
        {showHistory&&<div className="space-y-2"><h3 className="font-bold">النسخ السابقة — الاسترجاع يحفظ كمسودة</h3>{history.map(h=><div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"><span>نسخة {h.version} · {new Date(h.changed_at).toLocaleString('ar-BH')} · {h.action} · {h.changed_by ? staff.find(s=>s.userId===h.changed_by)?.name || 'الإدارة' : 'محتوى أولي'}</span><button className={button} disabled={busy} onClick={()=>void run(async()=>{const saved=await saveContent({...selected,payload:h.payload,sort_order:h.sort_order},false);setPreview(null);setSelected(saved);setHistory(await readContentHistory(selected.id));await reload();setMessage('تم استرجاع النسخة كمسودة. اضغط نشر لاعتمادها.');})}>استرجاع كمسودة</button></div>)}</div>}
      </div>:<div className={box}>اختر محتوى للتعديل، أو أضف محتوى جديدًا.</div>}
    </div>
  </section>;
}
