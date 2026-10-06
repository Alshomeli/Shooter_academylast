import { supabase } from '@/lib/supabase';

export interface ParentInvitePreview {
  parentId: string;
  maskedEmail: string;
  alreadyLinked: boolean;
  canInvite: boolean;
}

export interface ParentInviteResult {
  parentId: string;
  status: 'invited' | 'linked_existing';
  maskedEmail: string;
  auditLogged: boolean;
}

export async function prepareParentInvite(parentId: string): Promise<ParentInvitePreview> {
  const { data, error } = await supabase.functions.invoke<ParentInvitePreview>('parent-account-invite', {
    body: { mode: 'prepare', parentId },
  });
  if (error || !data) throw new Error(error?.message || 'Could not prepare parent invitation');
  return data;
}

export async function sendParentInvite(parentId: string): Promise<ParentInviteResult> {
  const { data, error } = await supabase.functions.invoke<ParentInviteResult>('parent-account-invite', {
    body: { mode: 'execute', parentId, confirm: true },
  });
  if (error || !data) throw new Error(error?.message || 'Could not send parent invitation');
  return data;
}
