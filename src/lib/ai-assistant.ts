import { supabase } from '@/lib/supabase';

export type ManagementAIPersona = 'financial' | 'operations' | 'documents' | 'communication' | 'players' | 'training' | 'matches' | 'scout';
export interface WebResearchSource { title: string; url: string; }
export interface ManagementAIResponse {
  reply: string;
  provider: string;
  model?: string;
  generatedAt: string;
  mode?: 'research';
  grounded?: boolean;
  sources?: WebResearchSource[];
  searchQueries?: string[];
  searchEntryPoint?: string | null;
}

const RESEARCH_PATTERNS=/(?:اقترح|ابتكر|صمم|جهز|حضّر|خط[ةط]|تمرين|تدريب هجوم|تدريب دفاع|تدريبات|توصيات حديثة|أحدث|ابحث|research|latest|new training|training plan|design a drill|football drill)/i;
const RECORD_PATTERNS=/(?:تدريباتنا|جلساتنا|التدريبات المسجلة|الحضور|الغياب|سجلات|تقرير النظام|الأسبوع الماضي|training history|recorded sessions|attendance)/i;

export function shouldUseWebResearch(persona: ManagementAIPersona, question: string): boolean {
  return persona==='training' && RESEARCH_PATTERNS.test(question) && !RECORD_PATTERNS.test(question);
}

export async function askManagementAI(
  persona: ManagementAIPersona,
  question: string,
  lang: 'ar' | 'en',
  options: { research?: boolean } = {},
): Promise<ManagementAIResponse> {
  const mode = options.research ?? shouldUseWebResearch(persona, question) ? 'research' : 'internal';
  const { data, error } = await supabase.functions.invoke<ManagementAIResponse>(
    'ai-management-assistant',
    { body: { persona, question, lang, mode } },
  );
  if (error) throw new Error(error.message || 'AI assistant request failed');
  if (!data?.reply) throw new Error('AI assistant returned an empty response');
  return data;
}
