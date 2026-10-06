import type { Team, Player, Subscription } from '@/types';
import type { AIContext } from '@/views/ai-context';

interface TrainingDrill {
  name: string;
  duration: number;
  description: string;
}

interface TrainingSession {
  type: string;
  category: string;
  intensity: 'منخفض' | 'متوسط' | 'عالي';
  duration: number;
  drills: TrainingDrill[];
  tips: string;
}

export const TRAINING_TYPES: Record<string, TrainingSession> = {
  'لياقة بدنية': {
    type: 'لياقة بدنية', category: 'بدني', intensity: 'عالي', duration: 90,
    drills: [
      { name: 'إحماء ديناميكي', duration: 15, description: 'ركض خفيف + تمارين إطالة ديناميكية للعضلات الكبرى (5 لفات حول الملعب)' },
      { name: 'سرعات متقطعة (Sprint Intervals)', duration: 20, description: '6 جولات: 20 ثانية عدو سريع + 40 ثانية مشي. راحة 30ث بين الجولات.' },
      { name: 'تقوية العضلات النووية (Core)', duration: 15, description: '3 جولات × 15 تكرار: بلانك، تمارين بطن مائلة، قفزات جانبية' },
      { name: 'تحمل لاأكسجي (Anaerobic)', duration: 20, description: '4 جولات: 30ث جري بأقصى سرعة + 30ث راحة. تركيز على التسارع الانفجاري.' },
      { name: 'تبريد وإطالة', duration: 20, description: 'ركض خفيف + إطالة ثابتة لكل العضلات + تمارين تنفس' },
    ],
    tips: 'ركز على التدرج في الحدة. راقب نبض اللاعبين وراقب علامات الإرهاق. امنح راحة كافية بين الجولات.',
  },
  'تكتيكي': {
    type: 'تكتيكي', category: 'تكتيك', intensity: 'متوسط', duration: 90,
    drills: [
      { name: 'إحماء بالكرة', duration: 15, description: 'تمريرات ثنائية وثلاثية في مساحات صغيرة + تحرك بدون كرة' },
      { name: 'الروندو (Rondo 4v2)', duration: 20, description: '4 لاعبين يحافظون على الكرة ضد 2 في مربع 8×8م. تركيز على لمسة واحدة والتحرك السريع.' },
      { name: 'بناء اللعب من الخلف', duration: 25, description: 'المدافعون + الحارس ضد 3 مهاجمين. بدء من الحارس والوصول للثلث الهجومي.' },
      { name: 'الهجوم المضاد السريع', duration: 20, description: '3v2 سريع: استرجاع الكرة والانتقال لهجمة مباشرة في 8 ثوانٍ' },
      { name: 'مباراة مصغرة 6v6', duration: 10, description: 'ملعب نصف مساحة، تركيز على تطبيق ما تم تدريبه' },
    ],
    tips: 'أوقف اللعب عند الأخطاء للتصحيح الفوري. استخدم المخروط لتحديد المساحات. ركز على التوقيت والتمركز.',
  },
  'فني': {
    type: 'فني (مهارات)', category: 'فني', intensity: 'منخفض', duration: 75,
    drills: [
      { name: 'إحماء بالكرة وتنشيط', duration: 15, description: 'قود الكرة بأنحاء الملعب + تمريرات قصيرة بين اللاعبين' },
      { name: 'السيطرة على الكرة (First Touch)', duration: 20, description: 'استلام الكرة بصدر/فخذ/قدم وتمرير فوري. 3 جولات × 20 تكرار.' },
      { name: 'المراوغة والاختراق', duration: 20, description: 'مراوغة بين الأقماع + 1v1 ضد مدافع. تركيز على تغيير الاتجاه والسرعة.' },
      { name: 'التسديد على المرمى', duration: 20, description: 'تسديد من زوايا مختلفة. داخل القدم، خارج القدم، تسديد بالرأس.' },
    ],
    tips: 'ركّز على جودة اللمسة الأولى. كرر كل تمرين حتى الإتقان قبل الانتقال. شجع اللاعبين على الإبداع.',
  },
  'حراس مرمى': {
    type: 'حراس مرمى', category: 'حراسة', intensity: 'متوسط', duration: 60,
    drills: [
      { name: 'إحماء حراس المرمى', duration: 15, description: 'تمارين رد فعل + حركات قدمية في خط المرمى + إطالة للذراعين' },
      { name: 'رد الفعل والتصديات', duration: 20, description: 'كرات متتالية من مسافات قريبة. تصدي باليدين، بالقدمين، وعلى الأرض.' },
      { name: 'الكرات العالية والكرات العرضية', duration: 15, description: 'استقبال كرات عالية وعرضية + التمركز عند الكرات الثابتة' },
      { name: 'توزيع الكرة وبناء اللعب', duration: 10, description: 'رميات يد طويلة + تمريرات أرضية دقيقة للمدافعين' },
    ],
    tips: 'درّب الحارس على التواصل مع الدفاع. ركز على سرعة رد الفعل والتويق. امنح كل حارس وقتاً كافياً.',
  },
  'مباراة مصغرة': {
    type: 'مباراة مصغرة', category: 'تطبيقي', intensity: 'عالي', duration: 60,
    drills: [
      { name: 'إحماء تكتيكي', duration: 10, description: 'تمريرات في مجموعات + تحرك سريع بدون كرة' },
      { name: 'مباراة 4v4 بشروط', duration: 20, description: 'لمسان أقصى، هدف يحسب بكرات ثابتة فقط، تركيز على الانتشار' },
      { name: 'مباراة 7v7 حرة', duration: 25, description: 'مباراة حرة مع تطبيق التكتيكات المدروبة. تبديلات كل 5 دقائق.' },
      { name: 'تبريد ومناقشة', duration: 5, description: 'ركض خفيف + نقاش حول الأخطاء والنجاحات' },
    ],
    tips: 'دع اللاعبين يطبقون ما تعلموه بحرية. سجل المباراة للتحليل لاحقاً. قلل التدخل واتركهم تلعب.',
  },
  'ضغط عالي': {
    type: 'ضغط عالي (Pressing)', category: 'تكتيك متقدم', intensity: 'عالي', duration: 85,
    drills: [
      { name: 'إحماء بالضغط', duration: 15, description: 'لعبة المصافحة: لاعبان يتصافحان ثم يركضان لضغط الخصم. 3 جولات.' },
      { name: 'ضغط جماعي 4v4', duration: 20, description: 'في نصف ملعب: الفريق بدون كرة يضغط في 5 ثوانٍ. هدف: استرجاع الكرة في الثلث الأمامي.' },
      { name: 'كتم المساحات (Pressing Trap)', duration: 25, description: 'إجبار الخصم على اللعب لجهة واحدة ثم الضغط الجماعي لقطع الكرة.' },
      { name: 'انتقال من هجوم لدفاع', duration: 15, description: 'فقد الكرة → ضغط فوري 6 ثوانٍ → تراجع إن فشل الضغط.' },
      { name: 'مباراة بتطبيق الضغط', duration: 10, description: 'مباراة 8v8 مع شرط: الضغط بعد فقد الكرة خلال 5 ثوانٍ.' },
    ],
    tips: 'الضغط الجماعي يتطلب لياقة عالية وتنسيق. درّب التوقيت — متى يبدأ الضغط ومن يقود. الرسائل الصوتية بين اللاعبين أساسية.',
  },
  'كرات ثابتة': {
    type: 'كرات ثابتة (Set Pieces)', category: 'تكتيك متخصص', intensity: 'متوسط', duration: 75,
    drills: [
      { name: 'إحماء بالكرة', duration: 10, description: 'تمريرات قصيرة + تمارين استلام الكرة' },
      { name: 'ركلات ركنية هجومية', duration: 20, description: 'تدريب الحركات الثابتة: حاجز، قريب، بعيد. تكرار 10 مرات لكل جهة.' },
      { name: 'ركلات حرة مباشرة', duration: 15, description: 'تمارين تسديد من خارج المنطقة. تخصيص لاعبين محترفين للركلات.' },
      { name: 'كرات ثابتة دفاعية', duration: 20, description: 'تمركز الرجال عند الكرات الركنية. حراسة رجل لرجل ومنطقة التغطية.' },
      { name: 'تطبيق في مباراة مصغرة', duration: 10, description: 'مباراة مع تركيز على تنفيذ الكرات الثابتة المدرّبة.' },
    ],
    tips: 'الكرات الثابتة تحسم المباريات. درّبها بشكل دوري. حدد مسؤوليات كل لاعب بوضوح. سجّل التدريبات للمراجعة.',
  },
  'إعداد ذهني': {
    type: 'إعداد ذهني (Mental)', category: 'نفسي', intensity: 'منخفض', duration: 60,
    drills: [
      { name: 'جلسة تركيز', duration: 15, description: 'تمارين تنفس وتأمل موجّه. تركيز على اللحظة الحالية وإزالة التشتت.' },
      { name: 'تصور ذهني (Visualization)', duration: 15, description: 'كل لاعب يتخيل سيناريو مباراة ناجح: تسديد، تصدي، تمرير حاسم. 5 دقائق صمت.' },
      { name: 'بناء الثقة', duration: 15, description: 'كل لاعب يذكر 3 نقاط قوة لديه. المدرب يعزز الثقة بكلمات إيجابية.' },
      { name: 'إدارة الضغط', duration: 15, description: 'تمارين محاكاة الضغط: ركلة جزاء أمام الفريق. تركيز على الروتين الذهني.' },
    ],
    tips: 'الإعداد الذهني مهم بقدر الإعداد البدني. اجعل الجلسات هادئة ومنظمة. تجنب الضغط الزائد. شجع الثقة والتركيز.',
  },
  'قوة وتمارين': {
    type: 'قوة وتمارين (Strength)', category: 'بدني متقدم', intensity: 'عالي', duration: 80,
    drills: [
      { name: 'إحماء وتمارين حركية', duration: 15, description: 'إطالة ديناميكية + تمارين مفصلية + ركض خفيف' },
      { name: 'قوة الأرجل (Plyometrics)', duration: 20, description: 'قفزات عمودية، قفزات جانبية، قفزات على صندوق. 3 جولات × 12 تكرار.' },
      { name: 'قوة الجزع العلوي', duration: 15, description: 'تمارين دفع وجذب بوزن الجسم: ضغط، عقلة معدلة، تجديف بالدمبل.' },
      { name: 'تقوية المفاصل', duration: 15, description: 'تمارين توازن على ساق واحدة، تمارين مطاطية للركبة والكاحل.' },
      { name: 'تبديد وإطالة', duration: 15, description: 'إطالة ثابتة + Foam Roller + تمارين استرخاء' },
    ],
    tips: 'القوة أساس السرعة والقفز. ابدأ بوزن الجسم قبل الأوزان. راقب التقنية بدقة. تجنب الإرهاق قبل المباريات.',
  },
};

