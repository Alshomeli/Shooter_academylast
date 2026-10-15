import { useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { publicGallery } from '@/data/public-academy';

export function AcademyGallery({photos = publicGallery}: {photos?: typeof publicGallery}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const change = (step: number) => setActive(i => (i + step + photos.length) % photos.length);
  const photo = photos[active] || photos[0];
  if (!photo) return null;
  return <>
    <div className="ah-gallery">{photos.map((p, i) => <figure key={p.src}>
      <button type="button" onClick={() => { setActive(i); dialog.current?.showModal(); }} aria-label={`تكبير الصورة: ${p.title}`}><img src={p.src} alt={p.alt} loading="lazy" width="1200" height="860"/><span><Maximize2 size={16}/> عرض الصورة</span></button>
      <figcaption><h3>{p.title}</h3><p>{p.caption}</p></figcaption>
    </figure>)}</div>
    <dialog className="ah-photo-dialog" ref={dialog} aria-label="معرض صور الأكاديمية" onKeyDown={e => { if (e.key === 'ArrowLeft') change(1); if (e.key === 'ArrowRight') change(-1); }} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <button type="button" className="ah-photo-close" autoFocus onClick={() => dialog.current?.close()} aria-label="إغلاق الصورة"><X/></button>
      <img src={photo.src} alt={photo.alt}/><p>{photo.title}</p>
      <div className="ah-photo-controls"><button type="button" onClick={() => change(-1)} aria-label="الصورة السابقة"><ChevronRight/></button><span>{active + 1} / {photos.length}</span><button type="button" onClick={() => change(1)} aria-label="الصورة التالية"><ChevronLeft/></button></div>
    </dialog>
  </>;
}

