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
// Bilingual draft reviewed against Bahrain PDPL Law 30/2018 and
// Consumer Protection Law 35/2012 as amended by Law 28/2026.
// Operational particulars MUST be verified before formal academy approval.
const policySections: Record<PolicyPage, Record<Lang, PolicySection[]>> = {
  privacy: {
    ar: [
      { title: "الجهة المسؤولة والتواصل", body: "تُشغّل أكاديمية شوتر لكرة القدم منصة التسجيل والمتابعة. للاستفسار عن معالجة البيانات أو طلب بيانات الجهة المشغلة قانونياً وعنوانها المعتمد، تواصل معنا بالبريد الإلكتروني أو الهاتف الموضحين أسفل الصفحة. يلزم استكمال الاسم القانوني ورقم السجل التجاري والعنوان الرسمي قبل اعتماد هذه السياسة بصيغتها النهائية." },
      { title: "البيانات التي قد نجمعها", body: "قد تشمل البيانات اسم ولي الأمر ووسائل التواصل، واسم اللاعب وتاريخ ميلاده وفئته وصورته وبيانات التسجيل، والحضور والتقييمات والتدريبات، وسجلات الاشتراك وإثباتات التحويل، وملفات المدربين عند الحاجة. يرجى عدم إرسال أي بيانات أو وثائق غير مطلوبة لغرض تقديم الخدمة." },
      { title: "أغراض الاستخدام وأساس المعالجة", body: "تُستخدم البيانات لدراسة طلبات التسجيل، وإدارة الفرق والبرامج والحضور والتقييمات، والتواصل بشأن الأنشطة، والتحقق من الاشتراكات والمدفوعات وتنفيذ المتطلبات القانونية عند انطباقها. تُحدَّد مشروعية كل معالجة بحسب طبيعتها، مثل تنفيذ الخدمة أو الالتزام القانوني أو الموافقة الصريحة عندما تكون لازمة." },
      { title: "بيانات اللاعبين القُصّر وموافقة ولي الأمر", body: "يتولى ولي الأمر أو الممثل القانوني المخوّل تسجيل اللاعب وتقديم بياناته. عندما تتطلب معالجة البيانات الموافقة، تُطلب موافقة واضحة من صاحب الصفة القانونية. ولا يعني التسجيل أو المشاركة في التدريب وحدهما الموافقة على نشر اسم اللاعب أو صورته أو فيديوهاته لأغراض دعائية عامة." },
      { title: "الصور والفيديو والنشر العام", body: "يختلف استخدام صور اللاعب لإدارة ملفه عن نشرها للزوار أو على منصات التواصل. ينبغي الحصول على موافقة مستقلة ومحددة من ولي الأمر أو ممثله القانوني قبل نشر مواد تعريفية للاعب القاصر، مع توضيح الغرض وقنوات النشر ووسيلة طلب إيقاف الاستخدام حيث تسمح القوانين. لا يُفترض توفر هذه الموافقة لمجرد رفع الصورة داخل النظام." },
      { title: "الأشخاص والجهات التي قد تصل إلى البيانات", body: "قد يطّلع الموظفون والمدربون المخوّلون على المعلومات اللازمة لأداء مهامهم فقط. وقد تمر بيانات تشغيلية عبر خدمات الاستضافة والتخزين والإشعارات التقنية المرتبطة بالمنصة بحسب الإعدادات الفعلية. يلزم على الإدارة توثيق مزودي الخدمات وفئات البيانات المتاحة لهم واتفاقات الحماية المناسبة قبل اعتماد البيان النهائي." },
      { title: "المعالجة أو التخزين خارج البحرين", body: "قد تكون بعض خدمات الاستضافة أو التخزين أو الدعم التقني قائمة خارج مملكة البحرين. ينبغي مراجعة مواقع المعالجة وأحكام نقل البيانات عبر الحدود طبقاً لقانون حماية البيانات الشخصية والقرارات التنفيذية المعمول بها، ولا تُعدّ هذه السياسة تصريحاً بنقل غير مستوفٍ للمتطلبات القانونية." },
      { title: "الاحتفاظ والحذف", body: "تُحذف بيانات اللاعب الشخصية أو تُزال منها معلومات التعريف في مدة لا تتجاوز سبعة أشهر من انتهاء آخر اشتراك. وتحتفظ الأكاديمية بسجلات الاشتراكات اللازمة للإحصاءات بعد إزالة ما يعرّف اللاعب أو ولي أمره، مع الاحتفاظ منفصلًا بالسجلات التي يلزم القانون بحفظها للمدة المقررة." },
      { title: "حقوق أصحاب البيانات والتسويق", body: "يمكن لصاحب البيانات أو ممثله القانوني، وفق أحكام القانون، طلب الاستفسار عن المعالجة أو الوصول إلى البيانات أو تصحيحها، وطلب الحذف أو الاعتراض في الحالات التي يجيزها القانون. يمكن أيضاً الاعتراض على استخدام البيانات للتسويق المباشر. لتقديم طلب، استخدم البريد المعلن مع بيانات كافية للتحقق من صفة مقدّم الطلب دون إرسال بيانات حساسة غير لازمة." },
      { title: "الروابط الخارجية والتحديثات", body: "قد تعرض الصفحة خريطة Google وروابط لمنصات التواصل الاجتماعي؛ وتخضع تلك المواقع لسياسات الخصوصية الخاصة بها عند زيارتها. تستخدم المنصة أيضاً تفضيلات محلية لحفظ اختيار اللغة والمظهر. تُراجع هذه السياسة عندما تتغير الخدمات أو أغراض المعالجة، وتُنشر نسختها المحدّثة على هذه الصفحة." },
    ],
    en: [
      { title: "Responsible Operator and Contact", body: "Shooter Football Academy operates the registration and management portal. To ask about personal information or request the operator's confirmed legal name and registered address, contact the academy using the email or phone below. The registered legal entity name, commercial registration number, and official address must be confirmed before this policy is finalized." },
      { title: "Information We May Collect", body: "Information may include a parent or guardian's name and contact details, a player's name, birth date, age group, photo and registration details, training, attendance and evaluation records, subscription records, transfer receipts, and coach records where relevant. Please do not submit information or documents that are not required to deliver the service." },
      { title: "Purposes and Legal Grounds", body: "Information is used to review registrations, manage teams, programs, attendance and evaluations, communicate about activities, verify subscriptions and payments, and meet applicable legal obligations. The lawful ground for each processing activity depends on its purpose, such as delivering the requested service, complying with legal obligations, or obtaining express consent where required." },
      { title: "Young Players and Guardian Consent", body: "A parent, guardian, or authorized legal representative submits a player's registration and information. Where consent is required, it must be obtained clearly from the person legally entitled to provide it. Registration and participation in training alone are not consent to publish a young player's name, photographs or videos for public promotional purposes." },
      { title: "Photos, Videos and Publicity", body: "Using a player's photo for their private profile is different from publishing identifiable material publicly or on social media. Separate, specific consent from the parent or legal representative should be obtained before promotional publication featuring a minor, explaining the purpose, channels and applicable withdrawal or removal request process. A photo uploaded to the private portal does not by itself demonstrate permission to publish it." },
      { title: "Who May Receive Information", body: "Authorized staff and coaches may access only information needed for their responsibilities. Operational data may also be processed through the portal's hosting, storage and technical notification services according to the actual system configuration. The academy must verify the provider list, categories of shared information and appropriate protection arrangements before finalizing this notice." },
      { title: "Processing Outside Bahrain", body: "Some hosting, storage or technical support services may operate outside Bahrain. Processing locations and cross-border transfers must be assessed under Bahrain's Personal Data Protection Law and applicable executive orders. This notice does not authorize any transfer that fails to meet legal requirements." },
      { title: "Retention and Deletion", body: "The player’s personal data shall be deleted or de-identified no later than seven months after the end of the last subscription. The Academy shall retain subscription records necessary for statistical purposes after removing information identifying the player or their parent or guardian, while retaining separately any records that the law requires to be kept for the prescribed period." },
      { title: "Data Rights and Direct Marketing", body: "Under applicable law, individuals or their legal representatives may request information about processing, access or correction, and ask for erasure or object in circumstances allowed by law. Individuals may also object to direct marketing. Send requests to the published email with enough information to confirm the requester's authority, but avoid submitting unnecessary sensitive documents." },
      { title: "External Links and Updates", body: "The site may display a Google map and links to social platforms. Those third-party services have their own privacy notices. The portal also uses local preferences to remember language and appearance choices. This notice may be revised when services or processing purposes change; updates will be published here." },
    ],
  },
  terms: {
    ar: [
      { title: "التسجيل وقبول اللاعبين", body: "يجب تقديم بيانات صحيحة ومحدثة من ولي الأمر أو ممثله القانوني المخوّل. تخضع الموافقة على التسجيل وتحديد الفريق والفئة العمرية لإجراءات إدارة الأكاديمية. ويُتاح توضيح البرنامج وشروط الاشتراك الفعلية قبل سداد الرسوم." },
      { id: "payments", title: "الاشتراكات والدفع المسبق", body: "تُسدد رسوم الاشتراك مقدماً وفق البرنامج والسعر والمدة المعروضة لولي الأمر قبل التعاقد. عند التحويل البنكي، يرفع ولي الأمر إثبات التحويل لمراجعته، ولا تُفعّل حالة الاشتراك المعتمد في البوابة إلا بعد التحقق الإداري. لا يمس ذلك حقيقة التحويل البنكي أو حقوق المستهلك بشأن أي مبلغ دُفع. تُبيّن الأكاديمية تفاصيل الرسوم وتوثيق السداد والفاتورة بحسب المتطلبات المعمول بها." },
      { title: "مدة الاشتراك والتجديد", body: "يجب توضيح تاريخ بدء الاشتراك وانتهائه وعدد أو وتيرة الحصص المضمنة وتكاليف أي خدمات إضافية، وأي ترتيبات تجديد، في عرض التسجيل الفعلي. لا يُستنتج من هذه الصفحة وجود تجديد تلقائي أو خصم متكرر دون إفصاح واضح وموافقة لازمة." },
      { title: "مواعيد التدريب والأنشطة", body: "تُنشر البرامج ومواعيد التدريب والمباريات والأنشطة عبر قنوات الأكاديمية المعتمدة، وقد تتغير لأسباب تنظيمية أو طارئة. تُبلّغ الإدارة المشتركين بالتغييرات الجوهرية متى أمكن، وتوضح خيارات التعامل مع الحصص التي لم تُقدّم وفق الشروط المتفق عليها وأحكام القانون." },
      { id: "refunds", title: "الإلغاء والاسترداد وجودة الخدمة", body: "يحق لولي الأمر تقديم طلب إلغاء أو استرداد عبر وسائل التواصل الموضحة أدناه. تُقيَّم الحالات وفق شروط البرنامج المعلنة عند التسجيل والأحكام الواجبة التطبيق، بما فيها الحقوق المتعلقة بتقديم الخدمة المتفق عليها أو معالجة أي عيب أو نقص فيها. لا تقرر هذه الصفحة استرداداً تلقائياً أو حرماناً مطلقاً من الاسترداد؛ ويتعيّن إعلان شروط المدد والأهلية وطريقة احتساب الحصص المتبقية والرد على الطلبات قبل اعتماد السياسة النهائية." },
      { title: "صور اللاعبين والمحتوى الإعلامي", body: "الاستخدام الداخلي لصور اللاعبين وسجلاتهم يختلف عن نشرها لأغراض إعلامية أو ترويجية. يجب طلب الموافقة المستقلة اللازمة ممن يملك الصفة القانونية قبل نشر صور لاعب قاصر بشكل تعريفي. وتفاصيل معالجة الصور والطلبات ذات الصلة مبينة في سياسة الخصوصية." },
      { title: "السلامة والتواصل أثناء الأنشطة", body: "تُبلغ الأكاديمية أولياء الأمور بالمعلومات التنظيمية الضرورية للحصص والأنشطة، وبكيفية التواصل بشأن الغياب أو العذر أو الظروف التي قد تؤثر في مشاركة اللاعب. لا يقصد بهذه الصفحة التنازل عن أي مسؤولية قانونية أو حق مقرّر للمستهلك." },
      { title: "استخدام البوابة وحماية الحساب", body: "يقتصر استخدام البوابة على الحساب المخوّل واللاعبين المرتبطين به. يجب عدم مشاركة بيانات الدخول أو محاولة الوصول إلى ملفات الآخرين. وتوضح سياسة الخصوصية أنواع البيانات وإجراءات طلبات أصحابها." },
      { title: "الاستفسارات والشكاوى", body: "للاستفسارات أو الشكاوى المتعلقة بالتسجيل أو المدفوعات أو الأنشطة، تواصل مع الأكاديمية بالبريد أو الهاتف أدناه مع رقم الطلب إن توفر. وتظل الحقوق في مراجعة الجهات الرسمية المختصة مصونة وفق القانون." },
      { title: "حالة المسودة والمعلومات التجارية", body: "هذه صياغة مبدئية مخصصة للمراجعة، وليست بديلاً عن عرض اشتراك يحدد الأسعار والمدد وشروط الإلغاء لكل برنامج. يجب استكمال الاسم القانوني للمشغّل ورقم السجل التجاري والعنوان الرسمي وسياسة الاسترداد التشغيلية قبل اعتماد الشروط النهائية." },
    ],
    en: [
      { title: "Registration and Admission", body: "Accurate, current information must be provided by a parent, guardian or authorized legal representative. Registration approval and team or age-group placement are subject to academy review. Program details and actual subscription conditions should be available before any payment is made." },
      { id: "payments", title: "Subscriptions and Advance Payment", body: "Fees are paid in advance according to the program price and term presented before contracting. For bank transfers, the parent or guardian uploads proof for review; the subscription is marked approved in the portal only after administrative verification. This does not negate the bank transfer itself or the consumer's rights regarding funds paid. The academy should disclose fees and provide appropriate payment documentation or invoices under applicable requirements." },
      { title: "Subscription Term and Renewal", body: "The actual registration offer should specify start and end dates, included session frequency or quantity, any extra charges, and renewal arrangements. This page does not imply automatic renewal or recurring charges without proper disclosure and any required agreement." },
      { title: "Training and Activity Schedules", body: "Programs, training, matches and activities are announced through approved academy channels and may change for operational or urgent reasons. The academy will aim to communicate significant changes and explain options for sessions not delivered in accordance with the agreement and applicable law." },
      { id: "refunds", title: "Cancellation, Refunds and Service Quality", body: "Parents or guardians can request cancellation or a refund using the contact details below. Requests are assessed under the program terms disclosed at registration and applicable law, including rights concerning delivery of the contracted service and any defect or shortfall. This page neither guarantees automatic refunds nor excludes them in all circumstances. The academy must publish actual time limits, eligibility, treatment of unused sessions and response procedures before adopting a final refund policy." },
      { title: "Player Photos and Public Communications", body: "Using players' photos in their private records is different from publicly posting them for promotional or media purposes. Any separate consent required from a minor player's legal representative must be obtained before identifiable promotional publication. The privacy notice explains further information-handling practices." },
      { title: "Safety and Communication During Activities", body: "The academy communicates the organizational information needed for sessions and activities, including how to notify absence or circumstances that may affect participation. Nothing in these terms is intended to waive legal responsibilities or statutory consumer rights." },
      { title: "Portal Use and Account Security", body: "The portal must only be used by the authorized account holder to access players associated with their account. Do not share sign-in credentials or attempt to access others' records. The privacy notice explains data categories and rights requests." },
      { title: "Questions and Complaints", body: "For questions or complaints about registration, payments or activities, contact the academy using the email or phone below and include your request reference if available. Statutory rights to contact relevant public authorities remain unaffected." },
      { title: "Draft Status and Business Details", body: "This is a preliminary draft for review, not a substitute for program-specific terms showing prices, durations and cancellation rules. The operator's legal name, commercial registration number, official address and operational refund rules must be confirmed before final adoption." },
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