function getAgeSpecificAdvice(ageGroup: string): string {
  if (ageGroup.includes('U-10') || ageGroup.includes('U-8')) return 'في هذه الفئة، ركز على المتعة واللعب الحر. اجعل التمارين قصيرة ومتنوعة.';
  if (ageGroup.includes('U-12') || ageGroup.includes('U-11')) return 'في هذه الفئة، ابدأ بتعليم التكتيكات الأساسية بأسلوب ممتع. ركز على اللمسة الأولى والتمرير القصير.';
  if (ageGroup.includes('U-15') || ageGroup.includes('U-14')) return 'في هذه الفئة، يمكن رفع الحدة التدريبية. ادمج التكتيك المتقدم واللياقة البدنية.';
  return 'اضبط الحدة التدريبية حسب مستوى الفريق. تأكد من الإحماء الجيد والترطيب الكافي.';
}

export function generateTrainingPlan(q: string, teams: Team[]): string {
  const lower = q.toLowerCase();
  const mentionedTeam = teams.find((t) => q.includes(t.name) || q.includes(t.ageGroup) || lower.includes(t.ageGroup.toLowerCase()));

  let matchedType: string | null = null;
  for (const key of Object.keys(TRAINING_TYPES)) {
    if (q.includes(key) || lower.includes(key.toLowerCase())) { matchedType = key; break; }
  }

  if (!matchedType) {
    if (/(لياقة|بدني|تحمل|سرعة|قوة|fitness|stamina)/.test(q)) matchedType = 'لياقة بدنية';
    else if (/(تكتيك|تكتكي|تمركز|بناء لعب|ضغط|tactical)/.test(q)) matchedType = 'تكتيكي';
    else if (/(مهارة|فني|مراوغة|تمرير|تسديد|استلام|technical|skill)/.test(q)) matchedType = 'فني';
    else if (/(حارس|مرمى|تصدي|goalkeeper|gk)/.test(q)) matchedType = 'حراس مرمى';
    else if (/(مباراة|مصغرة|لعب|match|game|scrimmage)/.test(q)) matchedType = 'مباراة مصغرة';
    else if (/(ضغط|pressing|كتم|high press)/.test(q)) matchedType = 'ضغط عالي';
    else if (/(ثابتة|ركنية|ركلة حرة|set piece|corner)/.test(q)) matchedType = 'كرات ثابتة';
    else if (/(ذهني|نفسي|تركيز|ثقة|mental|psychology)/.test(q)) matchedType = 'إعداد ذهني';
    else if (/(قوة|تمرين|عضلات|strength|weights|gym)/.test(q)) matchedType = 'قوة وتمارين';
  }

  if (!matchedType && (/(اقترح|اقتراح|أنواع|خيارات|قائمة|suggest|options|types)/.test(q) || q.trim().length < 5)) {
    const teamName = mentionedTeam ? `لفريق ${mentionedTeam.name}` : '';
    const types = Object.keys(TRAINING_TYPES);
    return [
      `🎯 أنواع الحصص التدريبية المتاحة ${teamName}:`,
      '',
      ...types.map((t, i) => {
        const s = TRAINING_TYPES[t];
        return `${i + 1}. ${s.type} — ${s.category} | شدة ${s.intensity} | ${s.duration} دقيقة\n   ${s.drills.length} تمارين: ${s.drills.map((d) => d.name).join('، ')}`;
      }),
      '',
      '💡 اكتب اسم النوع أو قل "اقترح تدريب لياقة بدنية" للحصول على خطة تفصيلية.',
    ].join('\n');
  }

  if (!matchedType) {
    const types = Object.keys(TRAINING_TYPES);
    return ['لم أتعرف على نوع التدريب. الأنواع المتاحة:', ...types.map((t) => `• ${t}`), '', 'مثال: "اقترح تدريب تكتيكي لفريق U-12"'].join('\n');
  }

  const session = TRAINING_TYPES[matchedType];
  const teamContext = mentionedTeam ? `لفريق ${mentionedTeam.name} (${mentionedTeam.ageGroup})` : 'لأي فريق';
  const ageAdvice = mentionedTeam ? getAgeSpecificAdvice(mentionedTeam.ageGroup) : '';
  const drillLines = session.drills.map((d, i) => `${i + 1}. ⚽ ${d.name} (${d.duration} دقيقة)\n   ${d.description}`);

  return [
    `📋 خطة تدريب: ${session.type} ${teamContext}`,
    `المدة: ${session.duration} دقيقة | الشدة: ${session.intensity} | التصنيف: ${session.category}`,
    '',
    '--- التمارين ---',
    '',
    ...drillLines,
    '',
    `💡 نصائح المدرب: ${session.tips}`,
    ageAdvice ? `\n👶 ملاحظة لفئة ${mentionedTeam?.ageGroup}: ${ageAdvice}` : '',
    '',
    'اكتب نوعاً آخر للحصول على خطة مختلفة، أو "أنواع التدريب" لعرض القائمة.',
  ].join('\n');
}

