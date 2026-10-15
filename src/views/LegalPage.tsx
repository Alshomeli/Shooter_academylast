import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { prefs } from '@/lib/preferences';
import { publicLanguage } from '@/lib/public-i18n';
import type { Lang } from '@/types';

type PolicyPage = 'privacy' | 'terms';
interface PolicySection { id?: string; title: string; body: string; }
const contactEmail = 'shooter.academy.bh@gmail.com';
const contactPhone = '+973 3228 7776';

// The English version preserves the meaning of the existing Arabic draft;
// both versions need academy approval and legal review before final adoption.
const policySections: Record<PolicyPage, Record<Lang, PolicySection[]>> = {
  privacy: {
    ar: [
      { title: 'البيانات التي نجمعها', body: 'قد تشمل بيانات التسجيل اسم ولي الأمر ووسائل التواصل وبيانات اللاعب وصورته وسجلات الحضور والتقييم والاشتراك وإثباتات الدفع والمستندات المقدمة للأكاديمية.' },
      { title: 'أغراض الاستخدام', body: 'نستخدم المعلومات لإدارة طلبات التسجيل، والتواصل بشأن التدريب، ومتابعة الحضور والتقييمات والاشتراكات، ومراجعة إثباتات الدفع.' },
      { title: 'الوصول إلى المعلومات', body: 'تُخصص صلاحيات الوصول إلى سجلات اللاعبين بحسب دور المستخدم في النظام. يُرجى عدم مشاركة بيانات تسجيل الدخول مع الآخرين.' },
      { title: 'حقوق ولي الأمر والتواصل', body: 'يمكن لولي الأمر التواصل مع الأكاديمية للاستفسار عن بياناته وبيانات اللاعب، أو طلب تصحيح معلومات غير دقيقة، أو الاستفسار عن الاحتفاظ بها أو حذفها وفق الالتزامات المعمول بها.' },
      { title: 'أمان المعلومات', body: 'تسعى الأكاديمية إلى حماية بيانات المستخدمين عبر ضوابط الوصول إلى الحسابات. لا يمكن ضمان انعدام المخاطر الأمنية في أي خدمة إلكترونية.' },
      { title: 'التحديثات', body: 'قد تُحدَّث هذه السياسة عند تغيير الخدمات أو الإجراءات، وتُنشر النسخة المحدثة في هذه الصفحة.' },
    ],
    en: [
      { title: 'Information We Collect', body: 'Registration information may include the parent or guardian’s name and contact details, the player’s details and photo, attendance and evaluation records, subscription information, payment receipts, and documents provided to the academy.' },
      { title: 'How We Use Information', body: 'We use this information to manage registration requests, communicate about training, track attendance, evaluations and subscriptions, and review payment receipts.' },
      { title: 'Access to Information', body: 'Access to player records is assigned according to a user’s role in the system. Please do not share your sign-in details with others.' },
      { title: 'Parent and Guardian Requests', body: 'Parents and guardians can contact the academy with questions about their own or their player’s information, to request corrections, or to ask about data retention or deletion under applicable obligations.' },
      { title: 'Information Security', body: 'The academy aims to protect user information through account access controls. No online service can guarantee that all security risks are eliminated.' },
      { title: 'Updates', body: 'This policy may be updated when services or procedures change. Updated wording will be posted on this page.' },
    ],
  },
  terms: {
    ar: [
      { title: 'التسجيل والقبول', body: 'يجب تقديم معلومات صحيحة ومحدثة عن ولي الأمر واللاعب. يخضع قبول التسجيل وتخصيص الفريق أو الفئة لمراجعة إدارة الأكاديمية.' },
      { id: 'payments', title: 'الاشتراكات والدفع المسبق', body: 'تُدفع رسوم الاشتراك مقدماً. عند الدفع بالتحويل البنكي، يرفع ولي الأمر إثبات التحويل للمراجعة، ولا يُعد الاشتراك مدفوعاً أو معتمداً إلا بعد موافقة الإدارة على الإثبات.' },
      { title: 'مواعيد التدريب والأنشطة', body: 'تُنشر تفاصيل البرامج ومواعيد الأنشطة عبر القنوات المعتمدة للأكاديمية. قد تتغير المواعيد لأسباب تنظيمية، ويُبلَّغ المشتركون بالتغييرات المهمة متى أمكن.' },
      { id: 'refunds', title: 'الإلغاء والاسترداد', body: 'يُرجى التواصل مع إدارة الأكاديمية قبل طلب إلغاء الاشتراك أو استرداد أي رسوم. تُحدد أهلية الاسترداد وفق شروط الاشتراك المعلنة للمشترك والقوانين المعمول بها؛ ولا تُعد هذه الصفحة وعداً باسترداد تلقائي أو رفض تلقائي.' },
      { title: 'استخدام البوابة', body: 'يجب الحفاظ على سرية الحساب واستخدام البوابة للاطلاع على بيانات اللاعبين المرتبطين بولي الأمر فقط. يمنع استخدام حساب شخص آخر دون تصريح.' },
      { title: 'الاستفسارات والشكاوى', body: 'يمكن إرسال الاستفسارات المتعلقة بالاشتراكات أو البيانات أو الخدمات إلى الأكاديمية عبر وسائل التواصل الموضحة أدناه.' },
    ],
    en: [
      { title: 'Registration and Admission', body: 'Accurate and up-to-date information about the parent or guardian and player must be provided. Registration approval and team or age-group assignment are subject to academy management review.' },
      { id: 'payments', title: 'Subscriptions and Advance Payment', body: 'Subscription fees are paid in advance. For bank transfers, the parent or guardian uploads proof of payment for review. A subscription is not considered paid or approved until management approves that proof.' },
      { title: 'Training and Activity Schedules', body: 'Program and activity schedules are shared through the academy’s official channels. Schedules may change for organizational reasons, and subscribers will be informed of significant changes whenever possible.' },
      { id: 'refunds', title: 'Cancellation and Refunds', body: 'Please contact academy management before requesting a cancellation or refund. Refund eligibility is determined by the subscription terms provided to the subscriber and applicable law. This page does not promise automatic approval or automatic refusal of refunds.' },
      { title: 'Using the Portal', body: 'Keep account details confidential and use the portal only to view information about players associated with the parent or guardian account. Accessing another person’s account without permission is prohibited.' },
      { title: 'Questions and Complaints', body: 'Questions about subscriptions, information, or academy services can be sent through the contact channels below.' },
    ],
  },
};

