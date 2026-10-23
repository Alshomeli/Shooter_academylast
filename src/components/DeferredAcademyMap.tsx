import { useEffect, useRef, useState } from 'react';

type DeferredAcademyMapProps = {
  title: string;
  fallbackHref: string;
  fallbackLabel: string;
  loadingLabel: string;
};

const mapSrc =
  'https://www.google.com/maps?q=Shooter%20Academy%2C%20Halat%20Naim%2C%20Bahrain&output=embed';

export function DeferredAcademyMap({
  title,
  fallbackHref,
  fallbackLabel,
  loadingLabel,
}: DeferredAcademyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  if (shouldLoad) {
    return (
      <iframe
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapSrc}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      style={{
        minHeight: 'clamp(290px, 36vw, 420px)',
        display: 'grid',
        placeItems: 'center',
        gap: '10px',
        padding: '24px',
        textAlign: 'center',
        background: '#232e3b',
        borderRadius: '12px',
      }}
    >
      <span>{loadingLabel}</span>
      <a href={fallbackHref} target="_blank" rel="noopener noreferrer">
        {fallbackLabel}
      </a>
    </div>
  );
}
