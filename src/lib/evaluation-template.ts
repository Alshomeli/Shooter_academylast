import type { PlayerEvaluation } from '@/types';

export type EvaluationKind = 'outfield' | 'goalkeeper';
export type ScoreGroup = 'technical' | 'tactical' | 'physical' | 'mental' | 'discipline';
export const SCORE_GROUPS: { key: ScoreGroup; ar: string; en: string }[] = [
  { key: 'technical', ar: 'المهارات الفنية', en: 'Technical skills' },
  { key: 'tactical', ar: 'المهارات التكتيكية', en: 'Tactical skills' },
  { key: 'physical', ar: 'اللياقة البدنية', en: 'Physical fitness' },
  { key: 'mental', ar: 'القوة الذهنية', en: 'Mental strength' },
  { key: 'discipline', ar: 'الانضباط', en: 'Discipline' },
];
export interface Criterion { group: ScoreGroup; key: string; ar: string; en: string }
export const OUTFIELD_CRITERIA: Criterion[] = [
  { group: 'technical', key: 'ball_control', ar: 'التحكم بالكرة', en: 'Ball control' },
  { group: 'technical', key: 'passing', ar: 'التمرير', en: 'Passing' },
  { group: 'technical', key: 'dribbling', ar: 'المراوغة', en: 'Dribbling' },
  { group: 'technical', key: 'shooting', ar: 'التسديد', en: 'Shooting' },
  { group: 'tactical', key: 'decision_making', ar: 'اتخاذ القرار', en: 'Decision making' },
  { group: 'tactical', key: 'positioning', ar: 'التمركز', en: 'Positioning' },
  { group: 'tactical', key: 'teamwork', ar: 'العمل الجماعي', en: 'Teamwork' },
  { group: 'physical', key: 'fitness', ar: 'اللياقة العامة', en: 'General fitness' },
  { group: 'physical', key: 'speed_agility', ar: 'السرعة والرشاقة', en: 'Speed & agility' },
  { group: 'physical', key: 'endurance', ar: 'التحمل', en: 'Endurance' },
  { group: 'mental', key: 'focus', ar: 'التركيز', en: 'Focus' },
  { group: 'mental', key: 'coachability', ar: 'الاستجابة للتوجيه', en: 'Coachability' },
  { group: 'discipline', key: 'discipline', ar: 'الانضباط', en: 'Discipline' },
  { group: 'mental', key: 'sportsmanship', ar: 'الروح الرياضية', en: 'Sportsmanship' },
];
export const GOALKEEPER_CRITERIA: Criterion[] = [
  { group: 'technical', key: 'gk_reflexes', ar: 'سرعة رد الفعل والتصدي', en: 'Reflexes & saves' },
  { group: 'technical', key: 'gk_shot_handling', ar: 'التعامل مع التسديدات', en: 'Shot handling' },
  { group: 'technical', key: 'gk_high_balls', ar: 'العرضيات والكرات العالية', en: 'Crosses & high balls' },
  { group: 'technical', key: 'gk_distribution', ar: 'اللعب بالقدم والتمرير', en: 'Footwork & passing' },
  { group: 'tactical', key: 'gk_positioning', ar: 'التمركز والاستعداد', en: 'Positioning & readiness' },
  { group: 'tactical', key: 'gk_rushing_out', ar: 'الخروج من المرمى', en: 'Leaving the goal' },
  { group: 'tactical', key: 'gk_communication', ar: 'التواصل وقيادة خط الدفاع', en: 'Communication & defensive leadership' },
  { group: 'physical', key: 'gk_agility', ar: 'السرعة والرشاقة', en: 'Speed & agility' },
  { group: 'mental', key: 'gk_focus', ar: 'الثبات النفسي والتركيز', en: 'Composure & focus' },
  { group: 'discipline', key: 'gk_instructions', ar: 'الالتزام بالتعليمات', en: 'Following instructions' },
];
export function evaluationCriteria(kind: EvaluationKind): Criterion[] {
  return kind === 'goalkeeper' ? GOALKEEPER_CRITERIA : OUTFIELD_CRITERIA;
}
export function templateSummary(kind: EvaluationKind, scores: Record<string, number | null>) {
  return Object.fromEntries(SCORE_GROUPS.map(group => {
    const values = evaluationCriteria(kind).filter(c => c.group === group.key)
      .map(c => scores[c.key]).filter((v): v is number => Number.isInteger(v) && v! >= 1 && v! <= 5);
    return [group.key, values.length ? values.reduce((a, b) => a + b, 0) / values.length : null];
  })) as Record<ScoreGroup, number | null>;
}
export function goalkeeperTotal(scores: Record<string, number | null>): number | null {
  const values = GOALKEEPER_CRITERIA.map(c => scores[c.key]);
  return values.every(v => Number.isInteger(v) && v! >= 1 && v! <= 5) ? values.reduce<number>((sum, v) => sum + v!, 0) : null;
}
export interface EvaluationDraft {
  id?: string; playerId: string; evaluationDate: string; periodType: string;
  evaluationType?: EvaluationKind; teamName?: string;
  detailedScores: Record<string, number | null>; developmentPriorities: string[];
  strengths: string; developmentAreas: string; coachNotes: string; coachRecommendation: string;
  trainingAction: string; reassessmentDate: string | null; finalRecommendation: string;
  heightCm: number | null; weightKg: number | null; nutritionPlan: string;
  evaluatorName: string; generalRating: string; evaluatorSignature: string; coachSignature: string;
}
export function emptyEvaluation(date: string): EvaluationDraft {
  return { playerId: '', evaluationDate: date, periodType: 'monthly', detailedScores: {}, developmentPriorities: [],
    strengths: '', developmentAreas: '', coachNotes: '', coachRecommendation: '', trainingAction: '',
    reassessmentDate: null, finalRecommendation: '', heightCm: null, weightKg: null, nutritionPlan: '',
    evaluatorName: '', generalRating: '', evaluatorSignature: '', coachSignature: '' };
}
export function draftFromEvaluation(ev: PlayerEvaluation): EvaluationDraft {
  return { ...emptyEvaluation(ev.evaluationDate), ...ev, heightCm: ev.heightCm ?? null, weightKg: ev.weightKg ?? null,
    nutritionPlan: ev.nutritionPlan || '', evaluatorName: ev.evaluatorName || '', generalRating: ev.generalRating || '',
    evaluatorSignature: ev.evaluatorSignature || '', coachSignature: ev.coachSignature || '' };
}