/* ----------------------- Nutrition Advisor ----------------------- */

export function generateNutritionAdvice(q: string, teams: Team[]): string {
  const lower = q.toLowerCase();
  const mentionedTeam = teams.find((t) => q.includes(t.name) || q.includes(t.ageGroup) || lower.includes(t.ageGroup.toLowerCase()));

  if (/(ترطيب|hydration|ماء|سوائل)/.test(q)) {
    return [
      '💧 إرشادات عامة للترطيب:',
      '• اشرب الماء بانتظام خلال اليوم وقبل وأثناء وبعد النشاط.',
      '• في الجو الحار أو التدريب الطويل، راقب علامات الإجهاد أو الجفاف وتوقف إذا ظهرت أعراض غير طبيعية.',
      '• للأطفال والناشئين، لا نحدد جرعات أو مشروبات رياضية أو مكملات بشكل آلي؛ يتم ذلك مع ولي الأمر ومختص صحي عند الحاجة.',
    ].join('\n');
  }

  if (/(قبل|مباراة|pre.?match|before)/.test(q)) {
    return [
      '🍎 إرشادات عامة قبل المباراة:',
      '• وجبة متوازنة ومعتادة قبل النشاط بوقت كافٍ، مع كربوهيدرات ومصدر بروتين وطعام سهل الهضم.',
      '• تجنب تجربة أطعمة أو مكملات جديدة يوم المباراة.',
      '• حافظ على شرب الماء بصورة منتظمة.',
      '• للناشئين، أي خطة دقيقة أو مكمل غذائي يجب أن يراجعها ولي الأمر وأخصائي تغذية أو طبيب.',
    ].join('\n');
  }

  if (/(بعد|after|استشفاء|recovery)/.test(q)) {
    return [
      '🥗 إرشادات عامة بعد النشاط:',
      '• تناول وجبة أو وجبة خفيفة متوازنة بعد النشاط.',
      '• استمر في شرب الماء وخذ وقتًا كافيًا للراحة والنوم.',
      '• لا تستخدم مكملات أو مساحيق بروتين للاعبين الناشئين بناءً على توصية آلية.',
      '• عند وجود هدف غذائي خاص أو مشكلة صحية، يُرجع إلى ولي الأمر ومختص صحي.',
    ].join('\n');
  }

  if (/(عضلات|كتلة|بروتين|strength|muscle|weight gain)/.test(q)) {
    return [
      '💪 للتطور البدني عند الناشئين:',
      '• الأساس هو وجبات متوازنة، نوم كافٍ، وتدريب مناسب للعمر بإشراف المدرب.',
      '• لا أوصي بحميات تقييدية أو جرعات بروتين أو مكملات أو منتجات لزيادة الكتلة للاعبين القاصرين.',
      '• إذا كان هناك هدف غذائي أو بدني محدد، يكون التقييم مع ولي الأمر وأخصائي تغذية رياضية مؤهل.',
    ].join('\n');
  }

  if (mentionedTeam) {
    return [
      `🍽️ إرشادات غذائية عامة لفريق ${mentionedTeam.name} (${mentionedTeam.ageGroup}):`,
      '• وجبات منتظمة ومتوازنة تشمل الحبوب أو النشويات، البروتينات، الخضار والفواكه.',
      '• شرب الماء بانتظام خلال اليوم.',
      '• تجنب الحميات القاسية والمكملات غير الموصوفة.',
      '• أي خطة مخصصة للاعبين الناشئين تُراجع مع ولي الأمر وأخصائي تغذية رياضية مؤهل.',
    ].join('\n');
  }

  return [
    '🍎 مستشار التغذية العامة للناشئين. أستطيع تقديم إرشادات عامة حول:',
    '• الوجبات المتوازنة قبل وبعد النشاط',
    '• الترطيب العام',
    '• عادات الاستشفاء والنوم',
    '• متى يلزم الرجوع إلى ولي الأمر أو مختص صحي',
    '',
    'لا أقدم جرعات مكملات أو حميات تقييدية أو خطط زيادة/خفض وزن للاعبين القاصرين.',
  ].join('\n');
}

