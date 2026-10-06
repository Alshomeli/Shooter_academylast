import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, Send, Bot, User, TrendingUp, Users, Trophy,
  Brain, Zap, Target, Activity, RefreshCw, FileText, Lightbulb, AlertTriangle, CheckCircle2,
  Apple, Search, ClipboardList, MessageSquare,
} from 'lucide-react';
import type { Player, Team, Staff, Match, Training, Transaction, Subscription, Tournament, Parent, Attendance, PlayerEvaluation, Lang, Role } from '@/types';
import { PageHeader } from '@/components/ui';
import { AIOperationsPanel } from '@/components/AIOperationsPanel';
import { ChatGPTIntegrationStatus } from '@/components/ChatGPTIntegrationStatus';
import { tr } from '@/lib/i18n';
import { fetchAllPlayerFiles, type UploadedFile } from '@/lib/uploads';
import type { AIContext } from '@/views/ai-context';
import { askManagementAI, type ManagementAIPersona } from '@/lib/ai-assistant';
import {
  generateNutritionAdvice, generateCommunicationTemplate,
  generatePositionEvaluation,
  generateScheduleConflicts, generateMatchPrep, generateFullReport, fmt,
} from '@/lib/ai-generators';

interface AICenterProps {
  players: Player[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  staff: Staff[];
  teams: Team[];
  matches: Match[];
  trainings: Training[];
  tournaments: Tournament[];
  parents: Parent[];
  attendance: Attendance[];
  evaluations: PlayerEvaluation[];
  activeRole: Role;
  onRefresh: () => Promise<void>;
  lang: Lang;
}

type PersonaId =
  | 'technical' | 'financial' | 'players' | 'matches'
  | 'documents' | 'training' | 'nutrition' | 'scout'
  | 'operations' | 'communication';

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
}

interface Persona {
  id: PersonaId;
  name: string;
  tagline: string;
  icon: typeof Activity;
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'teal' | 'cyan' | 'orange' | 'rose';
  welcome: string;
}

const PERSONAS: Persona[] = [
  { id: 'technical', name: 'المحلل الفني', tagline: 'تحليل الأداء والتدريبات', icon: Activity, color: 'emerald',
    welcome: 'مرحبًا! أنا المحلل الفني. يمكنني تحليل أداء الفرق، معدلات الحضور في التدريبات، ومخرجات الجلسات. اكتب سؤالك أو اختر اقتراحًا من الأسفل.' },
  { id: 'financial', name: 'المستشار المالي', tagline: 'الإيرادات والمصروفات والأرباح', icon: TrendingUp, color: 'blue',
    welcome: 'أهلًا! أنا المستشار المالي. سأقوم بحساب الإيرادات والمصروفات وصافي الربح، وتحليل الاشتراكات المدفوعة والمتأخرة. كيف يمكنني مساعدتك؟' },
  { id: 'players', name: 'خبير اللاعبين', tagline: 'إحصاءات اللاعبين والمراكز', icon: Users, color: 'amber',
    welcome: 'سلام! أنا خبير اللاعبين. أستطيع تزويدك بإحصاءات اللاعبين، توزيع المراكز، وحالة تقييمات الأداء. لا أرتب اللاعبين إلا اعتمادًا على تقييمات فعلية مسجلة.' },
  { id: 'matches', name: 'مخطط المباريات', tagline: 'النتائج والمباريات القادمة', icon: Trophy, color: 'red',
    welcome: 'مرحبًا! أنا مخطط المباريات. سأعرض لك معدل الفوز، سجل النتائج، والمباريات المجدولة القادمة.' },
  { id: 'documents', name: 'مدير المستندات', tagline: 'تحليل ملفات اللاعبين', icon: FileText, color: 'amber',
    welcome: 'مرحبًا! أنا مدير مستندات اللاعبين. أستطيع تحليل الملفات المرفوعة، تحديد اللاعبين الناقصين للمستندات، وتقديم توصيات.' },
  { id: 'training', name: 'مخطط التدريبات', tagline: 'اقتراح أنواع الحصص التدريبية', icon: Zap, color: 'teal',
    welcome: 'مرحبًا! أنا مخطط التدريبات. أستطيع عرض الجلسات التدريبية المسجلة ومواعيدها ومددها وأهدافها من بيانات النظام.' },
  { id: 'nutrition', name: 'إرشادات التغذية', tagline: 'إرشادات عامة وآمنة للناشئين', icon: Apple, color: 'rose',
    welcome: 'مرحبًا! أقدم إرشادات غذائية عامة وآمنة للناشئين حول الوجبات المتوازنة والترطيب والاستشفاء، ولا أقدم جرعات مكملات أو حميات تقييدية أو خطط زيادة/خفض وزن.' },
  { id: 'scout', name: 'محلل التطور', tagline: 'قراءة التقييمات وخطط التطوير', icon: Search, color: 'cyan',
    welcome: 'مرحبًا! أنا محلل التطور. أعتمد على التقييمات المنشورة وخطط التطوير لمتابعة التقدم، ولا أرتب اللاعبين أو أصف لاعبًا بأنه الأفضل.' },
  { id: 'operations', name: 'مدير العمليات', tagline: 'إدارة الجداول والموارد', icon: ClipboardList, color: 'orange',
    welcome: 'مرحبًا! أنا مدير العمليات. أستطيع تحليل استخدام الملاعب، توزيع الجداول التدريبية، وتحديد التعارضات في المواعيد.' },
  { id: 'communication', name: 'مسؤول التواصل', tagline: 'قوالب رسائل لأولياء الأمور', icon: MessageSquare, color: 'blue',
    welcome: 'مرحبًا! أنا مسؤول التواصل. أستطيع صياغة رسائل احترافية لأولياء الأمور: تذكيرات الاشتراكات، دعوات للمباريات، تقارير الحضور.' },
];

