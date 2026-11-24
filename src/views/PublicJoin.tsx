import { useEffect, useState } from 'react';
import { ArrowUpLeft, CalendarDays, MapPin, Moon, Sun, Users } from 'lucide-react';
import { academyContact } from '@/data/public-academy';
import { prefs } from '@/lib/preferences';
import type { Lang } from '@/types';
import './public-join.css';

const ageGroups = [
  { id: '2020-2021', ar: 'مواليد ٢٠٢٠–٢٠٢١', en: 'Born 2020–2021' },
  { id: '2018-2019', ar: 'مواليد ٢٠١٨–٢٠١٩', en: 'Born 2018–2019' },
  { id: '2016-2017', ar: 'مواليد ٢٠١٦–٢٠١٧', en: 'Born 2016–2017' },
  { id: '2014-2015', ar: 'مواليد ٢٠١٤–٢٠١٥', en: 'Born 2014–2015' },
  { id: 'other', ar: 'سنة ميلاد أخرى', en: 'Other birth year' },
];

export default function PublicJoin({ lang }: { lang: Lang }) {
  const [dark, setDark] = useState(prefs.getDarkMode);
  useEffect(() => {
    prefs.saveDarkMode(dark);
  }, [dark]);
  const [players, setPlayers] = useState(1);
  const [ageGroup, setAgeGroup] = useState('');
  const selectedGroup = ageGroups.find(group => group.id === ageGroup);
  const ar = lang === 'ar';
  const t = (arabic: string, english: string) => ar ? arabic : english;
  const money = (value: number) => new Intl.NumberFormat(ar ? 'ar-BH' : 'en-BH', {
    style: 'currency', currency: 'BHD', minimumFractionDigits: 0, maximumFractionDigits: 3,
  }).format(value);
  const card = 'join-card rounded-2xl p-5 sm:p-6';
  const page = ar ? '/' : '/?lang=en';
  const goToAccount = () => prefs.saveLang(lang);

  return (
    <main dir={ar ? 'rtl' : 'ltr'} lang={lang} data-theme={dark ? 'dark' : 'light'} className="public-join min-h-screen px-4 pb-12 pt-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <a href={page} className="flex min-h-11 items-center gap-2 font-bold">
            <img src="/shooter-logo-transparent.png" width="36" height="40" alt="" />
            {t('أكاديمية شوتر', 'Shooter Academy')}
          </a>
          <div className="flex items-center gap-2">
            <button type="button" className="join-control rounded-full px-3" aria-label={dark ? t('تفعيل الوضع النهاري', 'Switch to light mode') : t('تفعيل الوضع الليلي', 'Switch to dark mode')} onClick={() => setDark(value => !value)}>
              {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
            </button>
          <a href={ar ? '/?view=join&lang=en' : '/?view=join&lang=ar'} lang={ar ? 'en' : 'ar'} className="join-control rounded-full px-4 text-sm font-bold">{ar ? 'English' : 'العربية'}</a>
          </div>
        </nav>

        <header className="join-hero rounded-3xl px-6 py-10 sm:px-9">
          <h1 className="text-3xl font-black sm:text-4xl">{t('طلب الانضمام لأكاديمية شوتر', 'Join Shooter Academy')}</h1>
          <p className="join-hero-copy mt-3">{t('اطّلع على التدريب والرسوم، ثم تابع تسجيل اللاعب من حساب ولي الأمر.', 'Review training and fees, then continue your player application from a parent account.')}</p>
        </header>

        <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className={card}>
            <MapPin aria-hidden="true" className="mb-3 join-accent" />
            <h2 className="text-lg font-bold">{t('موقع التدريب', 'Training location')}</h2>
            <p className="mt-2 join-muted">{t('شارع ٢٨، حالة النعيم، البحرين', 'Road 28, Halat Al Nuaim, Bahrain')}</p>
            <a href={academyContact.maps} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-bold join-accent underline">{t('فتح الخريطة', 'Open map')}</a>
          </section>
          <section className={card}>
            <CalendarDays aria-hidden="true" className="mb-3 join-accent" />
            <h2 className="text-lg font-bold">{t('الفئات ومواعيد التدريب', 'Age groups and training times')}</h2>
            <label htmlFor="join-age-group" className="mt-3 block text-sm font-bold">{t('اختر فئة مواليد اللاعب', 'Choose the player’s birth-year group')}</label>
            <select id="join-age-group" value={ageGroup} onChange={event => setAgeGroup(event.currentTarget.value)} className="mt-2 min-h-11 w-full rounded-lg join-field px-3">
              <option value="">{t('اختر الفئة', 'Choose an age group')}</option>
              {ageGroups.map(group => <option key={group.id} value={group.id}>{t(group.ar, group.en)}</option>)}
            </select>
            <dl className="mt-4 space-y-2 rounded-xl join-inset p-3 text-sm" aria-live="polite">
              {selectedGroup && <div><dt className="font-bold">{t('الفئة المختارة', 'Selected group')}</dt><dd>{t(selectedGroup.ar, selectedGroup.en)}</dd></div>}
              <div><dt className="font-bold">{t('أيام التدريب', 'Training days')}</dt><dd>{t('السبت، الاثنين، الأربعاء', 'Saturday, Monday, Wednesday')}</dd></div>
              <div><dt className="font-bold">{t('الفترة العامة للتدريب', 'General training window')}</dt><dd>{t('من ٤:٠٠ إلى ٨:٠٠ مساءً بتوقيت البحرين', '4:00–8:00 PM Bahrain time')}</dd></div>
              <div><dt className="font-bold">{t('مدة الحصة', 'Session length')}</dt><dd>{t('٦٠ دقيقة', '60 minutes')}</dd></div>
            </dl>
            <p className="mt-3 text-sm join-muted">{t('تؤكد الأكاديمية وقت حصة الفئة وتوافر المقاعد. يُحدَّد الفريق عند مراجعة الطلب حسب تاريخ الميلاد.', 'The academy confirms the group’s session time and availability. The team is assigned during application review based on date of birth.')}</p>
            <a href={academyContact.whatsapp} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-bold join-accent underline">{t('استفسر عن موعد الفئة عبر واتساب', 'Ask about group times on WhatsApp')}</a>
          </section>
        </div>

        <section className={card} aria-labelledby="join-fees">
          <div className="flex items-center gap-2">
            <Users aria-hidden="true" className="join-accent" />
            <h2 id="join-fees" className="text-lg font-bold">{t('رسوم الاشتراك الشهري', 'Monthly subscription')}</h2>
          </div>
          <p className="mt-2 join-muted">{money(25)} {t('لكل لاعب شهريًا', 'per player per month')}</p>
          <label htmlFor="join-player-count" className="mt-4 block text-sm font-bold">{t('عدد اللاعبين لحساب الرسوم', 'Number of players for estimate')}</label>
          <input id="join-player-count" type="number" min="1" step="1" inputMode="numeric" value={players || ''} onChange={event => {
            const count = event.currentTarget.valueAsNumber;
            setPlayers(Number.isSafeInteger(count) && count > 0 ? count : 0);
          }} className="mt-2 min-h-11 w-28 rounded-lg join-field px-3" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl join-total p-4 font-bold" aria-live="polite">
            <span>{t('الإجمالي المبدئي شهريًا', 'Estimated monthly total')}</span>
            <span>{players ? money(players * 25) : '—'}</span>
          </div>
          <p className="mt-3 text-sm join-muted">{t('تؤكد الإدارة المبلغ بعد مراجعة الطلب، ثم يظهر خيار رفع إثبات الدفع في حساب ولي الأمر.', 'Management confirms the amount after reviewing the application. You can then upload payment proof from your parent account.')}</p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <a href="/?view=registration" onClick={goToAccount} className="flex min-h-12 items-center justify-center gap-2 rounded-xl join-primary px-4 py-3 text-center font-bold">
            {t('متابعة تسجيل ولي أمر جديد', 'Continue as a new parent')} <ArrowUpLeft aria-hidden="true" size={18} />
          </a>
          <a href="/?view=login" onClick={goToAccount} className="flex min-h-12 items-center justify-center rounded-xl join-control px-4 py-3 text-center font-bold">
            {t('لدي حساب، تسجيل الدخول', 'Already have an account? Sign in')}
          </a>
        </div>
      </div>
    </main>
  );
}
