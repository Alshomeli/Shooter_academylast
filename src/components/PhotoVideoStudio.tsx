import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Film, ImagePlus, Play, Trash2 } from 'lucide-react';

type Layout = 'landscape' | 'portrait' | 'square';
type Style = 'highlights' | 'award' | 'news';
type Transition = 'fade' | 'cut';
type Slide = { id: string; file: File; url: string; caption: string };
const sizes: Record<Layout, { width: number; height: number }> = {
  landscape: { width: 960, height: 540 },
  portrait: { width: 540, height: 960 },
  square: { width: 720, height: 720 },
};
const accents: Record<Style, string> = { highlights: '#da1728', award: '#d9b45b', news: '#d91e30' };
const MAX_PHOTOS = 15;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function PhotoVideoStudio({ onMp4, lang = 'ar' }: { onMp4: (file: File) => Promise<void>; lang?: 'ar' | 'en' }) {
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const [slides, setSlides] = useState<Slide[]>([]);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [seconds, setSeconds] = useState(3);
  const [music, setMusic] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [layout, setLayout] = useState<Layout>('landscape');
  const [style, setStyle] = useState<Style>('highlights');
  const [transition, setTransition] = useState<Transition>('fade');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [introOutro, setIntroOutro] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState('');
  const [output, setOutput] = useState<{ url: string; file: File } | null>(null);
  const [error, setError] = useState('');
  const slidesRef = useRef<Slide[]>([]);
  const outputRef = useRef<string | null>(null);

  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => () => {
    slidesRef.current.forEach(s => URL.revokeObjectURL(s.url));
    if (outputRef.current) URL.revokeObjectURL(outputRef.current);
  }, []);
  // A previously exported file must never be uploaded after the storyboard has changed.
  useEffect(() => {
    if (outputRef.current) {
      URL.revokeObjectURL(outputRef.current);
      outputRef.current = null;
      setOutput(null);
      setProgress('');
    }
  }, [slides, title, caption, seconds, music, logo, layout, style, transition, fit, introOutro]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const valid = incoming.filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024);
    if (incoming.length !== valid.length) {
      setError(t('بعض الصور غير مدعومة أو تتجاوز 5 ميغابايت.', 'Some images are unsupported or exceed 5 MB.'));
    } else setError('');
    if (slides.length + valid.length > MAX_PHOTOS) {
      setError(t('الحد الأقصى 15 صورة لكل فيديو.', 'Maximum 15 images per video.'));
      return;
    }
    setSlides(old => [...old, ...valid.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), caption: '' }))]);
  };
  const move = (index: number, direction: number) => {
    setSlides(old => {
      const target = index + direction;
      if (target < 0 || target >= old.length) return old;
      const copy = [...old];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };
  const updateCaption = (id: string, value: string) =>
    setSlides(old => old.map(slide => slide.id === id ? { ...slide, caption: value } : slide));

  const makeVideo = async () => {
    if (rendering || slides.length < 2) return;
    const mimeType = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm']
      .find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
    if (!mimeType || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
      setError(t('متصفحك لا يدعم التصدير المباشر. جرّب Chrome أو Edge على الكمبيوتر.', 'This browser does not support direct recording. Try Chrome or Edge on desktop.'));
      return;
    }
    setRendering(true);
    setError('');
    setProgress(t('تحضير الصور', 'Preparing images'));
    const size = sizes[layout];
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setRendering(false);
      setError(t('تعذّر إنشاء لوحة الفيديو.', 'Could not create the video canvas.'));
      return;
    }
    const stream = canvas.captureStream(24);
    let audioContext: AudioContext | undefined;
    let musicElement: HTMLAudioElement | undefined;
    let musicUrl: string | undefined;
    let logoUrl: string | undefined;
    try {
      const images = await Promise.all(slides.map(async slide => {
        const img = new Image();
        img.src = slide.url;
        await img.decode();
        return img;
      }));
      let logoImage: HTMLImageElement | undefined;
      if (logo) {
        logoUrl = URL.createObjectURL(logo);
        logoImage = new Image();
        logoImage.src = logoUrl;
        await logoImage.decode();
      }
      if (music) {
        audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        musicUrl = URL.createObjectURL(music);
        musicElement = new Audio(musicUrl);
        musicElement.loop = true;
        musicElement.volume = 0.25;
        const source = audioContext.createMediaElementSource(musicElement);
        source.connect(destination);
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        await audioContext.resume();
        await musicElement.play();
      }
      const accent = accents[style];
      const drawImage = (img: HTMLImageElement, fraction: number) => {
        const basicScale = (fit === 'cover' ? Math.max : Math.min)(size.width / img.width, size.height / img.height);
        const zoom = 1 + 0.045 * fraction;
        const width = img.width * basicScale * zoom;
        const height = img.height * basicScale * zoom;
        ctx.drawImage(img, (size.width - width) / 2, (size.height - height) / 2, width, height);
      };
      const drawLogo = () => {
        if (logoImage) {
          const factor = Math.min(86 / logoImage.width, 72 / logoImage.height);
          const w = logoImage.width * factor, h = logoImage.height * factor;
          ctx.drawImage(logoImage, size.width - w - 20, 18, w, h);
        } else {
          ctx.direction = 'ltr';
          ctx.textAlign = 'right';
          ctx.font = 'bold 19px Arial';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('SHOOTER ACADEMY', size.width - 22, 43, size.width - 44);
        }
      };
      const drawBrandScreen = (closing: boolean) => {
        ctx.fillStyle = '#0b1019';
        ctx.fillRect(0, 0, size.width, size.height);
        ctx.fillStyle = accent;
        ctx.fillRect(0, size.height * 0.32, size.width, 7);
        ctx.fillRect(0, size.height * 0.68, size.width, 7);
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.min(48, Math.round(size.width * 0.060))}px Arial`;
        ctx.fillText(closing ? 'SHOOTER ACADEMY' : (title.trim() || 'SHOOTER ACADEMY'), size.width / 2, size.height * 0.49, size.width - 48);
        ctx.font = `bold ${Math.min(26, Math.round(size.width * 0.034))}px Arial`;
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(closing ? 'SHOOTER ACADEMY' : caption.trim(), size.width / 2, size.height * 0.58, size.width - 48);
        drawLogo();
      };
      const drawScene = (index: number, fraction: number) => {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0b1019';
        ctx.fillRect(0, 0, size.width, size.height);
        if (transition === 'fade' && index > 0 && fraction < 0.18) {
          drawImage(images[index - 1], 1);
          ctx.globalAlpha = fraction / 0.18;
          drawImage(images[index], fraction);
          ctx.globalAlpha = 1;
        } else drawImage(images[index], fraction);
        const shade = ctx.createLinearGradient(0, size.height * 0.43, 0, size.height);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.88)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, size.height * 0.43, size.width, size.height * 0.57);
        drawLogo();
        ctx.direction = /[\u0600-\u06ff]/.test(title) ? 'rtl' : 'ltr';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.min(42, Math.round(size.width * 0.052))}px Arial`;
        ctx.fillText(title.trim() || 'SHOOTER ACADEMY', size.width / 2, size.height - 99, size.width - 48);
        ctx.fillStyle = '#f1f5f9';
        ctx.font = `bold ${Math.min(24, Math.round(size.width * 0.032))}px Arial`;
        const line = slides[index].caption.trim() || caption.trim();
        if (line) ctx.fillText(line, size.width / 2, size.height - 55, size.width - 48);
        ctx.fillStyle = accent;
        ctx.fillRect(0, size.height - 9, size.width * ((index + fraction) / images.length), 9);
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        ctx.font = 'bold 15px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${index + 1} / ${images.length}`, 20, 43);
      };
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const done = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => reject(new Error(t('تعذّر تسجيل الفيديو.', 'Video recording failed.')));
      });
      const edgeMs = introOutro ? 1400 : 0;
      const sceneMs = seconds * 1000;
      const totalMs = edgeMs * 2 + images.length * sceneMs;
      drawBrandScreen(false);
      recorder.start(1000);
      const start = performance.now();
      await new Promise<void>(resolve => {
        let lastUpdate = 0;
        const tick = (now: number) => {
          const elapsed = Math.min(now - start, totalMs);
          if (introOutro && elapsed < edgeMs) drawBrandScreen(false);
          else if (introOutro && elapsed >= totalMs - edgeMs) drawBrandScreen(true);
          else {
            const sceneElapsed = elapsed - edgeMs;
            const index = Math.min(images.length - 1, Math.floor(sceneElapsed / sceneMs));
            const fraction = Math.min(1, Math.max(0, (sceneElapsed % sceneMs) / sceneMs));
            drawScene(index, fraction);
          }
          if (now - lastUpdate > 450) {
            lastUpdate = now;
            setProgress(t('إنشاء الفيديو', 'Rendering') + ': ' + Math.round(elapsed / totalMs * 100) + '%');
          }
          if (elapsed < totalMs) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      recorder.stop();
      await done;
      if (!chunks.length) throw new Error(t('ملف الفيديو الناتج فارغ.', 'The rendered video is empty.'));
      const mp4 = mimeType.startsWith('video/mp4');
      const file = new File(chunks, `shooter-video.${mp4 ? 'mp4' : 'webm'}`, { type: mp4 ? 'video/mp4' : 'video/webm' });
      if (outputRef.current) URL.revokeObjectURL(outputRef.current);
      outputRef.current = URL.createObjectURL(file);
      setOutput({ url: outputRef.current, file });
      setProgress(mp4
        ? t('اكتمل إنشاء MP4. راجعه قبل إرفاقه بالمسودة.', 'MP4 ready. Review before attaching to the draft.')
        : t('اكتمل إنشاء WebM للتنزيل. رفع الموقع يتطلب MP4؛ المتصفح الحالي لا يصدّر MP4.', 'WebM ready to download. The site requires MP4 uploads, which this browser cannot record.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('حدث خطأ أثناء الإنشاء.', 'Video export failed.'));
    } finally {
      musicElement?.pause();
      if (musicUrl) URL.revokeObjectURL(musicUrl);
      if (logoUrl) URL.revokeObjectURL(logoUrl);
      if (audioContext) await audioContext.close();
      stream.getTracks().forEach(track => track.stop());
      setRendering(false);
    }
  };
  const frame = sizes[layout];
  const uiInput = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100';
  const primaryButton = 'inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-40';
  return <section className="space-y-4 rounded-xl border border-red-300 p-4 dark:border-red-800" aria-label={t('استوديو صناعة الفيديو','Video creation studio')}>
    <div>
      <h3 className="flex items-center gap-2 text-lg font-black"><Film size={20}/>{t('استوديو صناعة الفيديو — أدوات المونتاج','Video Studio — Editing tools')}</h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t('ابدأ من الصور، اختر قالبًا وأضف العناوين والشعار والموسيقى، ثم عاين الناتج قبل رفعه. لا يُنشر شيء تلقائيًا.', 'Start with photos, choose a template, add titles, a logo and music, then review before attaching. Nothing publishes automatically.')}</p>
    </div>
    <div className="grid gap-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800 sm:grid-cols-3">
      <label className="text-sm font-bold">{t('قالب المونتاج','Video template')}
        <select className={uiInput} value={style} disabled={rendering} onChange={e => setStyle(e.target.value as Style)}>
          <option value="highlights">{t('لحظات الملعب','Match highlights')}</option>
          <option value="award">{t('تكريم لاعب أو موظف','Player / staff recognition')}</option>
          <option value="news">{t('خبر أو إعلان','News / announcement')}</option>
        </select>
      </label>
      <label className="text-sm font-bold">{t('مقاس الفيديو','Video format')}
        <select className={uiInput} value={layout} disabled={rendering} onChange={e => setLayout(e.target.value as Layout)}>
          <option value="landscape">{t('أفقي 16:9','Landscape 16:9')}</option>
          <option value="portrait">{t('عمودي 9:16','Portrait 9:16')}</option>
          <option value="square">{t('مربع 1:1','Square 1:1')}</option>
        </select>
      </label>
      <label className="text-sm font-bold">{t('الانتقالات','Transitions')}
        <select className={uiInput} value={transition} disabled={rendering} onChange={e => setTransition(e.target.value as Transition)}>
          <option value="fade">{t('تلاشي سلس','Crossfade')}</option>
          <option value="cut">{t('قص مباشر','Hard cut')}</option>
        </select>
      </label>
      <label className="text-sm font-bold">{t('ملاءمة الصورة','Image fit')}
        <select className={uiInput} value={fit} disabled={rendering} onChange={e => setFit(e.target.value as 'cover' | 'contain')}>
          <option value="cover">{t('ملء الإطار (قد يقص الحواف)','Fill / crop')}</option>
          <option value="contain">{t('عرض الصورة كاملة','Fit entire image')}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={introOutro} disabled={rendering} onChange={e => setIntroOutro(e.target.checked)}/>
        {t('مقدمة وخاتمة بهوية شوتر','Branded intro and outro')}
      </label>
      <label className="text-sm font-bold">{t('شعار اختياري (حتى 2 MB)','Optional logo (up to 2 MB)')}
        <input className="mt-1 block w-full text-xs" type="file" accept="image/png,image/webp,image/jpeg" disabled={rendering}
          onChange={e => { const file = e.target.files?.[0] || null; if (file && (file.size > 2 * 1024 * 1024 || !['image/png','image/webp','image/jpeg'].includes(file.type))) { setError(t('الشعار يجب أن يكون PNG أو WebP أو JPG وبحجم 2 MB أو أقل.', 'Logo must be PNG, WebP or JPG, max 2 MB.')); setLogo(null); } else { setLogo(file); setError(''); } e.target.value = ''; }}/>
        {logo && <span className="mt-1 block truncate text-xs font-normal">{logo.name} <button type="button" className="underline" disabled={rendering} onClick={() => setLogo(null)}>{t('إزالة','Remove')}</button></span>}
      </label>
    </div>
    <label className="block text-sm font-bold"><ImagePlus className="me-1 inline" size={16}/>{t('إضافة صور للمونتاج (2–15 صورة، 5 MB للصورة)','Add storyboard photos (2–15, 5 MB each)')}
      <input className="mt-2 block w-full" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={rendering}
        onChange={e => { addPhotos(e.target.files); e.target.value = ''; }}/>
    </label>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {slides.map((slide, index) => <div key={slide.id} className="space-y-2 rounded-lg border border-slate-300 p-2 dark:border-slate-700">
        <img src={slide.url} alt={t('المشهد ','Scene ') + (index + 1)} className="aspect-video w-full rounded object-contain bg-slate-950"/>
        <div className="flex items-center justify-between gap-2">
          <button type="button" title={t('تحريك للأعلى','Move up')} disabled={rendering || index === 0} onClick={() => move(index, -1)}><ArrowUp size={18}/></button>
          <span className="text-xs font-bold">{index + 1} / {slides.length}</span>
          <button type="button" title={t('تحريك للأسفل','Move down')} disabled={rendering || index === slides.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18}/></button>
          <button type="button" title={t('إزالة الصورة','Remove image')} disabled={rendering} onClick={() => {
            URL.revokeObjectURL(slide.url);
            setSlides(old => old.filter(item => item.id !== slide.id));
          }}><Trash2 size={18}/></button>
        </div>
        <label className="block text-xs font-bold">{t('نص خاص بهذه الصورة','Caption for this scene')}
          <input className={uiInput} maxLength={90} value={slide.caption} disabled={rendering}
            onChange={e => updateCaption(slide.id, e.target.value)} placeholder={t('اختياري','Optional')}/>
        </label>
      </div>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-bold">{t('عنوان الفيديو','Video title')}
        <input className={uiInput} maxLength={65} value={title} disabled={rendering} onChange={e => setTitle(e.target.value)}/>
      </label>
      <label className="block text-sm font-bold">{t('نبذة عامة','General subtitle')}
        <input className={uiInput} maxLength={90} value={caption} disabled={rendering} onChange={e => setCaption(e.target.value)}/>
      </label>
      <label className="block text-sm font-bold">{t('مدة كل صورة','Duration per scene')}: {seconds} {t('ثوانٍ','seconds')}
        <input className="mt-2 w-full accent-red-700" type="range" min={2} max={6} value={seconds} disabled={rendering} onChange={e => setSeconds(Number(e.target.value))}/>
      </label>
      <label className="block text-sm font-bold">{t('موسيقى خلفية اختيارية ومرخصة','Optional licensed background music')}
        <input className="mt-1 block w-full text-xs" type="file" accept="audio/*" disabled={rendering}
          onChange={e => { const file = e.target.files?.[0] || null; if (file && file.size > 15 * 1024 * 1024) { setError(t('الحد الأقصى للموسيقى 15 MB.', 'Music file may not exceed 15 MB.')); setMusic(null); } else { setMusic(file); setError(''); } e.target.value = ''; }}/>
        {music && <span className="mt-1 block truncate text-xs font-normal">{music.name} <button type="button" className="underline" disabled={rendering} onClick={() => setMusic(null)}>{t('إزالة','Remove')}</button></span>}
      </label>
    </div>
    {slides[0] && <div className="space-y-2">
      <h4 className="text-sm font-black">{t('معاينة شكل الإطار قبل التصدير','Frame layout preview')}</h4>
      <div className="relative mx-auto w-full max-w-[600px] overflow-hidden rounded-xl bg-slate-950 text-white" style={{ aspectRatio: `${frame.width} / ${frame.height}`, maxHeight: 360 }}>
        <img className="absolute inset-0 h-full w-full" style={{ objectFit: fit }} src={slides[0].url} alt={t('معاينة المونتاج','Montage preview')}/>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"/>
        <span className="absolute end-3 top-3 rounded bg-black/70 p-1 text-xs font-black">SHOOTER ACADEMY</span>
        <div className="absolute inset-x-2 bottom-4 text-center">
          <h5 className="truncate text-lg font-black">{title || 'SHOOTER ACADEMY'}</h5>
          <p className="truncate text-sm">{slides[0].caption || caption}</p>
        </div>
        <div className="absolute bottom-0 h-1 w-1/4" style={{backgroundColor: accents[style]}}/>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">{t('هذه معاينة ثابتة للتنسيق؛ شاهد الفيديو الناتج لمراجعة الحركة والموسيقى.', 'Static composition preview; review the exported video for movement and audio.')}</p>
    </div>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={primaryButton} disabled={rendering || slides.length < 2}
        onClick={() => void makeVideo()}><Play size={16}/>{rendering ? t('جارٍ التصدير…','Rendering…') : t('إنشاء الفيديو ومعاينته','Render and review video')}</button>
      <p className="text-xs">{t('اترك الصفحة مفتوحة أثناء الإنشاء؛ يبقى المشروع في المتصفح حتى تختار رفع MP4.', 'Keep this tab open while rendering; your storyboard stays in the browser until you attach an MP4.')}</p>
    </div>
    {progress && <p role="status" className="text-sm">{progress}</p>}
    {error && <p role="alert" className="rounded bg-red-100 p-2 text-sm text-red-900">{error}</p>}
    {output && <div className="space-y-3 rounded-lg border border-slate-300 p-3 dark:border-slate-700">
      <video className="max-h-[440px] w-full rounded bg-black" src={output.url} controls playsInline/>
      <div className="flex flex-wrap items-center gap-2">
        <a href={output.url} download={output.file.name} className={primaryButton}><Download size={16}/>{t('تنزيل','Download')} {output.file.type === 'video/mp4' ? 'MP4' : 'WebM'}</a>
        {output.file.type === 'video/mp4' && <button type="button" className={primaryButton} disabled={rendering || output.file.size > MAX_UPLOAD_BYTES}
          onClick={() => void onMp4(output.file).catch(e => setError(e instanceof Error ? e.message : String(e)))}>
          {t('إرفاق MP4 بالمسودة','Attach MP4 to draft')}
        </button>}
      </div>
      {output.file.size > MAX_UPLOAD_BYTES && <p role="alert" className="text-xs text-red-600">
        {t('الفيديو يتجاوز حد الرفع 20 MB. نزّله أو قلّل عدد الصور/مدتها وأعد التصدير.', 'Video exceeds the 20 MB upload limit. Download it or shorten the storyboard and export again.')}
      </p>}
      <p className="text-xs">{t('يستلزم النشر حفظ المسودة ومعاينتها ثم اختيار النشر من إدارة الموقع.', 'Publishing requires saving the draft, reviewing it, and publishing from the website manager.')}</p>
    </div>}
  </section>;
}