/* ----------------------- Communication Templates ----------------------- */

export const fmt = (n: number) => n.toLocaleString('ar-EG');

export function generateCommunicationTemplate(q: string, unpaidSubs: Subscription[], players: Player[], scheduledMatches: { opponent: string; matchDate: string; location: string }[], currency: string): string {
  if (/(تذكير|اشتراك|متأخر|reminder|subscription)/.test(q)) {
    const sampleUnpaid = unpaidSubs.slice(0, 3).map((sub) => {
      const p = players.find((pl) => pl.id === sub.playerId);
      return p ? `${p.name}: ${fmt(sub.amount)} ${currency}` : null;
    }).filter(Boolean).join('\n');
    return [
      '📨 قالب رسالة تذكير اشتراك:',
      '',
      '---',
      'السيد/ة ولي أمر اللاعب المحترم،',
      '',
      'نعلمكم بأن اشتراك ابنكم الرياضي قد تأخر عن الدفع. نرجو التكرم بتسديد المبلغ المستحق في أقرب وقت ممكن لضمان استمرار خدمات الأكاديمية.',
      '',
      sampleUnpaid ? `التفاصيل:\n${sampleUnpaid}` : '',
      '',
      'للاستفسار: يرجى التواصل مع إدارة الأكاديمية.',
      'مع خالص الشكر،',
      'إدارة أكاديمية شوتر لكرة القدم',
      '---',
    ].filter(Boolean).join('\n');
  }

  if (/(دعوة|مباراة|invite|match)/.test(q)) {
    const nextMatch = [...scheduledMatches].sort((a, b) => a.matchDate.localeCompare(b.matchDate))[0];
    return [
      '📨 قالب دعوة مباراة:',
      '',
      '---',
      'السيد/ة ولي أمر اللاعب المحترم،',
      '',
      nextMatch
        ? `يسعدنا دعوتكم لحضور مباراة فريق ابنكم ضد ${nextMatch.opponent}.\nالتاريخ: ${nextMatch.matchDate}\nالمكان: ${nextMatch.location}\n`
        : 'يسعدنا دعوتكم لحضور مباراة الفريق القادمة. سيتم تحديد الموعد قريباً.\n',
      'نرجو حضور اللاعب قبل المباراة بـ 45 دقيقة.',
      'التشجيع والحضور يعني الكثير للاعبين!',
      '',
      'مع تحيات،',
      'إدارة أكاديمية شوتر لكرة القدم',
      '---',
    ].filter(Boolean).join('\n');
  }

  if (/(حضور|تقرير|attendance|report)/.test(q)) {
    return [
      '📨 قالب تقرير حضور لولي الأمر:',
      '',
      '---',
      'السيد/ة ولي أمر اللاعب المحترم،',
      '',
      'نوافيكم بتقرير الحضور الأسبوعي لابنكم:',
      '• عدد التدريبات الأسبوعية: [عدد]',
      '• نسبة الحضور: [%]',
      '• أيام الغياب: [التواريخ]',
      '',
      'الالتزام بالحضور أساس التطور الرياضي. نقدر متابعتكم.',
      '',
      'مع تحيات،',
      'إدارة أكاديمية شوتر لكرة القدم',
      '---',
    ].join('\n');
  }

  if (/(إعلان|announcement|عام)/.test(q)) {
    return [
      '📨 قالب إعلان عام:',
      '',
      '---',
      'إلى أولياء أمور اللاعبين الكرام،',
      '',
      'يسعدنا إعلامكم بأن الأكاديمية ستعلن قريباً عن [الفعالية/البطولة].',
      'تابعوا قنوات التواصل للمزيد من التفاصيل.',
      '',
      'شكراً لثقتكم ودعمكم المستمر.',
      'إدارة أكاديمية شوتر لكرة القدم',
      '---',
    ].join('\n');
  }

  return [
    'أنا مسؤول التواصل. أستطيع صياغة:',
    '• رسالة تذكير اشتراك',
    '• دعوة مباراة لأولياء الأمور',
    '• تقرير حضور لولي الأمر',
    '• إعلان عام للأكاديمية',
    '',
    'اكتب "رسالة تذكير اشتراك" أو "دعوة مباراة" للبدء.',
  ].join('\n');
}

