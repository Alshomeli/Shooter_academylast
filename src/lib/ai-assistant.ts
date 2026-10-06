import { supabase } from '@/lib/supabase';

export type ManagementAIPersona = 'financial' | 'operations' | 'documents' | 'communication' | 'players' | 'training' | 'matches' | 'scout';

interface ManagementAIResponse {
  reply: string;
  provider: string;
  model: string;
  generatedAt: string;
}

export async function askManagementAI(
  persona: ManagementAIPersona,
  question: string,
  lang: 'ar' | 'en',
): Promise<ManagementAIResponse> {
  const { data, error } = await supabase.functions.invoke<ManagementAIResponse>(
    'ai-management-assistant',
    {
      body: { persona, question, lang },
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
