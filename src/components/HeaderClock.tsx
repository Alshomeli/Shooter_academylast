import { memo, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import type { Lang } from '@/types';

/* Isolated 1 Hz clock: ticks re-render only this component, not the whole app tree. */
export const HeaderClock = memo(function HeaderClock({ lang }: { lang: Lang }) {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      try {
        const formatter = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
          timeZone: 'Asia/Bahrain',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: true,
        });
        setCurrentTime(formatter.format(new Date()));
      } catch {
        setCurrentTime(new Date().toLocaleTimeString());
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [lang]);

  return (
    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <Clock className="h-3.5 w-3.5 text-brand-500" />
      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">{currentTime}</span>
    </div>
  );
});