/* ----------------------- Talent Scout & Position Evaluation ----------------------- */

export function generatePlayerComparison(q: string, players: Player[]): string {
  const names = q.split(/و|vs|against|قارن/i).map((s) => s.replace(/[^\u0600-\u06FFa-zA-Z\s]/g, '').trim()).filter((s) => s.length > 1);
  const matched = names.map((n) => players.find((p) => p.name.toLowerCase().includes(n.toLowerCase()))).filter(Boolean) as Player[];
  if (matched.length < 2) return 'للمقارنة، اكتب اسم لاعبين: "قارن [اللاعب 1] و [اللاعب 2]". مثال: "قارن أحمد وخالد".';

  const [a, b] = matched;
  return [
    `⚖️ مقارنة اللاعبين:`,
    '',
    `اللاعب الأول: ${a.name}`,
    `• المركز: ${a.position} · رقم القميص: ${a.jerseyNumber}`,
    `• الفريق: ${a.teamId} · الحالة: ${a.status === 'active' ? 'نشط' : 'موقوف'}`,
    `• تاريخ الميلاد: ${a.birthDate}`,
    '',
    `اللاعب الثاني: ${b.name}`,
    `• المركز: ${b.position} · رقم القميص: ${b.jerseyNumber}`,
    `• الفريق: ${b.teamId} · الحالة: ${b.status === 'active' ? 'نشط' : 'موقوف'}`,
    `• تاريخ الميلاد: ${b.birthDate}`,
    '',
    a.position === b.position ? '📍 نفس المركز — يمكن المقارنة المباشرة في الأداء.' : '📍 مراكز مختلفة — المقارنة في الجوانب المشتركة.',
    a.jerseyNumber < b.jerseyNumber ? `رقم ${a.name} أقل (${a.jerseyNumber}).` : `رقم ${b.name} أقل (${b.jerseyNumber}).`,
  ].join('\n');
}

