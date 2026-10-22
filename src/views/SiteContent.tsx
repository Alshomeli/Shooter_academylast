import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Eye, Upload, History, Globe, Sparkles, Film } from 'lucide-react';
import { PhotoVideoStudio } from '@/components/PhotoVideoStudio';
import { askManagementAI } from '@/lib/ai-assistant';
import type { Lang, Role, Staff } from '@/types';
import { publishContent, readContentHistory, readManagerContent, resolveContentMedia, saveContent, uploadContentFile, type ContentItem, type ContentKind, type ContentRevision } from '@/lib/site-content';
import { featuredImageStyle, featuredPlayerValidationError } from '@/lib/featured-player';
import { hasReviewedCurrentDraft } from '@/lib/content-review';
import { programImages } from '@/data/public-academy';
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
  const [aiProposal,setAiProposal]=useState('');
  const [aiBusy,setAiBusy]=useState(false);
  const [aiTask,setAiTask]=useState<'improve'|'article'|'social'|'seo'|'translate'|'script'>('improve');
  const [aiInstructions,setAiInstructions]=useState('');
  const [aiTarget,setAiTarget]=useState<'about_body'|'programs_intro'|'featured_body'|'body'>('body');
  const [aiWorkspaceReply,setAiWorkspaceReply]=useState('');
  const [aiWorkspaceBusy,setAiWorkspaceBusy]=useState(false);
  useEffect(()=>{setAiWorkspaceReply('');setAiInstructions('');},[selected?.id]);
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
  const askContentWriter=async(prompt:string)=> {
    const result=await askManagementAI('communication',prompt,lang);
    if(result.provider!=='gemini') throw new Error(lang==='ar'?'خدمة إنشاء المحتوى غير متاحة الآن. لم يتم إنشاء مقترح.':'Content generation is unavailable; no draft was created.');
    return result.reply;
  };
  const generateNewsDraft=async()=> {
    if(!selected || selected.kind!=='news') return;
    if(!selected.payload.title?.trim() || !selected.payload.body?.trim()) {
      setError(ar?'أدخل عنوان الخبر ووقائعه الأساسية أولًا.':'Enter a headline and factual event details first.');
      return;
    }
    setAiBusy(true);setError('');setAiProposal('');
    try {
      const prompt = [
        'You are editing a football academy news release for search discoverability.',
        'Write in '+(ar?'Arabic':'English')+'. Only use facts present in the following source. Do not invent names, results, dates, prizes, quotations or claims.',
        'Return a suggested SEO headline, a concise meta description (maximum 160 characters), a readable news body and suggested search phrases.',
        'Avoid keyword stuffing, clickbait, and unsupported claims. Use explicit headings.',
        'Source headline: '+selected.payload.title,
        'Source event facts: '+selected.payload.body,
        'Date: '+(selected.payload.date||'not provided'),
      ].join('\\n');
      const reply=await askContentWriter(prompt);
      setAiProposal(reply);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setAiBusy(false);}
  };
  const generateFeaturedDraft=async()=> {
    if(!selected || selected.kind!=='contact') return;
    const person=selected.payload.featured_name?.trim();
    const facts=selected.payload.featured_body?.trim();
    if(!person || !facts) {setError(ar?'أدخل اسم اللاعب وسبب تكريمه أولًا.':'Enter the player name and verified recognition details first.');return;}
    setAiBusy(true);setError('');setAiProposal('');
    try {
      const prompt=[
        'Draft a concise, warm public football academy Player of the Month recognition in '+(ar?'Arabic':'English')+'.',
        'Use ONLY the confirmed details supplied; never invent names, performances, prizes, statistics or quotations.',
        'Return a short recognition heading, a 2-3 sentence popup caption, a short news-ready paragraph and a natural search-friendly title. No keyword stuffing.',
        'Player: '+person, 'Verified reasons: '+facts,
      ].join('\\n');
      const reply=await askContentWriter(prompt);
      setAiProposal(reply);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setAiBusy(false);}
  };
  const generateComponentCopy=async()=> {
    if(!selected || aiWorkspaceBusy) return;
    const target=selected.kind==='contact'?(aiTarget==='body'?'about_body':aiTarget):'body';
    const source=[selected.payload.title, selected.payload[target], selected.kind==='contact'&&target==='featured_body'?selected.payload.featured_name:''].filter(Boolean).join('\\n');
    if(!source.trim()&&!aiInstructions.trim()){
      setError(ar?'أدخل نصًا في المكون أو ملاحظات للمساعد أولًا.':'Enter component text or instructions first.');
      return;
    }
    const task:{[key in typeof aiTask]:string}={
      improve:'Improve clarity, tone, and grammar without changing verified facts.',
      article:'Draft a structured article with an appropriate headline, short introduction and clear sections.',
      social:'Draft concise social media copy and a suitable caption without invented hashtags or claims.',
      seo:'Suggest an SEO title, meta description (maximum 160 characters), natural headings and alt-text when relevant.',
      translate:'Translate the provided text accurately into the other language (Arabic or English), keeping proper names.',
      script:'Prepare a short video storyboard and voiceover script using only supplied facts and imagery descriptions.'
    };
    setAiWorkspaceBusy(true);setError('');setAiWorkspaceReply('');
    try{
      const response=await askContentWriter([
        'You are the Shooter Academy content editor for the manager dashboard.',
        'Task: '+task[aiTask],
        'Respond in '+(aiTask==='translate'?(ar?'English':'Arabic'):(ar?'Arabic':'English'))+'.',
        'Use only facts supplied by the manager; never invent results, ages, identities, awards, statistics or testimonials.',
        'Do not create or claim actual video, images, publication, or approved consent.',
        'Do not disclose private player or family information. Do not request sensitive data.',
        'Content category: '+selected.kind,
        'Existing content: '+(source.slice(0,420)||'No existing text'),
        'Manager instructions: '+(aiInstructions.slice(0,290)||'No additional instructions'),
        'Return only the proposed material, for manual review.'
      ].join('\\n'));
      setAiWorkspaceReply(response.slice(0,6000));
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setAiWorkspaceBusy(false);}
  };
  const defaultPrograms = [
    {title:'تطوير المهارات',body:'التحكم بالكرة، التمرير، والمراوغة. أساس قوي يمنح اللاعب ثقة أكبر في كل لمسة.',image:programImages[0]},
    {title:'اللياقة البدنية',body:'تنمية القوة والتحمل والمرونة، لبناء جاهزية بدنية تدعم أداء اللاعب في الملعب.',image:programImages[1]},
    {title:'إنهاء الهجمات',body:'تطوير دقة التسديد والتحرك أمام المرمى، وتعزيز الثقة عند اتخاذ القرار.',image:programImages[2]}
  ];
  type Program = {title:string;title_en?:string;body:string;body_en?:string;image:string;image_path?:string};
  const currentPrograms=():Program[]=>{
    if(!selected) return [];
    if(selected.payload.programs_v1===undefined) return defaultPrograms;
    try { const data:unknown=JSON.parse(selected.payload.programs_v1); return Array.isArray(data)?data as Program[]:[]; }catch{return [];}
  };
  const updatePrograms=(rows:Program[])=>setField('programs_v1',JSON.stringify(rows));
  const programField=(p:Program,i:number,key:keyof Program,label:string)=><label className="block space-y-1"><span className="text-sm font-bold">{label}</span><input className={input} value={p[key]||''} disabled={busy} onChange={e=>{const rows=currentPrograms().map(row=>({...row}));rows[i][key]=e.target.value;updatePrograms(rows);}}/></label>;
  const field=(name:string,label:string,type='text')=><label className="block space-y-1" key={name}><span className="text-sm font-bold">{label}</span><input className={input} type={type} maxLength={name==='title'?200:1000} value={selected?.payload[name]||''} onChange={e=>setField(name,e.target.value)} disabled={busy}/></label>;
  const upload=(name:string,label:string,video=false)=><label className="block space-y-2"><span className="flex items-center gap-2 text-sm font-bold"><Upload size={16}/>{label}</span><input type="file" accept={video?'video/mp4':'image/jpeg,image/png,image/webp'} disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{const path=await uploadContentFile(file,video);setPreview(null);setSelected(s=>s?{...s,payload:{...s.payload,[`${name}_path`]:path,[name]:''}}:s);setMessage('تم رفع الملف. احفظ المسودة لربطه بالمحتوى.');});e.target.value='';}}/><p className="text-xs text-slate-500 dark:text-slate-400">{selected?.payload[`${name}_path`]?'ملف مرفوع':selected?.payload[name]?'ملف من الموقع الحالي':video?'MP4 · 20 MB':'JPG / PNG / WebP · 5 MB'}</p></label>;
  return <section className="space-y-5" dir={ar?'rtl':'ltr'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{ar?'إدارة الموقع':'Website content'}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ar?'المسودات خاصة. التعديلات تظهر للزوار بعد النشر فقط.':'Drafts are private. Visitors see changes only after publishing.'}</p></div><a href="/" target="_blank" rel="noopener noreferrer" className={button}><Globe size={16}/>{ar?'فتح الموقع':'Open website'}</a></div>
    <div className="grid grid-cols-2 gap-3"><div className={box}>{ar?'منشور':'Published'} <b>{published.length}</b></div><div className={box}>{ar?'غير منشور':'Unpublished'} <b>{items.filter(i=>!published.some(p=>p.id===i.id)).length}</b></div></div>
    {error&&<div role="alert" className="rounded-lg bg-red-100 p-3 text-red-900">{error}<button className="ms-3 underline" onClick={()=>void reload()}>{ar?'إعادة التحميل':'Reload'}</button></div>}
    {message&&<p role="status" className="rounded-lg bg-green-100 p-3 text-green-900">{message}</p>}
    <nav className="flex flex-wrap gap-2" aria-label="أقسام المحتوى">{kinds.map(k=><button key={k.kind} disabled={busy} onClick={()=>{setKind(k.kind);setSelected(null);setPreview(null);setAiProposal('');setShowHistory(false);}} className={`${button} ${kind!==k.kind?'!bg-slate-600':''}`}>{ar?k.ar:k.en}</button>)}<button type="button" disabled={busy} className={`${button} !bg-slate-800 dark:!bg-slate-700`} onClick={()=>{setKind('news');setSelected({id:crypto.randomUUID(),kind:'news',payload:{},sort_order:items.length,version:1});setIsNew(true);setPreview(null);setAiProposal('');setShowHistory(false);}}><Sparkles size={16}/>{ar?'المكونات / أدوات الكتابة الذكية':'Components / AI writing tools'}</button><button type="button" disabled={busy} className={`${button} !bg-slate-800 dark:!bg-slate-700`} onClick={()=>{setKind('video');setSelected({id:crypto.randomUUID(),kind:'video',payload:{},sort_order:items.length,version:1});setIsNew(true);setPreview(null);setAiProposal('');setShowHistory(false);}}><Film size={16}/>{ar?'المكونات / أدوات إنشاء الفيديو':'Components / Video creation tools'}</button></nav>
    <div className="grid gap-5 lg:grid-cols-[minmax(230px,1fr)_2fr]">
      <div className={`${box} space-y-3`}><button className={`${button} w-full`} disabled={busy||loading||kind==='contact'&&items.some(i=>i.kind==='contact')} onClick={()=>{setSelected({id:crypto.randomUUID(),kind,payload:{},sort_order:items.length,version:1});setIsNew(true);setPreview(null);setShowHistory(false);}}><Plus size={16}/>{ar?'إضافة محتوى':'Add content'}</button>
        {loading?<p role="status">{ar?'جارٍ التحميل…':'Loading…'}</p>:items.filter(i=>i.kind===kind).map(i=><button className={`${input} text-start ${selected?.id===i.id?'!border-red-600':''}`} disabled={busy} key={i.id} onClick={()=>{setSelected({...i,payload:{...i.payload}});setIsNew(false);setPreview(null);setShowHistory(false);}}><b className="block truncate">{i.payload.title||'روابط التواصل'}</b><span className="text-xs">{published.some(p=>p.id===i.id)?'منشور':'مسودة / مخفي'} · {i.sort_order}</span></button>)}
        {!loading&&!items.some(i=>i.kind===kind)&&<p className="text-sm">{ar?'لا يوجد محتوى في هذا القسم.':'No content in this section.'}</p>}
      </div>
      {selected?<div className={`${box} space-y-4`} key={selected.id}>
        <section id="ai-content-components" className="space-y-3 rounded-xl border border-red-300 p-4 dark:border-red-800" aria-label={ar?'المكونات الذكية لتحرير المحتوى':'AI content components'}>
          <h3 className="flex items-center gap-2 font-black"><Sparkles size={18}/>{ar?'المكونات / مساعد الذكاء الاصطناعي':'Components / AI content assistant'}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">{ar?'للنصوص والمقالات والإعلانات والترجمة وتحسين البحث وسيناريو الفيديو. الاقتراح للمراجعة فقط؛ لا حفظ أو نشر تلقائيًا.':'For copy, articles, social posts, SEO, translation and video scripts. Suggestions require review; nothing saves or publishes automatically.'}</p>
          {selected.kind==='contact'&&<label className="block space-y-1 text-sm font-bold">{ar?'اختر الباكيت الذي ستُعدّل نصه':'Select the section to edit'}
            <select className={input} value={aiTarget==='body'?'about_body':aiTarget} disabled={busy||aiWorkspaceBusy} onChange={e=>{setAiTarget(e.target.value as typeof aiTarget);setAiWorkspaceReply('');}}>
              <option value="about_body">{ar?'01 / عن الأكاديمية':'01 / About the academy'}</option>
              <option value="programs_intro">{ar?'02 / البرامج التدريبية':'02 / Training programs'}</option>
              <option value="featured_body">{ar?'لاعب الشهر':'Player of the Month'}</option>
            </select>
          </label>}
          <label className="block space-y-1 text-sm font-bold">{ar?'نوع المهمة':'Task'}
            <select className={input} value={aiTask} disabled={aiWorkspaceBusy||busy} onChange={e=>setAiTask(e.target.value as typeof aiTask)}>
              <option value="improve">{ar?'تحسين وإعادة صياغة':'Rewrite and improve'}</option>
              <option value="article">{ar?'مقال احترافي':'Article'}</option>
              <option value="social">{ar?'إعلان ومنشور تواصل':'Social media post'}</option>
              <option value="seo">{ar?'تحسين محركات البحث':'SEO metadata'}</option>
              <option value="translate">{ar?'ترجمة عربية / إنجليزية':'Arabic / English translation'}</option>
              <option value="script">{ar?'سيناريو فيديو وتعليق صوتي':'Video script and voiceover'}</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm font-bold">{ar?'معلوماتك أو تعليماتك الإضافية (اختياري)':'Additional facts or instructions (optional)'}
            <textarea className={input} rows={3} maxLength={3000} disabled={aiWorkspaceBusy||busy} value={aiInstructions} onChange={e=>setAiInstructions(e.target.value)}/>
          </label>
          <button type="button" className={button} disabled={aiWorkspaceBusy||busy} onClick={()=>void generateComponentCopy()}><Sparkles size={16}/>{aiWorkspaceBusy?(ar?'جارٍ إعداد المقترح…':'Preparing suggestion…'):(ar?'اقترح المحتوى':'Generate suggestion')}</button>
          {aiWorkspaceReply&&<div className="space-y-2">
            <label className="block text-sm font-bold">{ar?'المقترح القابل للتحرير — غير منشور':'Editable proposal — not published'}
              <textarea className={input} rows={8} maxLength={6000} value={aiWorkspaceReply} onChange={e=>setAiWorkspaceReply(e.target.value)}/>
            </label>
            <button type="button" className={button} disabled={busy} onClick={()=>{
              setField(selected.kind==='contact'?(aiTarget==='body'?'about_body':aiTarget):'body',aiWorkspaceReply.slice(0,selected.kind==='contact'&&aiTarget==='featured_body'?1800:6000));
              setMessage(ar?'نُقل المقترح إلى حقل النص فقط. راجعه قبل حفظ المسودة.':'Text moved to the editor only. Review before saving the draft.');
              setAiWorkspaceReply('');
            }}>{ar?'نقل المقترح إلى محرر النص':'Use proposal in text editor'}</button>
            <p className="text-xs text-slate-600 dark:text-slate-300">{ar?'يمكنك مراجعة النص يدويًا. لا تعتمد معلومات غير موثقة عن اللاعبين.':'Review facts manually. Do not include unverified player information.'}</p>
          </div>}
        </section>
        {kind==='contact'?<>
          <nav aria-label={ar?'أقسام الصفحة الرئيسية':'Homepage sections'} className="rounded-xl border border-slate-300 p-3 dark:border-slate-700">
            <h3 className="mb-2 font-black">{ar?'أقسام الصفحة الرئيسية — بنفس ترتيب العرض':'Homepage sections — display order'}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['01','عن الأكاديمية','About the academy','home-section-about'],
                ['02','البرامج التدريبية','Training programs','home-section-programs'],
                ['03','التدريب والتوجيه','Training and guidance','home-section-guidance'],
                ['04','من قلب الملعب','From the field','home-section-field'],
                ['05','أخبار شوتر','Shooter news','home-section-news'],
                ['06','نلتقي في الملعب','Meet on the field','home-section-contact'],
              ].map(([number,labelAr,labelEn,target])=><a key={number} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold hover:border-red-600 dark:border-slate-700" href={target==='home-section-news'?'#site-news-editor':target==='home-section-field'?'#site-gallery-editor':'#'+target} onClick={()=>{if(target==='home-section-news'||target==='home-section-field'){setKind(target==='home-section-news'?'news':'gallery');setSelected(null);setPreview(null);}}}>{number} / {ar?labelAr:labelEn}</a>)}
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{ar?'الأقسام ذات المحتوى المستقل تفتح محررها من القائمة. تغيير الصور لا يعيد ترتيب البطاقات.':'Sections with separate content open their editor. Replacing images never reorders cards.'}</p>
          </nav>
          <section id="home-section-about" className="scroll-mt-24 space-y-3 rounded-xl border border-red-300 p-4">
            <h3 className="font-black text-lg">01 / عن الأكاديمية — إدارة النصوص</h3>
            <p className="text-xs">يمكنك تغيير أو إفراغ النصوص ثم حفظ المسودة ونشرها. النص الإنجليزي اختياري.</p>
            {field('about_title','عنوان القسم 01')}
            {field('about_title_en','Section 01 title (English)')}
            {field('about_body','الوصف الرئيسي')}
            {field('about_body_en','Main description (English)')}
            {field('about_extra','الفقرة الإضافية')}
            {field('about_extra_en','Additional paragraph (English)')}
          </section>
          <section id="home-section-programs" className="scroll-mt-24 space-y-3 rounded-xl border border-red-300 p-4">
            <h3 className="font-black text-lg">02 / برامجنا التدريبية — إدارة البطاقات</h3>
            {field('programs_title','عنوان قسم البرامج')}
            {field('programs_title_en','Programs title (English)')}
            {field('programs_intro','وصف قسم البرامج')}
            {field('programs_intro_en','Programs description (English)')}
            {currentPrograms().map((p,i)=><div key={i} className="space-y-2 rounded-xl border border-slate-300 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><b>برنامج {i+1} — ترتيبه ثابت حتى تغيّره يدويًا</b><div className="flex flex-wrap gap-3"><button type="button" disabled={busy||i===0} className="underline disabled:opacity-40" onClick={()=>{const rows=currentPrograms();[rows[i-1],rows[i]]=[rows[i],rows[i-1]];updatePrograms(rows);}}>↑ لأعلى</button><button type="button" disabled={busy||i===currentPrograms().length-1} className="underline disabled:opacity-40" onClick={()=>{const rows=currentPrograms();[rows[i+1],rows[i]]=[rows[i],rows[i+1]];updatePrograms(rows);}}>↓ لأسفل</button><button type="button" disabled={busy} className="text-red-700 underline" onClick={()=>updatePrograms(currentPrograms().filter((_,j)=>j!==i))}>حذف البطاقة</button></div></div>
              {programField(p,i,'title','اسم البرنامج')}
              {programField(p,i,'title_en','Program name (English)')}
              {programField(p,i,'body','الوصف')}
              {programField(p,i,'body_en','Description (English)')}
              {programField(p,i,'image','رابط الصورة HTTPS أو مسار موقع محلي')}
              <label className="block text-sm font-bold">رفع صورة جديدة
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{const path=await uploadContentFile(file,false);const rows=currentPrograms().map(row=>({...row}));rows[i].image_path=path;rows[i].image='';updatePrograms(rows);setMessage('تم رفع الصورة؛ احفظ المسودة ثم انشرها.');});e.target.value='';}}/>
              </label>
              {p.image_path&&<p className="text-xs">صورة مرفوعة في التخزين: {p.image_path}</p>}
            </div>)}
            <button className={button} type="button" disabled={busy||currentPrograms().length>=12} onClick={()=>updatePrograms([...currentPrograms(),{title:'برنامج جديد',body:'',image:''}])}><Plus size={16}/>إضافة برنامج جديد</button>
            <p className="text-xs text-slate-600 dark:text-slate-300">استبدال صورة البرنامج لا يغير موقع البطاقة أو ترتيبها؛ استخدم أسهم النقل فقط إذا أردت تغيير ترتيب البرامج. حذف البطاقة يزيلها من الصفحة بعد النشر فقط، ولا يمسح الصور من التخزين أو النسخ السابقة. حد أقصى 12 برنامجاً.</p>
          </section>
          <section id="home-section-guidance" className="scroll-mt-24 rounded-xl border border-slate-300 p-3 dark:border-slate-700"><h3 className="font-black">03 / التدريب والتوجيه</h3><p className="text-sm">هذا القسم لا يملك حقول تحرير مستقلة بعد؛ سيظل محتواه الحالي كما هو حتى إضافة دعم آمن له.</p></section>

          <h3 id="home-section-contact" className="scroll-mt-24 font-black text-lg">06 / نلتقي في الملعب — روابط التواصل</h3>
          {contacts.map(c=>field(c,c,'url'))}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <h3 className="font-black text-lg">لاعب الشهر — بطاقة التكريم</h3>
            <label className="flex items-center gap-2 rounded-xl border border-amber-400 p-3 text-sm font-bold dark:border-amber-700">
              <input type="checkbox" checked={selected.payload.featured_enabled!=='false'} disabled={busy} onChange={e=>setField('featured_enabled',e.target.checked?'true':'false')}/>
              {ar?'إظهار تكريم لاعب الشهر ونافذة Pop-up':'Show Player of the Month and pop-up'}
            </label>
            <p className="text-xs text-slate-600 dark:text-slate-300">{ar?'لإزالة النافذة من الموقع، ألغِ العلامة ثم احفظ المسودة واضغط معاينة ثم نشر. ستظل الصورة محفوظة لاستعمالها لاحقًا، ولن تُحذف من التخزين.':'To hide the pop-up, uncheck this option, save, preview, then publish. The uploaded image is retained.'}</p>
            {(selected.payload.featured_image_path||selected.payload.featured_image)&&<div className="rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700">
              <p className="font-bold">{ar?'الصورة الحالية للاعب الشهر':'Current featured player image'}</p>
              <p className="break-all text-xs">{selected.payload.featured_image_path||selected.payload.featured_image}</p>
              <button type="button" className="mt-2 rounded-lg border border-red-600 px-3 py-2 text-red-700 dark:text-red-300" disabled={busy} onClick={()=>{setField('featured_image_path','');setField('featured_image','');}}>{ar?'فصل الصورة عن التكريم (بدون حذف الملف)':'Detach image without deleting file'}</button>
            </div>}
            <p className="text-xs text-slate-600 dark:text-slate-300">تظل خلفية الواجهة ثابتة، وتظهر فوقها صورة اللاعب الشفافة فقط بعد نشر اسمه وصورته. استخدم PNG أو WebP بخلفية شفافة.</p>
            {field('featured_name','اسم اللاعب')}
            <label className="block space-y-1 text-sm font-bold"><span>{ar?'معرّف اللاعب الرسمي (اختياري للتهنئة الخاصة)':'Official player ID (optional for private congratulations)'}</span>
              <input className={input} type="text" maxLength={100} value={selected.payload.featured_player_id||''} disabled={busy} onChange={e=>setField('featured_player_id',e.target.value)}/>
              <span className="text-xs font-normal">{ar?'يجب استخدام معرّف اللاعب نفسه من إدارة اللاعبين؛ لا نستخدم تشابه الأسماء لتحديد ولي الأمر.':'Copy the exact player ID from player management; names are never used to determine the guardian.'}</span>
            </label>
            <label className="block space-y-1 text-sm font-bold"><span>{ar?'فيديو التكريم المنشور (اختياري)':'Published recognition video (optional)'}</span>
              <select className={input} value={selected.payload.featured_video_id||''} disabled={busy} onChange={e=>setField('featured_video_id',e.target.value)}>
                <option value="">{ar?'بدون فيديو':'No video'}</option>
                {items.filter(i=>i.kind==='video'&&published.some(p=>p.id===i.id)).map(i=><option key={i.id} value={i.id}>{i.payload.title||i.id}</option>)}
              </select>
            </label>
            {field('featured_name_en','Player Name (English) — optional')}
            {field('featured_heading','عنوان بطاقة التكريم')}
            {field('featured_heading_en','Recognition Title (English) — optional')}
            <label className="block space-y-1"><span className="text-sm font-bold">نبذة وسبب التميز</span><textarea className={input} rows={3} maxLength={1800} disabled={busy} value={selected.payload.featured_body||''} onChange={e=>setField('featured_body',e.target.value)}/></label>
            <label className="block space-y-1"><span className="text-sm font-bold">Recognition Reason (English) — optional</span><textarea className={input} rows={3} maxLength={1800} disabled={busy} value={selected.payload.featured_body_en||''} onChange={e=>setField('featured_body_en',e.target.value)}/></label>
            <div className="space-y-2 rounded-lg border border-slate-300 p-3 dark:border-slate-700">
              <p className="text-sm font-bold">{ar?'مساعد ذكي لصياغة تكريم لاعب الشهر':'AI Player of the Month writing assistant'}</p>
              <button type="button" className={button} disabled={busy||aiBusy||!selected.payload.featured_name?.trim()||!selected.payload.featured_body?.trim()} onClick={()=>void generateFeaturedDraft()}><Sparkles size={16}/>{aiBusy?(ar?'جارٍ الاقتراح…':'Generating…'):(ar?'صياغة تكريم احترافي':'Suggest recognition text')}</button>
              {aiProposal&&<><textarea className={input} rows={6} aria-label={ar?'النص المقترح للمراجعة':'Review proposed text'} maxLength={6000} value={aiProposal} onChange={e=>setAiProposal(e.target.value)}/><p className="text-xs">{ar?'اقتراح للمراجعة فقط، لا يُحفظ أو يُنشر تلقائيًا. انسخ النص المناسب إلى الحقول بعد التحقق من الوقائع.':'Review only. Nothing is saved or published automatically; copy verified text into the appropriate fields.'}</p><button type="button" className={button} onClick={()=>{setField('featured_body',aiProposal);setAiProposal('');}}>{ar?'نقل النص إلى نبذة اللاعب':'Use as player description'}</button></>}
            </div>
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
          {kind==='news'&&<section className="rounded-xl border border-red-300 dark:border-red-800 p-3 space-y-3">
            <div><h4 className="font-black flex items-center gap-2"><Sparkles size={17}/>{ar?'مساعد صياغة الخبر لمحركات البحث':'SEO news writing assistant'}</h4>
              <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">{ar?'اكتب الوقائع في الوصف أعلاه، ثم اطلب اقتراحًا وراجعه. لا تُحفظ الاقتراحات تلقائيًا ولا تُنشر.':'Enter facts above, generate a suggestion, and review it. AI drafts are neither saved nor published automatically.'}</p></div>
            <button type="button" className={button} disabled={busy||aiBusy||!selected.payload.title?.trim()||!selected.payload.body?.trim()} onClick={()=>void generateNewsDraft()}><Sparkles size={16}/>{aiBusy?(ar?'جارٍ الإنشاء…':'Generating…'):(ar?'اقتراح خبر احترافي':'Suggest SEO news copy')}</button>
            {aiProposal&&<div className="space-y-2"><label className="text-sm font-bold block" htmlFor="ai-news-proposal">{ar?'المقترح للمراجعة (غير منشور)':'Draft suggestion (not published)'}</label>
              <textarea id="ai-news-proposal" className={input} rows={10} value={aiProposal} onChange={e=>setAiProposal(e.target.value)} maxLength={6000}/>
              <button type="button" className={button} disabled={busy} onClick={()=>{setField('body',aiProposal);setAiProposal('');setMessage(ar?'تم نقل المقترح إلى الوصف للمراجعة. احفظ المسودة بعد التأكد من صحة الوقائع.':'Suggestion moved into the editor for review. Verify facts before saving.');}}>{ar?'نقل المقترح إلى الوصف':'Use suggestion in editor'}</button>
            </div>}
          </section>}
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
          {kind==='video'?<><div id="video-components" className="scroll-mt-24"><PhotoVideoStudio lang={lang} onMp4={async file => { await run(async()=>{ const path=await uploadContentFile(file,true);setPreview(null);setSelected(s=>s?{...s,payload:{...s.payload,video_path:path,video:''}}:s);setMessage('تم إنشاء الفيديو ورفعه. احفظ المسودة ثم عاينها قبل النشر.'); }); }}/></div>{upload('video','رفع الفيديو',true)}{upload('poster','صورة غلاف الفيديو')}</>:upload('image','رفع الصورة')}
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
        {preview.payload.featured_enabled!=='false'&&preview.payload.featured_image&&<div className="academy-home"><section className="ah-hero ah-hero-featured ah-featured-preview" aria-label="معاينة واجهة لاعب الشهر"><img className="ah-hero-image" src="/parent-hero.png" alt="خلفية واجهة الأكاديمية"/><div className="ah-hero-shade"/><img className="ah-featured-cutout" style={featuredImageStyle(preview.payload)} src={preview.payload.featured_image} alt={preview.payload.featured_name||'لاعب الشهر'}/><div className="ah-hero-content"><p className="ah-eyebrow">شغف اليوم. أبطال الغد.</p><h2 className="ah-preview-heading">هنا تبدأ رحلتك الكروية</h2><aside className="ah-featured-honor"><span>{preview.payload.featured_heading||'لاعب الشهر'}</span><strong>{preview.payload.featured_name}</strong><p>{preview.payload.featured_body}</p></aside></div></section></div>} {preview.payload.video&&<video className="max-h-80 w-full" controls playsInline src={preview.payload.video} poster={preview.payload.poster}/>}<h4 className="font-bold">{preview.payload.title}</h4><p className="whitespace-pre-wrap">{preview.payload.body}</p>{kind==='contact'&&contacts.map(c=><p className="break-all" key={c}>{c}: {preview.payload[c]}</p>)}{(preview.payload.title_en||preview.payload.body_en||preview.payload.featured_heading_en||preview.payload.featured_body_en)&&<section lang="en" dir="ltr" className="rounded-xl border border-slate-400 p-3 text-start"><h4 className="font-bold">English text preview</h4><strong>{preview.payload.title_en||preview.payload.featured_heading_en}</strong><p>{preview.payload.body_en||preview.payload.featured_body_en}</p></section>}</article>}
        {showHistory&&<div className="space-y-2"><h3 className="font-bold">النسخ السابقة — الاسترجاع يحفظ كمسودة</h3>{history.map(h=><div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"><span>نسخة {h.version} · {new Date(h.changed_at).toLocaleString('ar-BH')} · {h.action} · {h.changed_by ? staff.find(s=>s.userId===h.changed_by)?.name || 'الإدارة' : 'محتوى أولي'}</span><button className={button} disabled={busy} onClick={()=>void run(async()=>{const saved=await saveContent({...selected,payload:h.payload,sort_order:h.sort_order},false);setPreview(null);setSelected(saved);setHistory(await readContentHistory(selected.id));await reload();setMessage('تم استرجاع النسخة كمسودة. اضغط نشر لاعتمادها.');})}>استرجاع كمسودة</button></div>)}</div>}
      </div>:<div className={box}>اختر محتوى للتعديل، أو أضف محتوى جديدًا.</div>}
    </div>
  </section>;
}
