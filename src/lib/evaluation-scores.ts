import type { PlayerEvaluation } from '@/types';

const GROUP_KEYS = {
  technical: ['ball_control', 'passing', 'dribbling', 'shooting'],
  tactical: ['decision_making', 'positioning', 'teamwork'],
  physical: ['fitness', 'speed_agility', 'endurance'],
  psychosocial: ['focus', 'coachability', 'discipline', 'sportsmanship'],
} as const;

export function averageEvaluationScores(values: Array<number | null | undefined>) {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function detailedGroupScore(ev: PlayerEvaluation, group: keyof typeof GROUP_KEYS) {
  return averageEvaluationScores(GROUP_KEYS[group].map(key => ev.detailedScores?.[key]));
}

export function evaluationFrameworkScores(ev: PlayerEvaluation) {
  return {
    technical: detailedGroupScore(ev, 'technical') ?? ev.technicalScore,
    tactical: detailedGroupScore(ev, 'tactical') ?? ev.tacticalScore,
    physical: detailedGroupScore(ev, 'physical') ?? ev.physicalScore,
    psychosocial: detailedGroupScore(ev, 'psychosocial') ?? averageEvaluationScores([ev.mentalScore, ev.disciplineScore]),
  };
}