export function generateTalentScouting(c: AIContext, players: Player[]): string {
  const byPosition: Record<string, Player[]> = {};
  players.filter((p) => p.status === 'active').forEach((p) => {
    if (!byPosition[p.position]) byPosition[p.position] = [];
    byPosition[p.position].push(p);
  });

  const positionAnalysis = Object.entries(byPosition).map(([pos, ps]) => {
    const avgJersey = ps.reduce((s, p) => s + p.jerseyNumber, 0) / ps.length;
    return `• ${pos}: ${ps.length} لاعب (متوسط رقم القميص ${avgJersey.toFixed(0)})`;
  }).join('\n');

  const youngTalents = players.filter((p) => p.status === 'active').sort((a, b) => b.birthDate.localeCompare(a.birthDate)).slice(0, 5);
  const talentList = youngTalents.map((p, i) => `${i + 1}. ${p.name} — ${p.position} · مولود ${p.birthDate} · رقم ${p.jerseyNumber}`).join('\n');

  return [
    `🔍 تقرير اكتشاف المواهب:`,
    '',
    '--- توزيع المراكز ---',
    positionAnalysis || 'لا توجد بيانات.',
    '',
    '--- أصغر اللاعبين (مواهب واعدة بالعمر) ---',
    talentList || 'لا توجد بيانات.',
    '',
    '--- توصيات الكشافة ---',
    `• ركز على الفئات الصغيرة لاكتشاف المواهب مبكراً`,
    `• نظّم أيام كشف مفتوحة لاستقطاب لاعبين جدد`,
    `• راقب اللاعبين متعددي المراكز — قيمة عالية`,
    c.positionCounts['حارس مرمى'] < 3 ? `⚠️ نقص في حراس المرمى (${c.positionCounts['حارس مرمى'] || 0}). يُنصح باستقطاب حراس.` : '✅ تغطية حراس المرمى كافية.',
  ].join('\n');
}

