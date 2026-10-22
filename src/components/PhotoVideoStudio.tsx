import { useEffect, useRef, useState } from 'react';
import { Film, ImagePlus, Play, Download, ArrowUp, ArrowDown } from 'lucide-react';

type Slide = { id: string; file: File; url: string };
const size = { width: 960, height: 540 };

export function PhotoVideoStudio({ onMp4 }: { onMp4: (file: File) => Promise<void> }) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [seconds, setSeconds] = useState(3);
  const [music, setMusic] = useState<File | null>(null);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState('');
  const [output, setOutput] = useState<{ url: string; file: File } | null>(null);
  const [error, setError] = useState('');
  const slidesRef = useRef<Slide[]>([]);
  const outputRef = useRef<string | null>(null);
  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => () => { slidesRef.current.forEach(s => URL.revokeObjectURL(s.url)); if (outputRef.current) URL.revokeObjectURL(outputRef.current); }, []);
  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024);
    if (slides.length + valid.length > 15) { setError('الحد الأقصى 15 صورة لكل فيديو.'); return; }
    setSlides(old => [...old, ...valid.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
    setError('');
  };
  const move = (index: number, direction: number) => {
    setSlides(old => {
      const copy = [...old], target = index + direction;
      if (target < 0 || target >= copy.length) return old;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };
  const makeVideo = async () => {
    if (rendering || slides.length < 2) return;
    const mimeType = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm']
      .find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
    if (!mimeType || !HTMLCanvasElement.prototype.captureStream) { setError('متصفحك لا يدعم إنشاء الفيديو. جرّب متصفحًا حديثًا على الكمبيوتر.'); return; }
    setRendering(true); setError(''); setProgress('تحضير الصور');
    const canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setRendering(false); setError('تعذّر إنشاء لوحة الفيديو.'); return; }
    const streams = canvas.captureStream(24);
    let audioContext: AudioContext | undefined;
    let musicElement: HTMLAudioElement | undefined;
    let musicUrl: string | undefined;
    try {
      const images = await Promise.all(slides.map(async slide => {
        const img = new Image(); img.src = slide.url; await img.decode(); return img;
      }));
      if (music) {
        audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        musicUrl = URL.createObjectURL(music);
        musicElement = new Audio(musicUrl);
        musicElement.loop = true; musicElement.volume = 0.25;
        const source = audioContext.createMediaElementSource(musicElement);
        source.connect(destination);
        destination.stream.getAudioTracks().forEach(track => streams.addTrack(track));
        await audioContext.resume();
        await musicElement.play();
      }
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(streams, { mimeType, videoBitsPerSecond: 1_500_000 });
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => reject(new Error('تعذّر تسجيل الفيديو.'));
      });
      const draw = (image: HTMLImageElement, frame: number, index: number) => {
        ctx.fillStyle = '#08090e'; ctx.fillRect(0, 0, size.width, size.height);
        const zoom = 1 + 0.055 * frame;
        const scale = Math.max(size.width / image.width, size.height / image.height) * zoom;
        const width = image.width * scale, height = image.height * scale;
        ctx.drawImage(image, (size.width - width) / 2, (size.height - height) / 2, width, height);
        const gradient = ctx.createLinearGradient(0, 280, 0, size.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,.85)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 250, size.width, 290);
        ctx.textAlign = 'center'; ctx.direction = 'rtl';
        ctx.fillStyle = 'white'; ctx.font = 'bold 44px Arial';
        ctx.fillText(title.slice(0, 65) || 'أكاديمية شوتر', 480, 425, 900);
        ctx.font = '26px Arial'; ctx.fillText(caption.slice(0, 90), 480, 478, 900);
        ctx.fillStyle = '#c81723'; ctx.fillRect(0, 525, size.width * ((index + frame) / images.length), 15);
      };
      recorder.start(1000);
      const start = performance.now();
      const duration = images.length * seconds * 1000;
      await new Promise<void>(resolve => {
        let last = 0;
        const tick = (now: number) => {
          const elapsed = Math.min(now - start, duration);
          const current = Math.min(images.length - 1, Math.floor(elapsed / (seconds * 1000)));
          const fraction = (elapsed % (seconds * 1000)) / (seconds * 1000);
          draw(images[current], fraction, current);
          if (now - last >= 450) { last = now; setProgress('إنشاء الفيديو: ' + Math.round(elapsed / duration * 100) + '%'); }
          if (elapsed < duration) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      recorder.stop(); await done;
      const isMp4 = mimeType.startsWith('video/mp4');
      const file = new File(chunks, 'shooter-slideshow.' + (isMp4 ? 'mp4' : 'webm'), { type: isMp4 ? 'video/mp4' : 'video/webm' });
      if (outputRef.current) URL.revokeObjectURL(outputRef.current);
      outputRef.current = URL.createObjectURL(file);
      setOutput({ url: outputRef.current, file });
      setProgress(isMp4 ? 'تم إنشاء MP4، يمكنك رفعه كمسودة.' : 'تم إنشاء WebM للتنزيل؛ رفع الموقع يتطلب MP4.');
    } catch (e) { setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الإنشاء.'); }
    finally { musicElement?.pause(); if (musicUrl) URL.revokeObjectURL(musicUrl); if (audioContext) await audioContext.close(); streams.getTracks().forEach(track => track.stop()); setRendering(false); }
  };
  return <section className="space-y-3 rounded-xl border border-red-300 p-4" aria-label="صانع فيديو من الصور">
    <h3 className="flex items-center gap-2 font-black"><Film size={19}/> صانع الفيديو من الصور</h3>
    <p className="text-xs">أنشئ مقطعًا بالصور والعنوان والموسيقى المرخصة اختياريًا، ثم راجعه قبل رفعه ونشره. يبقى العمل داخل جهازك حتى تختار رفع الملف.</p>
    <label className="block text-sm font-bold"><ImagePlus className="inline ms-1" size={16}/> رفع صور (2–15 صورة، حد 5MB للصورة)
      <input className="block w-full mt-2" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={rendering} onChange={e => { addPhotos(e.target.files); e.target.value = ''; }}/>
    </label>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{slides.map((slide, i) => <div key={slide.id} className="rounded border p-2">
      <img src={slide.url} alt={'الصورة ' + (i + 1)} className="aspect-video w-full object-cover"/>
      <div className="flex items-center justify-between mt-1">
        <button type="button" title="للأعلى" disabled={rendering || i === 0} onClick={() => move(i, -1)}><ArrowUp size={16}/></button>
        <span>{i + 1}</span>
        <button type="button" title="للأسفل" disabled={rendering || i === slides.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16}/></button>
        <button type="button" disabled={rendering} onClick={() => { URL.revokeObjectURL(slide.url); setSlides(old => old.filter(s => s.id !== slide.id)); }}>×</button>
      </div></div>)}</div>
    <label className="block text-sm">العنوان<input className="mt-1 w-full rounded border p-2 text-slate-900" maxLength={65} value={title} disabled={rendering} onChange={e => setTitle(e.target.value)}/></label>
    <label className="block text-sm">نبذة قصيرة<input className="mt-1 w-full rounded border p-2 text-slate-900" maxLength={90} value={caption} disabled={rendering} onChange={e => setCaption(e.target.value)}/></label>
    <label className="block text-sm">مدة كل صورة: {seconds} ثوانٍ<input className="w-full" type="range" min="2" max="6" value={seconds} disabled={rendering} onChange={e => setSeconds(Number(e.target.value))}/></label>
    <label className="block text-sm">موسيقى خلفية اختيارية (ملف تملك حق استخدامه)<input className="block mt-1 w-full" type="file" accept="audio/*" disabled={rendering} onChange={e => setMusic(e.target.files?.[0] || null)}/></label>
    <button type="button" disabled={rendering || slides.length < 2} onClick={() => void makeVideo()} className="flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-40"><Play size={16}/>{rendering ? 'جارٍ إنشاء الفيديو…' : 'إنشاء ومعاينة الفيديو'}</button>
    {progress && <p role="status">{progress}</p>}{error && <p role="alert" className="text-red-600">{error}</p>}
    {output && <div className="space-y-2"><video className="w-full rounded" src={output.url} controls playsInline/>
      <a href={output.url} download={output.file.name} className="inline-flex items-center gap-2 rounded bg-slate-700 p-2 text-white"><Download size={16}/>تنزيل {output.file.name.endsWith('.mp4') ? 'MP4' : 'WebM'}</a>
      {output.file.type === 'video/mp4' && <button type="button" onClick={() => void onMp4(output.file).catch(e => setError(String(e)))} className="ms-2 rounded bg-red-700 p-2 text-white">إرفاق MP4 بالمسودة</button>}
    </div>}
  </section>;
}