export function LegalPage({ page }: { page: PolicyPage }) {
  const [darkMode, setDarkMode] = useState(prefs.getDarkMode);
  const [lang, setLang] = useState<Lang>(() => publicLanguage(window.location.search, prefs.getLang()));
  const privacy = page === 'privacy';
  const english = lang === 'en';
  const title = privacy ? (english ? 'Privacy & Data Protection' : 'سياسة الخصوصية وحماية البيانات')
    : (english ? 'Terms & Conditions' : 'الشروط والأحكام');
  const link = (path: string) => english ? `${path}?lang=en` : path;
  const switchLanguage = () => {
    const next: Lang = english ? 'ar' : 'en';
    setLang(next);
    const url = new URL(window.location.href);
    if (next === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  };
  useEffect(() => {
    prefs.saveLang(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = english ? 'ltr' : 'rtl';
    document.title = `${title} | ${english ? 'Shooter Academy' : 'أكاديمية شوتر'}`;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute(
      'content',
      privacy
        ? english ? 'How Shooter Academy in Bahrain uses and protects registration, player, and parent information.'
                  : 'سياسة الخصوصية وحماية البيانات في أكاديمية شوتر لكرة القدم.'
        : english ? 'Shooter Academy registration, subscriptions, advance payment, and cancellation terms.'
                  : 'الشروط والأحكام والتسجيل والاشتراكات في أكاديمية شوتر لكرة القدم.'
    );
  }, [lang, privacy, english, title]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    prefs.saveDarkMode(darkMode);
  }, [darkMode]);
  return <main dir={english ? 'ltr' : 'rtl'} lang={lang} className="min-h-screen bg-slate-100 dark:bg-slate-950 px-4 py-10 text-slate-900 dark:text-slate-100">
    <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-xl">
      <header className="bg-gradient-to-l from-slate-950 to-red-950 px-6 py-9 text-white sm:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={switchLanguage}
            lang={english ? 'ar' : 'en'}
            aria-label={english ? 'التبديل إلى العربية' : 'Switch to English'}
            className="inline-flex items-center rounded-lg border border-red-300 px-4 py-2 text-sm font-black">
            {english ? 'عربي' : 'EN'}
          </button>
          <button type="button" onClick={() => setDarkMode(v => !v)}
            aria-label={darkMode ? (english ? 'Switch to Light Mode' : 'تفعيل الوضع النهاري') : (english ? 'Switch to Dark Mode' : 'تفعيل الوضع الليلي')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-400 px-3 py-2 text-sm font-bold">
            {darkMode ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
            {darkMode ? (english ? 'Light' : 'نهاري') : (english ? 'Dark' : 'ليلي')}
          </button>
        </div>
        <p className="mt-5 text-sm font-bold text-red-200">SHOOTER ACADEMY · {english ? 'FOOTBALL' : 'أكاديمية شوتر لكرة القدم'}</p>
        <h1 className="mt-3 text-3xl font-black">{title}</h1>
        <p className="mt-3 text-sm text-slate-200">{english ? 'Information for parents, guardians, and portal users' : 'معلومات موجهة لأولياء الأمور والمستخدمين'}</p>
      </header>
      <div className="space-y-7 px-6 py-8 sm:px-10">
        {policySections[page][lang].map(({ id, title: heading, body }) =>
          <section key={id || heading} id={id} className="scroll-mt-8">
            <h2 className="text-lg font-black">{heading}</h2>
            <p className="mt-2 leading-8 text-slate-600 dark:text-slate-300">{body}</p>
          </section>
        )}
        <section className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <h2 className="font-black">{english ? 'Contact the Academy' : 'التواصل مع الأكاديمية'}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            <a className="text-red-700 dark:text-red-300 underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
            <br/><a className="text-red-700 dark:text-red-300 underline" href="tel:+97332287776">{contactPhone}</a>
          </p>
        </section>
        <nav className="flex flex-wrap gap-4 border-t border-slate-200 dark:border-slate-700 pt-6 text-sm font-bold" aria-label={english ? 'Legal navigation' : 'روابط الصفحات'}>
          <a href={link('/')} className="text-red-700 dark:text-red-300 underline">{english ? 'Home' : 'الصفحة الرئيسية'}</a>
          <a href="/?view=login" className="text-red-700 dark:text-red-300 underline">{english ? 'Academy Portal' : 'دخول المنصة'}</a>
          <a href={link('/privacy')} className="text-red-700 dark:text-red-300 underline">{english ? 'Privacy Policy' : 'سياسة الخصوصية'}</a>
          <a href={link('/terms')} className="text-red-700 dark:text-red-300 underline">{english ? 'Terms & Conditions' : 'الشروط والأحكام'}</a>
        </nav>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {english
            ? 'This is a preliminary operating draft and requires academy management approval and legal review before it can be treated as a final policy.'
            : 'هذه صياغة تشغيلية أولية تحتاج اعتماد إدارة الأكاديمية ومراجعة قانونية قبل اعتبارها سياسة نهائية.'}
        </p>
      </div>
    </article>
  </main>;
}