export function generatePositionEvaluation(c: AIContext, players: Player[]): string {
  const ideal: Record<string, number> = { 'حارس مرمى': 3, 'مدافع': 8, 'خط وسط': 10, 'مهاجم': 6 };
  const lines = Object.entries(c.positionCounts).map(([pos, count]) => {
    const need = ideal[pos] ?? 5;
    const status = count >= need ? '✅' : count >= need * 0.7 ? '🟡' : '⚠️';
    return `${status} ${pos}: ${count} لاعب (المثالي: ${need}) — ${count >= need ? 'كافٍ' : 'نقص'}`;
  });
  return [`📊 تقييم كفاية المراكز:`, '', ...lines, '', `الإجمالي: ${players.length} لاعب على ${c.teamsCount} فرق`].join('\n');
}

export function generateScheduleConflicts(c: AIContext, teams: Team[]): string {
  const slotMap: Record<string, string[]> = {};
  teams.forEach((tm) => {
    tm.trainingDays.forEach((day) => {
      const slot = `${day}-${tm.trainingTime}`;
      if (!slotMap[slot]) slotMap[slot] = [];
      slotMap[slot].push(tm.name);
    });
  });
  const conflicts = Object.entries(slotMap).filter(([, names]) => names.length > 1);
  if (conflicts.length === 0) return ['✅ لا توجد تعارضات في الجدول التدريبي.', '', 'جميع الفرق لها مواعيد منفصلة.'].join('\n');
  const lines = conflicts.map(([slot, names]) => `⚠️ ${slot}: ${names.join(' ضد ')}`);
  return [`📅 التعارضات المكتشفة (${conflicts.length}):`, '', ...lines, '', '💡 يُنصح بإعادة توزيع المواعيد لتجنب التضارب.'].join('\n');
}