const PERSONA_COLORS: Record<Persona['color'], {
  ring: string; bg: string; text: string; iconBg: string;
  border: string; activeBorder: string; activeShadow: string;
}> = {
  emerald: { ring: 'ring-brand-500/30', bg: 'bg-brand-50 dark:bg-brand-900/20', text: 'text-brand-600 dark:text-brand-400', iconBg: 'from-brand-500 to-brand-600', border: 'border-slate-200 dark:border-slate-800', activeBorder: 'border-brand-500', activeShadow: 'shadow-brand-200/50' },
  blue: { ring: 'ring-blue-500/30', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', iconBg: 'from-blue-500 to-blue-600', border: 'border-slate-200 dark:border-slate-800', activeBorder: 'border-blue-500', activeShadow: 'shadow-blue-200/50' },
  amber: { ring: 'ring-amber-500/30', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', iconBg: 'from-amber-500 to-amber-600', border: 'border-slate-200 dark:border-slate-800', activeBorder: 'border-amber-500', activeShadow: 'shadow-amber-200/50' },
  red: { ring: 'ring-red-500/30', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', iconBg: 'from-red-500 to-red-600', border: 'border-slate-200 dark:border-slate-800', activeBorder: 'border-red-500', activeShadow: 'shadow-red-200/50' },
  teal: { ring: 'ring-teal-500/30', bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', iconBg: 'from-teal-500 to-teal-600', border: 'border-slate-200 dark:border-slate-800', activeBorder: 'border-teal-500', activeShadow: 'shadow-teal-200/50' },
  cyan: { ring: 'ring-cyan-500/30', bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', iconBg: 'from-cyan-500 to-cyan-600', border: 'border-slate-200 dark:border-slate-800', activeBorder: 'border-cyan-500', activeShadow: 'shadow-cyan-200/50' },
  orange: { ring: 'ring-orange-500/30', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', iconBg: 'from-orange-500 to-orange-600', border: 'border-slate-200 dark:border-slate-800', activeBorder: 'border-orange-500', activeShadow: 'shadow-orange-200/50' },
  rose: { ring: 'ring-rose-500/30', bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', iconBg: 'from-rose-500 to-rose-600', border: 'border-slate-200 dark:border-slate-800', activeBorder: 'border-rose-500', activeShadow: 'shadow-rose-200/50' },
};

const LIVE_AI_PERSONAS = new Set<PersonaId>(['financial', 'operations', 'documents', 'communication', 'players', 'training', 'matches', 'scout']);

const PERSONA_ROLES: Record<PersonaId, Role[]> = {
  technical: ['manager', 'coach'],
  financial: ['manager', 'accountant'],
  players: ['manager', 'coach'],
  matches: ['manager', 'coach'],
  documents: ['manager', 'receptionist'],
  training: ['manager', 'coach'],
  nutrition: ['manager', 'coach'],
  scout: ['manager', 'coach'],
  operations: ['manager', 'receptionist'],
  communication: ['manager', 'receptionist'],
};

const SUGGESTIONS: Record<PersonaId, string[]> = {
  technical: ['حلل أداء الفرق', 'توصيات لتحسين الحضور', 'تقرير شامل'],
  financial: ['تقرير مالي سريع', 'تحليل الاشتراكات المتأخرة', 'توقعات مالية'],
  players: ['تحليل تطور التقييمات', 'إعادة التقييم المستحقة', 'توزيع المراكز'],
  matches: ['معدل الفوز', 'المباريات القادمة', 'خطة استعداد للمباراة'],
  documents: ['تحليل المستندات', 'اللاعبون الناقصون', 'تقرير المستندات'],
  training: ['الجلسات التدريبية المسجلة', 'مواعيد التدريبات', 'أهداف الجلسات'],
  nutrition: ['إرشادات قبل النشاط', 'إرشادات بعد النشاط', 'نصائح الترطيب العامة'],
  scout: ['ملخص التقييمات المنشورة', 'متابعة التطور الفردي', 'تقييم تغطية المراكز'],
  operations: ['تحليل الجدول', 'استخدام الملاعب', 'التعارضات'],
  communication: ['رسالة تذكير اشتراك', 'دعوة مباراة', 'تقرير حضور لولي الأمر'],
};

function uid(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function buildContext(
  players: Player[], subscriptions: Subscription[], transactions: Transaction[],
  staff: Staff[], teams: Team[], matches: Match[], trainings: Training[],
  tournaments: Tournament[], parents: Parent[], attendance: Attendance[],
  documents: UploadedFile[], currency: string,
): AIContext {
  const revenue = transactions.filter((tx) => tx.type === 'revenue').reduce((s, tx) => s + tx.amount, 0);
  const expenses = transactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
  const paidSubs = subscriptions.filter((s) => s.status === 'paid');
  const unpaidSubs = subscriptions.filter((s) => s.status === 'unpaid');
  const completedMatches = matches.filter((m) => m.result !== 'scheduled');
  const wins = matches.filter((m) => m.result === 'win').length;
  const positionCounts: Record<string, number> = {};
  players.forEach((p) => { positionCounts[p.position] = (positionCounts[p.position] || 0) + 1; });

  return {
    revenue, expenses, net: revenue - expenses, currency,
    activePlayers: players.filter((p) => p.status === 'active').length,
    inactivePlayers: players.filter((p) => p.status === 'inactive').length,
    paidSubs, unpaidSubs,
    paidAmount: paidSubs.reduce((s, sub) => s + sub.amount, 0),
    unpaidAmount: unpaidSubs.reduce((s, sub) => s + sub.amount, 0),
    completedMatches, wins,
    draws: matches.filter((m) => m.result === 'draw').length,
    losses: matches.filter((m) => m.result === 'loss').length,
    scheduled: matches.filter((m) => m.result === 'scheduled'),
    winRate: completedMatches.length > 0 ? Math.round((wins / completedMatches.length) * 100) : 0,
    goalsScored: matches.reduce((s, m) => s + m.academyScore, 0),
    goalsConceded: matches.reduce((s, m) => s + m.opponentScore, 0),
    positionCounts, totalSessions: trainings.length,
    staffCount: staff.length, teamsCount: teams.length,
    players, teams, staff, matches, trainings, subscriptions, transactions,
    tournaments, parents, attendance, documents,
  };
}

function generateResponse(personaId: PersonaId, q: string, c: AIContext, teams: Team[], players: Player[], evaluations: PlayerEvaluation[]): string {
  if (/(تقرير شامل|تقرير عام|تقرير الأكاديمية|full report|comprehensive)/.test(q)) return generateFullReport(c);
  const currency = c.currency;

  switch (personaId) {
    case 'financial': {
      if (/(مال|مالي|ربح|إيراد|مصروف|دخل|ميزانية|تقرير مالي|أرباح|خسارة مالية|توقعات)/.test(q)) {
        const lines = [
          `📊 تقرير مالي سريع:`, `• إجمالي الإيرادات: ${fmt(c.revenue)} ${currency}`,
          `• إجمالي المصروفات: ${fmt(c.expenses)} ${currency}`,
          `• صافي الربح: ${fmt(c.net)} ${currency} ${c.net >= 0 ? '✅' : '⚠️'}`,
          `• اشتراكات مدفوعة: ${c.paidSubs.length} بقيمة ${fmt(c.paidAmount)} ${currency}`,
          `• اشتراكات متأخرة: ${c.unpaidSubs.length} بقيمة ${fmt(c.unpaidAmount)} ${currency}`,
        ];
        if (/(توقع|projection|forecast)/.test(q)) {
          const monthlyAvg = c.revenue / Math.max(new Date().getMonth() + 1, 1);
          lines.push('', '📈 توقعات مالية:', `• متوسط الإيراد الشهري: ${fmt(Math.round(monthlyAvg))} ${currency}`,
            `• إيراد متوقع بنهاية العام: ${fmt(Math.round(monthlyAvg * 12))} ${currency}`);
          const collectionRate = c.paidSubs.length + c.unpaidSubs.length > 0 ? c.paidSubs.length / (c.paidSubs.length + c.unpaidSubs.length) : 0;
          lines.push(`• نسبة التحصيل الحالية: ${Math.round(collectionRate * 100)}%`);
          if (collectionRate < 0.7) lines.push('⚠️ تحذير: نسبة التحصيل منخفضة. يُنصح بتفعيل نظام تذكيرات آلي.');
        }
        if (c.unpaidAmount > 0) lines.push(`💡 توصية: متابعة تحصيل ${c.unpaidSubs.length} اشتراك متأخر (${fmt(c.unpaidAmount)} ${currency}).`);
        if (c.expenses > c.revenue) lines.push(`⚠️ تنبيه: المصروفات تتجاوز الإيرادات بـ ${fmt(c.expenses - c.revenue)} ${currency}.`);
        else lines.push(`✅ الوضع المالي مستقر بفائض ${fmt(c.net)} ${currency}.`);
        return lines.join('\n');
      }
      if (/(اشتراك|مدفوع|متأخر|تحصيل|رسوم)/.test(q)) {
        return [`💳 تحليل الاشتراكات:`, `• المدفوعة: ${c.paidSubs.length} (${fmt(c.paidAmount)} ${currency})`,
          `• المتأخرة: ${c.unpaidSubs.length} (${fmt(c.unpaidAmount)} ${currency})`,
          `• نسبة التحصيل: ${c.paidSubs.length + c.unpaidSubs.length > 0 ? Math.round((c.paidSubs.length / (c.paidSubs.length + c.unpaidSubs.length)) * 100) : 0}%`,
          c.unpaidSubs.length > 0 ? `🔔 ${c.unpaidSubs.length} لاعب بانتظام غير مدفوع. يُنصح بإرسال تذكير لأولياء الأمور.` : `✅ جميع الاشتراكات مدفوعة. ممتاز!`,
        ].join('\n');
      }
      return [`أنا المستشار المالي. نظرة عامة:`, `• صافي الربح: ${fmt(c.net)} ${currency}`,
        `• إيرادات: ${fmt(c.revenue)} · مصروفات: ${fmt(c.expenses)}`, `• متأخرات: ${c.unpaidSubs.length} لاعب`,
        `اسألني عن "تقرير مالي" أو "الاشتراكات المتأخرة" أو "توقعات مالية".`].join('\n');
    }

    case 'players': {
      if (/(تقييم|تقييمات|أداء|تطور|إعادة التقييم|أفضل|مميز|نجم|نجوم|top|ranking|rank)/.test(q)) {
        const published = evaluations.filter((ev) => ev.status === 'published').sort((a, b) => a.evaluationDate.localeCompare(b.evaluationDate));
        if (!published.length) return 'لا توجد تقييمات منشورة حاليًا، لذلك لا يمكن تحليل التطور أو المقارنة. لن يتم ترتيب اللاعبين أو وصف أي لاعب بأنه الأفضل.';
        const byPlayer = new Map<string, PlayerEvaluation[]>();
        published.forEach((ev) => byPlayer.set(ev.playerId, [...(byPlayer.get(ev.playerId) || []), ev]));
        const history = Array.from(byPlayer.values()).filter((items) => items.length >= 2);
        const latest = Array.from(byPlayer.values()).map((items) => items[items.length - 1]);
        const today = new Date().toISOString().slice(0, 10);
        const due = latest.filter((ev) => ev.reassessmentDate && ev.reassessmentDate <= today).length;
        const plans = latest.filter((ev) => ev.developmentPriorities?.length || ev.trainingAction || ev.reassessmentDate).length;
        return [
          '📈 ملخص تطور التقييمات:',
          `• تقييمات منشورة: ${published.length}`,
          `• لاعبون لديهم تقييم منشور: ${byPlayer.size}`,
          `• لاعبون لديهم تاريخ يمكن مقارنته ذاتيًا: ${history.length}`,
          `• إعادة تقييم مستحقة: ${due}`,
          `• أحدث تقييمات تحتوي خطة تطوير: ${plans} من ${latest.length}`,
          '',
          'يُستخدم هذا التحليل لمتابعة تطور اللاعب مقارنةً بسجله السابق، وليس لترتيب اللاعبين فيما بينهم.',
        ].join('\n');
      }
      if (/(مركز|مراكز|توزيع|position)/.test(q)) {
        const list = Object.entries(c.positionCounts).sort((a, b) => b[1] - a[1]).map(([pos, count]) => `• ${pos}: ${count} لاعب`).join('\n');
        return `🏟️ توزيع اللاعبين حسب المركز:\n${list || 'لا توجد بيانات.'}\n\nالإجمالي: ${players.length} (${c.activePlayers} نشط، ${c.inactivePlayers} موقوف).`;
      }
      if (/(اشتراك|غير مدفوع|متأخر|مدفوع)/.test(q)) {
        if (!c.unpaidSubs.length) return '✅ جميع اشتراكات اللاعبين مدفوعة.';
        const names = c.unpaidSubs.map((sub) => { const p = players.find((pl) => pl.id === sub.playerId); return p ? `• ${p.name} — ${fmt(sub.amount)} ${currency}` : null; }).filter(Boolean).slice(0, 10).join('\n');
        return `⚠️ اللاعبون بانتظام غير مدفوع (${c.unpaidSubs.length}):\n${names}\n\nإجمالي المتأخرات: ${fmt(c.unpaidAmount)} ${currency}.`;
      }
      return [`أنا خبير اللاعبين. ملخص:`, `• إجمالي: ${players.length} (${c.activePlayers} نشط · ${c.inactivePlayers} موقوف)`,
        `• اشتراكات متأخرة: ${c.unpaidSubs.length}`, `اسألني عن "توزيع المراكز" أو "أفضل اللاعبين" أو "الاشتراكات المتأخرة".`].join('\n');
    }

    case 'matches': {
      if (/(قادم|مجدول|upcoming|schedule)/.test(q)) {
        if (!c.scheduled.length) return 'لا توجد مباريات مجدولة حاليًا.';
        return `📅 المباريات المجدولة (${c.scheduled.length}):\n${[...c.scheduled].sort((a, b) => a.matchDate.localeCompare(b.matchDate)).slice(0, 5).map((m) => `• ${teams.find((tm) => tm.id === m.teamId)?.name ?? 'فريق'} ضد ${m.opponent} — ${m.matchDate}`).join('\n')}`;
      }
      if (/(استعداد|خطة|تحضير|prepare|prep)/.test(q)) return generateMatchPrep(c, teams);
      if (/(فوز|خسارة|تعادل|نتيجة|معدل|win rate|أداء)/.test(q)) {
        const lines = [`🏆 تحليل النتائج:`, `• ملعوبة: ${c.completedMatches.length}`, `• فوز: ${c.wins} · تعادل: ${c.draws} · خسارة: ${c.losses}`,
          `• معدل الفوز: ${c.winRate}%`, `• أهداف لنا: ${c.goalsScored} · ضدنا: ${c.goalsConceded} (الفارق ${c.goalsScored - c.goalsConceded > 0 ? '+' : ''}${c.goalsScored - c.goalsConceded})`];
        if (c.winRate >= 60) lines.push('🟢 مستوى ممتاز!');
        else if (c.winRate >= 40) lines.push('🟡 مستوى متوسط. مجال للتحسين.');
        else if (c.completedMatches.length > 0) lines.push('🔴 يحتاج تحسينًا. ركز على التدريبات التكتيكية.');
        return lines.join('\n');
      }
      return [`أنا مخطط المباريات. ملخص:`, `• معدل الفوز: ${c.winRate}% (${c.wins} من ${c.completedMatches.length})`,
        `• مجدولة: ${c.scheduled.length}`, `اسألني عن "معدل الفوز" أو "المباريات القادمة" أو "خطة استعداد".`].join('\n');
    }

    case 'documents': {
      const docByPlayer: Record<string, UploadedFile[]> = {};
      c.documents.forEach((d) => { (docByPlayer[d.playerId] ??= []).push(d); });
      const withDocs = Object.keys(docByPlayer).length;
      const without = players.length - withDocs;
      const photos = c.documents.filter((d) => d.fileCategory === 'photo').length;
      const pdfs = c.documents.filter((d) => d.fileType === 'application/pdf').length;
      if (/(ناقص|نقص|مفقود|missing|incomplete)/.test(q)) {
        const missing = players.filter((p) => !docByPlayer[p.id]);
        if (!missing.length) return '✅ جميع اللاعبين لديهم مستندات مرفوعة.';
        return `📋 اللاعبون بدون مستندات (${missing.length}):\n${missing.slice(0, 12).map((p) => `• ${p.name} — ${p.position}`).join('\n')}\n\n💡 تواصل مع أولياء الأمور لإرفاق المستندات الناقصة.`;
      }
      if (/(إحصاء|تقرير|حالة|stats|report|مستند|وثيقة|ملف|document)/.test(q)) {
        return [`📊 تقرير المستندات:`, `• إجمالي الملفات: ${c.documents.length} (صور: ${photos} · PDF: ${pdfs})`,
          `• لاعبون بمستندات: ${withDocs} من ${players.length}`, `• لاعبون بدون: ${without}`,
          without > 0 ? `⚠️ ${without} لاعب يفتقرون للمستندات.` : `✅ جميع الملفات مكتملة.`].join('\n');
      }
      return [`أنا مدير مستندات اللاعبين. ملخص:`, `• إجمالي الملفات: ${c.documents.length} (صور: ${photos} · PDF: ${pdfs})`,
        `• بمستندات: ${withDocs} · بدون: ${without}`, `اسألني عن "تقرير المستندات" أو "اللاعبون الناقصون".`].join('\n');
    }

    case 'training': {
      if (/(مسجل|مسجلة|حالي|حاليًا|موجود|موجودة|جلسات|مواعيد|أهداف|stored|recorded|current|sessions|schedule)/.test(q)) {
        if (!c.trainings.length) return 'لا توجد جلسات تدريبية مسجلة حاليًا في النظام. لذلك لا توجد مواعيد أو أهداف تدريب لعرضها.';
        const sessions = [...c.trainings]
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
          .map((session, i) => {
            const team = teams.find((t) => t.id === session.teamId);
            const objectives = session.objectives?.trim() ? ` · الأهداف: ${session.objectives}` : ' · بدون أهداف مسجلة';
            return `${i + 1}. ${session.title || 'جلسة تدريب'} — ${session.sessionDate} · ${session.durationMinutes} دقيقة${team ? ` · ${team.name}` : ''}${objectives}`;
          });
        return [`الجلسات التدريبية المسجلة: ${c.trainings.length}`, ...sessions].join('\n');
      }
      return 'هذا المساعد مخصص لعرض بيانات الجلسات التدريبية المسجلة. اكتب مثلًا: "هل توجد جلسات تدريبية مسجلة حاليًا؟"';
    }
    case 'nutrition': return generateNutritionAdvice(q, teams);
    case 'communication': return generateCommunicationTemplate(q, c.unpaidSubs, players, c.scheduled, currency);
    case 'scout': {
      if (/(مركز|مراكز|position|positions|تغطية)/.test(q)) return generatePositionEvaluation(c, players);
      const published = evaluations
        .filter((ev) => ev.status === 'published')
        .sort((a, b) => a.evaluationDate.localeCompare(b.evaluationDate));
      if (!published.length) {
        return 'لا توجد تقييمات منشورة حاليًا. لا يمكن استنتاج تطور أو موهبة من العمر أو رقم القميص أو المركز وحدها.';
      }
      const byPlayer = new Map<string, PlayerEvaluation[]>();
      published.forEach((ev) => byPlayer.set(ev.playerId, [...(byPlayer.get(ev.playerId) || []), ev]));
      const histories = Array.from(byPlayer.values()).filter((items) => items.length >= 2);
      const latest = Array.from(byPlayer.values()).map((items) => items[items.length - 1]);
      const today = new Date().toISOString().slice(0, 10);
      const due = latest.filter((ev) => ev.reassessmentDate && ev.reassessmentDate <= today).length;
      const plans = latest.filter((ev) => ev.developmentPriorities?.length || ev.trainingAction || ev.reassessmentDate).length;
      const comparisonRequested = /(قارن|مقارنة|compare|أفضل|best|موهبة|talent)/.test(q);
      return [
        '📈 تحليل التطور من التقييمات المنشورة:',
        `• التقييمات المنشورة: ${published.length}`,
        `• لاعبون لديهم تقييم منشور: ${byPlayer.size}`,
        `• لاعبون لديهم تقييمان أو أكثر لمتابعة التطور: ${histories.length}`,
        `• أحدث التقييمات التي تحتوي خطة تطوير: ${plans} من ${latest.length}`,
        `• إعادة تقييم مستحقة: ${due}`,
        '',
        comparisonRequested
          ? 'لا يتم ترتيب اللاعبين أو وصف أحد بأنه الأفضل أو كموهبة مؤكدة. المقارنة المعتمدة هي تطور كل لاعب مع سجله السابق فقط.'
          : 'التحليل يركز على التطور الفردي وخطط المتابعة، وليس على ترتيب اللاعبين.',
      ].join('\n');
    }
    case 'operations': {
      if (/(ملعب|pitch|استخدام)/.test(q)) {
        const usage: Record<string, { teams: string[]; sessions: number }> = {};
        teams.forEach((tm) => { const p = tm.pitchNumber || 'غير محدد'; (usage[p] ??= { teams: [], sessions: 0 }); usage[p].teams.push(tm.name); usage[p].sessions += c.trainings.filter((tr) => tr.teamId === tm.id).length; });
        return [`🏟️ تحليل استخدام الملاعب:`, ...Object.entries(usage).map(([p, i]) => `• ملعب ${p}: ${i.teams.length} فريق · ${i.sessions} جلسة — ${i.teams.join('، ')}`), '', `الملاعب المستخدمة: ${Object.keys(usage).length}`].join('\n');
      }
      if (/(تعارض|تضارب|conflict)/.test(q)) return generateScheduleConflicts(c, teams);
      if (/(جدول|تحليل الجدول|schedule)/.test(q)) {
        return [`📅 تحليل الجدول التدريبي:`, ...teams.map((tm) => `• ${tm.name}: ${c.trainings.filter((tr) => tr.teamId === tm.id).length} تدريب · ${c.matches.filter((m) => m.teamId === tm.id).length} مباراة · ${tm.trainingDays.length} أيام/أسبوع`), '', `إجمالي: ${c.totalSessions} جلسة على ${c.teamsCount} فرق`].join('\n');
      }
      return [`أنا مدير العمليات. أستطيع:`, `• تحليل استخدام الملاعب`, `• كشف التعارضات في الجداول`, `• تحليل الحمل التدريبي`, `اسألني عن "استخدام الملاعب" أو "التعارضات" أو "تحليل الجدول".`].join('\n');
    }

    default: { // technical
      if (/(حضور|غياب|attendance)/.test(q)) {
        if (!c.totalSessions) return `📊 لا توجد جلسات تدريب مسجلة حاليًا.`;
        return [`📊 تحليل الحضور:`, `• جلسات التدريب: ${c.totalSessions}`, `• لاعبون نشطون: ${c.activePlayers} على ${c.teamsCount} فرق`,
          `💡 توصيات:`, `  ١. تذكير قبل الجلسة بـ ٢٤ ساعة`, `  ٢. متابعة المتغيبين`, `  ٣. ربط الحضور بمكافآت شهرية`].join('\n');
      }
      if (/(أداء|فرق|فريق|performance|technical)/.test(q)) {
        return [`⚽ تحليل أداء الفرق:`, ...teams.map((tm) => {
          const pl = players.filter((p) => p.teamId === tm.id).length;
          const mw = c.matches.filter((m) => m.teamId === tm.id && m.result === 'win').length;
          const mp = c.matches.filter((m) => m.teamId === tm.id && m.result !== 'scheduled').length;
          return `• ${tm.name} (${tm.ageGroup}): ${pl} لاعب · ${mp} مباراة · فوز ${mp > 0 ? Math.round((mw / mp) * 100) : 0}%`;
        }), '', `إجمالي: ${c.teamsCount} فرق · ${c.activePlayers} لاعب · ${c.totalSessions} جلسة.`].join('\n');
      }
      return [`أنا المحلل الفني. نظرة عامة:`, `• الفرق: ${c.teamsCount} · لاعبون: ${c.activePlayers}`, `• جلسات: ${c.totalSessions} · كادر: ${c.staffCount}`,
        `اسألني عن "أداء الفرق" أو "الحضور" أو "تقرير شامل".`].join('\n');
    }
  }
}

export function AICenter({ players, subscriptions, transactions, staff, teams, matches, trainings, tournaments, parents, attendance, evaluations, activeRole, lang, onRefresh }: AICenterProps) {
  const t = tr(lang);
  const allowedPersonas = useMemo(
    () => PERSONAS.filter((p) => PERSONA_ROLES[p.id].includes(activeRole)),
    [activeRole],
  );
  const [activePersona, setActivePersona] = useState<PersonaId>(() => {
    if (activeRole === 'accountant') return 'financial';
    if (activeRole === 'receptionist') return 'operations';
    return 'technical';
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [documents, setDocuments] = useState<UploadedFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!PERSONA_ROLES[activePersona].includes(activeRole)) {
      setActivePersona(allowedPersonas[0]?.id ?? 'technical');
    }
  }, [activeRole, activePersona, allowedPersonas]);

  const persona = useMemo(() => allowedPersonas.find((p) => p.id === activePersona) ?? allowedPersonas[0] ?? PERSONAS[0], [activePersona, allowedPersonas]);
  const personaStyle = PERSONA_COLORS[persona.color];
  const PersonaIcon = persona.icon;

  useEffect(() => { setMessages([{ id: uid(), role: 'ai', text: persona.welcome }]); }, [persona.welcome]);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [messages, isTyping]);
  useEffect(() => {
    let active = true;
    if (activeRole !== 'manager' && activeRole !== 'receptionist') {
      setDocuments([]);
      return () => { active = false; };
    }
    fetchAllPlayerFiles().then((files) => { if (active) setDocuments(files); });
    return () => { active = false; };
  }, [activeRole]);

  const ctx = useMemo(() => buildContext(players, subscriptions, transactions, staff, teams, matches, trainings, tournaments, parents, attendance, documents, t.currency),
    [players, subscriptions, transactions, staff, teams, matches, trainings, tournaments, parents, attendance, documents, t.currency]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;

    setMessages((prev) => [...prev, { id: uid(), role: 'user', text: content }]);
    setInput('');
    setIsTyping(true);

    try {
      if (LIVE_AI_PERSONAS.has(activePersona)) {
        const result = await askManagementAI(
          activePersona as ManagementAIPersona,
          content,
          lang,
        );
        setMessages((prev) => [...prev, { id: uid(), role: 'ai', text: result.reply }]);
        return;
      }

      const reply = generateResponse(activePersona, content, ctx, teams, players, evaluations);
      setMessages((prev) => [...prev, { id: uid(), role: 'ai', text: reply }]);
    } catch (error) {
      console.error('AI assistant request failed', error);
      const fallback = generateResponse(activePersona, content, ctx, teams, players, evaluations);
      const notice = lang === 'ar'
        ? 'تعذر الاتصال بخدمة الذكاء الاصطناعي الآن. هذه إجابة محلية من بيانات النظام:\n\n'
        : 'The AI service is unavailable right now. Here is a local response from system data:\n\n';
      setMessages((prev) => [...prev, { id: uid(), role: 'ai', text: notice + fallback }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClear = () => { setMessages([{ id: uid(), role: 'ai', text: persona.welcome }]); setInput(''); };

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <PageHeader title={t.aiCenter} subtitle="مساعد ذكي لتحليل بيانات الأكاديمية واتخاذ القرارات">
        <button onClick={handleClear} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-sm">
          <RefreshCw className="h-3.5 w-3.5" /> محادثة جديدة
        </button>
      </PageHeader>

      <AIInsights players={players} subscriptions={subscriptions} transactions={transactions} matches={matches} trainings={trainings} documents={documents} evaluations={evaluations} currency={t.currency} />

      <ChatGPTIntegrationStatus lang={lang} />

      <AIOperationsPanel activeRole={activeRole} lang={lang} subscriptions={subscriptions} players={players} evaluations={evaluations} trainings={trainings} onCompleted={onRefresh} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <aside className="lg:col-span-1 space-y-3">
          <div className="flex items-center gap-2 px-1 mb-1">
            <Brain className="h-4 w-4 text-slate-400" />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">المساعدون</span>
          </div>
          <div className="space-y-2 max-h-[60vh] lg:max-h-none overflow-y-auto lg:overflow-visible pr-1 -mr-1">
            {allowedPersonas.map((p) => {
              const styles = PERSONA_COLORS[p.color];
              const Icon = p.icon;
              const isActive = p.id === activePersona;
              return (
                <button key={p.id} onClick={() => { if (!isActive) setActivePersona(p.id); }}
                  className={`w-full text-right p-3.5 rounded-2xl border bg-white dark:bg-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md ${isActive ? `${styles.activeBorder} shadow-md ${styles.activeShadow} ring-2 ${styles.ring}` : styles.border}`}>
                  <div className="flex items-center gap-3">
                    <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${styles.iconBg} flex items-center justify-center text-white shadow`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{p.tagline}</p>
                    </div>
                    {isActive && <span className={`shrink-0 w-2 h-2 rounded-full ${styles.text.replace('text-', 'bg-')}`} />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className={`mt-2 p-4 rounded-2xl ${personaStyle.bg} border ${personaStyle.activeBorder} border-opacity-30`}>
            <div className="flex items-center gap-2 mb-2"><Sparkles className={`h-4 w-4 ${personaStyle.text}`} /><span className="text-xs font-black text-slate-900 dark:text-white">المساعد النشط</span></div>
            <p className={`text-sm font-black ${personaStyle.text}`}>{persona.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{persona.tagline}</p>
          </div>
          <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-400"><Target className="h-3.5 w-3.5" /><span className="text-[11px] font-bold">جلسة بصلاحية: {t[activeRole]}</span></div>
          </div>
        </aside>

        <section className="lg:col-span-3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden h-[70vh] min-h-[520px]">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`relative shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${personaStyle.iconBg} flex items-center justify-center text-white shadow`}>
                <PersonaIcon className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand-400 border-2 border-white dark:border-slate-900" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white truncate">{persona.name}</p>
                <p className="text-[11px] text-brand-500 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />متصل الآن</p>
              </div>
            </div>
            <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${personaStyle.bg} ${personaStyle.text}`}><Zap className="h-3 w-3" />Shooter AI</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-slate-50/40 dark:bg-slate-950/20">
            {messages.map((m) => <MessageBubble key={m.id} message={m} personaColor={persona.color} />)}
            {isTyping && <TypingIndicator personaColor={persona.color} personaIcon={PersonaIcon} />}
          </div>

          <div className="px-4 pt-3 pb-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[activePersona].map((s) => (
                <button key={s} onClick={() => handleSend(s)} disabled={isTyping}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 hover:text-brand-700 dark:hover:text-brand-400 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{s}</button>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }} disabled={isTyping}
                  placeholder="اكتب رسالتك إلى المساعد الذكي..."
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition disabled:opacity-60" />
                <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 dark:text-slate-600" />
              </div>
              <button onClick={() => handleSend()} disabled={!input.trim() || isTyping}
                className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg hover:shadow-brand-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100" aria-label="إرسال">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MessageBubble({ message, personaColor }: { message: ChatMessage; personaColor: Persona['color'] }) {
  const isAI = message.role === 'ai';
  const styles = PERSONA_COLORS[personaColor];
  return (
    <div className={`flex items-end gap-2.5 animate-fadeIn ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white shadow ${isAI ? `bg-gradient-to-br ${styles.iconBg}` : 'bg-slate-400 dark:bg-slate-600'}`}>
        {isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={`max-w-[80%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm ${isAI ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-md border border-slate-100 dark:border-slate-700' : 'bg-brand-500 text-white rounded-br-md'}`}>
        {message.text}
      </div>
    </div>
  );
}

function TypingIndicator({ personaColor, personaIcon: Icon }: { personaColor: Persona['color']; personaIcon: typeof Activity }) {
  const styles = PERSONA_COLORS[personaColor];
  return (
    <div className="flex items-end gap-2.5 animate-fadeIn">
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white shadow bg-gradient-to-br ${styles.iconBg}`}><Icon className="h-4 w-4" /></div>
      <div className="px-4 py-3.5 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function AIInsights({ players, subscriptions, transactions, matches, trainings, documents, evaluations, currency }: {
  players: Player[]; subscriptions: Subscription[]; transactions: Transaction[]; matches: Match[]; trainings: Training[]; documents: UploadedFile[]; evaluations: PlayerEvaluation[]; currency: string;
}) {
  const insights = useMemo(() => {
    const net = transactions.filter((tx) => tx.type === 'revenue').reduce((s, tx) => s + tx.amount, 0) - transactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const totalSubs = subscriptions.length;
    const collectionRate = totalSubs > 0 ? Math.round((subscriptions.filter((s) => s.status === 'paid').length / totalSubs) * 100) : 0;
    const completed = matches.filter((m) => m.result !== 'scheduled');
    const winRate = completed.length > 0 ? Math.round((matches.filter((m) => m.result === 'win').length / completed.length) * 100) : 0;
    const withDocs = new Set(documents.map((d) => d.playerId)).size;
    const docCoverage = players.length > 0 ? Math.round((withDocs / players.length) * 100) : 0;
    const published = evaluations.filter((ev) => ev.status === 'published');
    const byPlayer = new Map<string, PlayerEvaluation[]>();
    published.forEach((ev) => byPlayer.set(ev.playerId, [...(byPlayer.get(ev.playerId) || []), ev]));
    const latest = Array.from(byPlayer.values()).map((items) => {
      const sorted = [...items].sort((a, b) => a.evaluationDate.localeCompare(b.evaluationDate));
      return sorted[sorted.length - 1];
    });
    const progressHistory = Array.from(byPlayer.values()).filter((items) => items.length >= 2).length;
    const today = new Date().toISOString().slice(0, 10);
    const reassessmentDue = latest.filter((ev) => ev.reassessmentDate && ev.reassessmentDate <= today).length;
    const alerts: { icon: typeof AlertTriangle; text: string; level: 'warning' | 'success' | 'info' }[] = [];
    const unpaidAmount = subscriptions.filter((s) => s.status === 'unpaid').reduce((s, sub) => s + sub.amount, 0);
    if (unpaidAmount > 0) alerts.push({ icon: AlertTriangle, text: `${subscriptions.filter((s) => s.status === 'unpaid').length} اشتراك متأخر بقيمة ${unpaidAmount.toLocaleString()} ${currency}`, level: 'warning' });
    if (net < 0) alerts.push({ icon: AlertTriangle, text: `الوضع المالي سلبي بـ ${Math.abs(net).toLocaleString()} ${currency}`, level: 'warning' });
    else if (net > 0) alerts.push({ icon: CheckCircle2, text: `فائض مالي ${net.toLocaleString()} ${currency}`, level: 'success' });
    if (winRate >= 60 && completed.length > 0) alerts.push({ icon: Trophy, text: `معدل فوز ممتاز ${winRate}%`, level: 'success' });
    else if (winRate < 40 && completed.length > 0) alerts.push({ icon: AlertTriangle, text: `معدل الفوز منخفض ${winRate}%`, level: 'warning' });
    if (players.length > 0 && docCoverage < 50) alerts.push({ icon: FileText, text: `${players.length - withDocs} لاعب بدون مستندات`, level: 'info' });
    if (reassessmentDue > 0) alerts.push({ icon: AlertTriangle, text: `${reassessmentDue} إعادة تقييم لاعب مستحقة`, level: 'warning' });
    if (trainings.length === 0) alerts.push({ icon: Lightbulb, text: 'لا توجد تدريبات مسجلة', level: 'info' });
    return { net, collectionRate, winRate, docCoverage, progressHistory, reassessmentDue, alerts };
  }, [players, subscriptions, transactions, matches, trainings, documents, evaluations, currency]);

  const alertStyles = {
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400',
    success: 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800/30 text-brand-700 dark:text-brand-400',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30 text-blue-700 dark:text-blue-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center"><Brain className="h-4 w-4" /></div>
        <div><h3 className="text-sm font-black text-slate-900 dark:text-white">رؤى ذكية فورية</h3><p className="text-[11px] text-slate-400">تحليل آلي لبيانات الأكاديمية</p></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <InsightCard icon={TrendingUp} label="صافي الحركة المالية" value={`${insights.net >= 0 ? '+' : ''}${insights.net.toLocaleString()}`} unit={currency} color={insights.net >= 0 ? 'emerald' : 'red'} />
        <InsightCard icon={Target} label="نسبة الاشتراكات المدفوعة" value={`${insights.collectionRate}%`} color={insights.collectionRate >= 70 ? 'emerald' : 'amber'} />
        <InsightCard icon={Trophy} label="معدل الفوز" value={`${insights.winRate}%`} color={insights.winRate >= 50 ? 'emerald' : 'amber'} />
        <InsightCard icon={FileText} label="تغطية المستندات" value={`${insights.docCoverage}%`} color={insights.docCoverage >= 70 ? 'emerald' : 'blue'} />
        <InsightCard icon={TrendingUp} label="سجلات التطور" value={insights.progressHistory.toString()} color="blue" />
        <InsightCard icon={AlertTriangle} label="إعادة تقييم مستحقة" value={insights.reassessmentDue.toString()} color={insights.reassessmentDue > 0 ? 'amber' : 'emerald'} />
      </div>
      {insights.alerts.length > 0 && (
        <div className="space-y-2">
          {insights.alerts.slice(0, 4).map((alert, i) => {
            const Icon = alert.icon;
            return <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold ${alertStyles[alert.level]}`}><Icon className="h-4 w-4 shrink-0" /><span>{alert.text}</span></div>;
          })}
        </div>
      )}
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, unit, color }: { icon: typeof Activity; label: string; value: string; unit?: string; color: 'emerald' | 'red' | 'amber' | 'blue' }) {
  const colors = { emerald: 'text-brand-600 dark:text-brand-400', red: 'text-red-600 dark:text-red-400', amber: 'text-amber-600 dark:text-amber-400', blue: 'text-blue-600 dark:text-blue-400' };
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-1.5 mb-1"><Icon className={`h-3.5 w-3.5 ${colors[color]}`} /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span></div>
      <p className={`text-base sm:text-lg font-black ${colors[color]}`}>{value}{unit && <span className="text-[10px] font-bold text-slate-400 ms-1">{unit}</span>}</p>
    </div>
  );
}
