import { supabase } from '@/lib/supabase';

export type ManagementAIPersona = 'financial' | 'operations' | 'documents' | 'communication' | 'players' | 'training' | 'matches' | 'scout';

export interface AISource { title: string; url: string }

export interface ManagementAIResponse {
  reply: string;
  provider: string;
  model: string;
  generatedAt: string;
  sources?: AISource[];
  searchWidgetHtml?: string;
  research?: { requested: boolean; enabled: boolean; grounded: boolean };
}

export async function askManagementAI(
  persona: ManagementAIPersona,
  question: string,
  lang: 'ar' | 'en',
  research = false,
): Promise<ManagementAIResponse> {
  const { data, error } = await supabase.functions.invoke<ManagementAIResponse>(
    'ai-management-assistant',
    {
      body: { persona, question, lang, research },
    },
  );

  if (error) {
    const message = error.message || 'AI assistant request failed';
    throw new Error(message);
  }

  if (!data?.reply) {
    throw new Error('AI assistant returned an empty response');
  }

  return data;
}