export function generateMatchPrep(c: AIContext, teams: Team[]): string {
  const nextMatch = [...c.scheduled].sort((a, b) => a.matchDate.localeCompare(b.matchDate))[0];
  if (!nextMatch) return 'لا توجد مباريات قادمة لتحضير خطة استعداد. جدولة مباراة أولاً.';

  const team = teams.find((tm) => tm.id === nextMatch.teamId);
  const teamPlayers = c.players.filter((p) => p.teamId === nextMatch.teamId && p.status === 'active');
  const daysUntil = Math.ceil((new Date(nextMatch.matchDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return [
    `🏟️ خطة استعداد للمباراة:`,
    `• الفريق: ${team?.name ?? 'غير محدد'} (${team?.ageGroup ?? ''})`,
    `• الخصم: ${nextMatch.opponent}`,
    `• التاريخ: ${nextMatch.matchDate} · المكان: ${nextMatch.location}`,
    `• الأيام المتبقية: ${daysUntil > 0 ? daysUntil : 'اليوم'}`,
    `• اللاعبون المتاحون: ${teamPlayers.length}`,
    '',
    '--- خطة التدريب قبل المباراة ---',
    daysUntil >= 7
      ? `• قبل ٧ أيام: تركيز تكتيكي + لياقة بدنية عالية`
      : daysUntil >= 3
        ? `• قبل ٣ أيام: تكتيك خاص للخصم + المراوغة والتمرير`
        : `• اليوم الأخير: إحماء خفيف + مراجعة الخطة التكتيكية`,
    `• قبل يوم: راحة خفيفة + تمارين استرخاء`,
    `• يوم المباراة: إحماء ٣٠ دقيقة قبل المباراة + ترطيب جيد`,
    '',
    '--- النصائح ---',
    `• راجع تسجيلات الخصم إن توفرت`,
    `• ركز على نقاط القوة والضعف في الفريق المنافس`,
    `• حافظ على روح معنوية عالية للاعبين`,
    `• تأكد من جاهزية الحراس والأدوات الطبية`,
  ].join('\n');
}

export function generateFullReport(c: AIContext): string {
  const collectionRate = c.paidSubs.length + c.unpaidSubs.length > 0 ? Math.round((c.paidSubs.length / (c.paidSubs.length + c.unpaidSubs.length)) * 100) : 0;
  return [
    '📋 ============ التقرير الشامل للأكاديمية ============',
    '',
    '--- القسم المالي ---',
    `• إجمالي الإيرادات: ${fmt(c.revenue)} ${c.currency}`,
    `• إجمالي المصروفات: ${fmt(c.expenses)} ${c.currency}`,
    `• صافي الربح: ${fmt(c.net)} ${c.currency} ${c.net >= 0 ? '✅' : '⚠️'}`,
    `• نسبة تحصيل الاشتراكات: ${collectionRate}%`,
    `• متأخرات: ${c.unpaidSubs.length} لاعب (${fmt(c.unpaidAmount)} ${c.currency})`,
    '',
    '--- القسم الفني ---',
    `• الفرق: ${c.teamsCount} · اللاعبون: ${c.players.length} (${c.activePlayers} نشط)`,
    `• جلسات التدريب: ${c.totalSessions}`,
    `• الكادر الفني والإداري: ${c.staffCount}`,
    '',
    '--- القسم الرياضي ---',
    `• مباريات ملعوبة: ${c.completedMatches.length}`,
    `• سجل: ${c.wins} فوز · ${c.draws} تعادل · ${c.losses} خسارة`,
    `• معدل الفوز: ${c.winRate}%`,
    `• الأهداف: ${c.goalsScored} لصالح · ${c.goalsConceded} ضد · الفارق ${c.goalsScored - c.goalsConceded > 0 ? '+' : ''}${c.goalsScored - c.goalsConceded}`,
    `• مباريات مجدولة: ${c.scheduled.length}`,
    '',
    '--- توزيع المراكز ---',
    ...Object.entries(c.positionCounts).sort((a, b) => b[1] - a[1]).map(([pos, count]) => `• ${pos}: ${count} لاعب`),
    '',
    '--- البطولات ---',
    `• مشاركة في ${c.tournaments.length} بطولة`,
    '',
    '--- التوصيات ---',
    c.unpaidAmount > 0 ? `⚠️ متابعة تحصيل ${fmt(c.unpaidAmount)} ${c.currency} متأخرات` : '✅ لا توجد متأخرات',
    c.winRate < 40 && c.completedMatches.length > 0 ? '⚠️ معدل الفوز منخفض — يحتاج تحسين تدريبي' : '✅ مستوى فني جيد',
    c.totalSessions === 0 ? '⚠️ لا توجد تدريبات مسجلة — ابدأ بجدولة جلسات' : `✅ ${c.totalSessions} جلسة تدريبية مسجلة`,
    '',
    '========================================',
  ].join('\n');
}
