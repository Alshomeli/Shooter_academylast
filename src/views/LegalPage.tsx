import type { ReactNode } from 'react';

type PolicyPage = 'privacy' | 'terms';
const contactEmail = 'football.shooter.academy@gmail.com';
const contactPhone = '+973 3228 7776';

export function LegalPage({ page }: { page: PolicyPage }) {
  const privacy = page === 'privacy';
  const sections: { title: string; body: ReactNode }[] = privacy ? [
    { title: 'البيانات التي نجمعها', body: 'قد تشمل بيانات التسجيل اسم ولي الأمر ووسائل التواصل وبيانات اللاعب وصورته وسجلات الحضور والتقييم والاشتراك وإثباتات الدفع والمستندات المقدمة للأكاديمية.' },
    { title: 'أغراض الاستخدام', body: 'نستخدم المعلومات لإدارة طلبات التسجيل، والتواصل بشأن التدريب، ومتابعة الحضور والتقييمات والاشتراكات، ومراجعة إثباتات الدفع.' },
    { title: 'الوصول إلى المعلومات', body: 'تُخصص صلاحيات الوصول إلى سجلات اللاعبين بحسب دور المستخدم في النظام. يُرجى عدم مشاركة بيانات تسجيل الدخول مع الآخرين.' },
    { title: 'حقوق ولي الأمر والتواصل', body: 'يمكن لولي الأمر التواصل مع الأكاديمية للاستفسار عن بياناته وبيانات اللاعب، أو طلب تصحيح معلومات غير دقيقة، أو الاستفسار عن الاحتفاظ بها أو حذفها وفق الالتزامات المعمول بها.' },
    { title: 'أمان المعلومات', body: 'تسعى الأكاديمية إلى حماية بيانات المستخدمين عبر ضوابط الوصول إلى الحسابات. لا يمكن ضمان انعدام المخاطر الأمنية في أي خدمة إلكترونية.' },
    { title: 'التحديثات', body: 'قد تُحدَّث هذه السياسة عند تغيير الخدمات أو الإجراءات، وتُنشر النسخة المحدثة في هذه الصفحة.' },
  ] : [
    { title: 'التسجيل والقبول', body: 'يجب تقديم معلومات صحيحة ومحدثة عن ولي الأمر واللاعب. يخضع قبول التسجيل وتخصيص الفريق أو الفئة لمراجعة إدارة الأكاديمية.' },
    { title: 'الاشتراكات والدفع المسبق', body: 'تُدفع رسوم الاشتراك مقدماً. عند الدفع بالتحويل البنكي، يرفع ولي الأمر إثبات التحويل للمراجعة، ولا يُعد الاشتراك مدفوعاً أو معتمداً إلا بعد موافقة الإدارة على الإثبات.' },
    { title: 'مواعيد التدريب والأنشطة', body: 'تُنشر تفاصيل البرامج ومواعيد الأنشطة عبر القنوات المعتمدة للأكاديمية. قد تتغير المواعيد لأسباب تنظيمية، ويُبلَّغ المشتركون بالتغييرات المهمة متى أمكن.' },
    { title: 'الإلغاء والاسترداد', body: 'يُرجى التواصل مع إدارة الأكاديمية قبل طلب إلغاء الاشتراك أو استرداد أي رسوم. تُحدد أهلية الاسترداد وفق شروط الاشتراك المعلنة للمشترك والقوانين المعمول بها؛ ولا تُعد هذه الصفحة وعداً باسترداد تلقائي أو رفض تلقائي.' },
    { title: 'استخدام البوابة', body: 'يجب الحفاظ على سرية الحساب واستخدام البوابة للاطلاع على بيانات اللاعبين المرتبطين بولي الأمر فقط. يمنع استخدام حساب شخص آخر دون تصريح.' },
    { title: 'الاستفسارات والشكاوى', body: 'يمكن إرسال الاستفسارات المتعلقة بالاشتراكات أو البيانات أو الخدمات إلى الأكاديمية عبر وسائل التواصل الموضحة أدناه.' },
  ];
  return <main dir="rtl" className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
    <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl">
      <header className="bg-gradient-to-l from-slate-950 to-red-950 px-6 py-9 text-white sm:px-10">
        <p className="text-sm font-bold text-red-200">SHOOTER ACADEMY · أكاديمية شوتر لكرة القدم</p>
        <h1 className="mt-3 text-3xl font-black">{privacy ? 'سياسة الخصوصية وحماية البيانات' : 'الشروط والأحكام'}</h1>
        <p className="mt-3 text-sm text-slate-200">معلومات موجهة لأولياء الأمور والمستخدمين</p>
      </header>
      <div className="space-y-7 px-6 py-8 sm:px-10">
        {sections.map(({ title, body }) => <section key={title}><h2 className="text-lg font-black">{title}</h2><p className="mt-2 leading-8 text-slate-600">{body}</p></section>)}
        <section className="border-t border-slate-200 pt-6"><h2 className="font-black">التواصل مع الأكاديمية</h2><p className="mt-2 text-slate-600"><a className="text-red-700 underline" href={`mailto:${contactEmail}`}>{contactEmail}</a><br/><a className="text-red-700 underline" href="tel:+97332287776">{contactPhone}</a></p></section>
        <nav className="flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm font-bold"><a href="/" className="text-red-700 underline">العودة إلى البوابة</a><a href="/privacy" className="text-red-700 underline">سياسة الخصوصية</a><a href="/terms" className="text-red-700 underline">الشروط والأحكام</a></nav>
        <p className="text-xs text-slate-500">هذه صياغة تشغيلية أولية تحتاج اعتماد إدارة الأكاديمية ومراجعة قانونية قبل اعتبارها سياسة نهائية.</p>
      </div>
    </article>
  </main>;
}
