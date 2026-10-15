import { useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { publicGallery } from '@/data/public-academy';

export interface GalleryPhoto {
  src: string;
  title: string;
  caption: string;
  alt: string;
  album?: string;
}

export function AcademyGallery({ photos = publicGallery }: { photos?: GalleryPhoto[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [activeAlbum, setActiveAlbum] = useState(0);
  const [activePhoto, setActivePhoto] = useState(0);
  const albums = photos.filter(item => Boolean(item.src?.trim())).reduce<{ title: string; photos: GalleryPhoto[] }[]>((groups, photo) => {
    const title = photo.album?.trim() || photo.title;
    const existing = groups.find(group => group.title === title);
    if (existing) existing.photos.push(photo);
    else groups.push({ title, photos: [photo] });
    return groups;
  }, []);
  const group = albums[activeAlbum];
  const currentPhotos = group?.photos || [];
  const photo = currentPhotos[activePhoto] || currentPhotos[0];
  const change = (step: number) => setActivePhoto(i => (i + step + currentPhotos.length) % currentPhotos.length);
  const open = (albumIndex: number) => {
    setActiveAlbum(albumIndex);
    setActivePhoto(0);
    dialog.current?.showModal();
  };
  if (!albums.length || !photo) return null;
  return <>
    <div className="ah-gallery">{albums.map((album, index) => {
      const cover = album.photos[0];
      return <figure key={album.title}>
        <button type="button" onClick={() => open(index)} aria-label={`عرض ألبوم ${album.title}، ${album.photos.length} صور`}>
          <img src={cover.src} alt={cover.alt} loading="lazy" width="1200" height="860"/>
          <span><Maximize2 size={16}/> عرض صور النشاط ({album.photos.length})</span>
        </button>
        <figcaption><h3>{album.title}</h3><p>{cover.caption}</p></figcaption>
      </figure>;
    })}</div>
    <dialog className="ah-photo-dialog" ref={dialog} aria-label={`ألبوم ${group?.title || 'صور الأكاديمية'}`}
      onKeyDown={e => { if (e.key === 'ArrowLeft') change(1); if (e.key === 'ArrowRight') change(-1); }}
      onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <button type="button" className="ah-photo-close" autoFocus onClick={() => dialog.current?.close()} aria-label="إغلاق الصور"><X/></button>
      <h3 className="ah-photo-heading">{group.title}</h3>
      <img src={photo.src} alt={photo.alt}/><p>{photo.title}</p>
      <div className="ah-photo-controls">
        <button type="button" onClick={() => change(-1)} disabled={currentPhotos.length < 2} aria-label="الصورة السابقة"><ChevronRight/></button>
        <span>{activePhoto + 1} / {currentPhotos.length}</span>
        <button type="button" onClick={() => change(1)} disabled={currentPhotos.length < 2} aria-label="الصورة التالية"><ChevronLeft/></button>
      </div>
    </dialog>
  </>;
}
