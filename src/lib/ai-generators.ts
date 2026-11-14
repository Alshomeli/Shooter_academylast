import type { Team, Player, Subscription } from '@/types';
import type { AIContext } from '@/views/ai-context';

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

export function generatePositionEvaluation(c: AIContext, players: Player[]): string {
  const ideal: Record<string, number> = { 'حارس مرمى': 3, 'مدافع': 8, 'خط وسط': 10, 'مهاجم': 6 };
  const lines = Object.entries(c.positionCounts).map(([pos, count]) => {
    const need = ideal[pos] ?? 5;
    const status = count >= need ? '✅' : count >= need * 0.7 ? '🟡' : '⚠️';
    return `${status} ${pos}: ${count} لاعب (المثالي: ${need}) — ${count >= need ? 'كافٍ' : 'نقص'}`;
  });
  return [`📊 تقييم كفاية المراكز:`, '', ...lines, '', `الإجمالي: ${players.length} لاعب على ${c.teamsCount} فرق`].join('\n');
}

export function generateScheduleConflicts(teams: Team[]): string {
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
