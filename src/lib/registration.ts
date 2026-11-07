import { mapApplication } from '@/lib/registration-mappers';
import { supabase } from '@/lib/supabase';
import type {
  RegistrationParentInput,
  RegistrationChildInput,
  RegistrationDraftResult,
  RegistrationApplication,
} from '@/types';

/* ------------------------------------------------------------------ */
/*  Draft creation                                                     */
/* ------------------------------------------------------------------ */

export async function createDraft(
  parent: RegistrationParentInput,
  children: RegistrationChildInput[],
): Promise<RegistrationDraftResult> {
  const { data, error } = await supabase.rpc('create_registration_draft', {
    p_parent: parent as unknown as Record<string, unknown>,
    p_children: children as unknown as Record<string, unknown>[],
  });
  if (error) throw error;
  return data as unknown as RegistrationDraftResult;
}

/* ------------------------------------------------------------------ */
/*  Photo / document upload                                            */
/* ------------------------------------------------------------------ */

export async function uploadRegistrationFile(path: string, blob: Blob): Promise<void> {
  const { error: uploadErr } = await supabase.storage
    .from('player-documents')
    .upload(path, blob, { contentType: blob.type, upsert: false });
  // A retry after an interrupted response may encounter its own immutable UUID path.
  if (uploadErr && !('statusCode' in uploadErr && String(uploadErr.statusCode) === '409') && !('error' in uploadErr && uploadErr.error === 'Duplicate')) throw uploadErr;
}

export async function updateDraft(applicationId: string, parent: RegistrationParentInput, children: RegistrationChildInput[]): Promise<void> {
  const { error } = await supabase.rpc('update_registration_draft', {
    p_application_id: applicationId, p_parent: parent, p_children: children,
  });
  if (error) throw error;
}

export async function registerDocument(
  applicationId: string,
  childId: string | null,
  storagePath: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
  fileCategory: 'photo' | 'document',
  documentType?: string,
): Promise<void> {
  const { error } = await supabase.rpc('add_registration_document', {
    p_application_id: applicationId,
    p_child_id: childId,
    p_storage_path: storagePath,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_file_category: fileCategory,
    p_document_type: documentType ?? null,
    p_file_size: fileSize,
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Submit                                                             */
/* ------------------------------------------------------------------ */

export async function submitApplication(applicationId: string): Promise<void> {
  const { error } = await supabase.rpc('submit_registration_application', {
    p_application_id: applicationId,
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Manager actions                                                    */
/* ------------------------------------------------------------------ */

export async function reviewApplication(
  applicationId: string,
  status: 'under_review' | 'needs_info' | 'rejected',
  notes: string,
): Promise<void> {
  const { error } = await supabase.rpc('review_registration_application', {
    p_application_id: applicationId,
    p_status: status,
    p_notes: notes,
  });
  if (error) throw error;
}

export async function approveApplication(applicationId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_registration_application', {
    p_application_id: applicationId,
  });
  if (error) throw error;
}

export async function finalizePlayer(
  playerId: string,
  teamId = '',
  position = '',
  jerseyNumber = 0,
): Promise<void> {
  const { error } = await supabase.rpc('finalize_registered_player', {
    p_player_id: playerId,
    p_team_id: teamId,
    p_position: position,
    p_jersey_number: jerseyNumber,
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Fetching applications                                              */
/* ------------------------------------------------------------------ */

export async function fetchMyApplications(): Promise<RegistrationApplication[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in to view registration applications.");

  const { data, error } = await supabase
    .from('registration_applications')
    .select('*, registration_children(*), registration_documents(*)')
    .eq('applicant_user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapApplication);
}

export async function fetchAllApplications(): Promise<RegistrationApplication[]> {
  const { data, error } = await supabase
    .from('registration_applications')
    .select('*, registration_children(*), registration_documents(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapApplication);
}

export async function fetchApplicationById(id: string): Promise<RegistrationApplication | null> {
  const { data, error } = await supabase
    .from('registration_applications')
    .select('*, registration_children(*), registration_documents(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapApplication(data) : null;
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('player-documents')
    .createSignedUrl(storagePath, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not open the private document.');
  return data.signedUrl;
}

async function removeApplicationFiles(appId: string, childId?: string): Promise<void> {
  let query = supabase
    .from('registration_documents')
    .select('storage_path')
    .eq('application_id', appId);
  if (childId) query = query.eq('child_id', childId);
  const { data, error } = await query;
  if (error) throw error;
  const paths = (data || []).map((d: { storage_path: string | null }) => d.storage_path).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  const { error: removeError } = await supabase.storage.from('player-documents').remove(paths);
  if (removeError) throw removeError;
}

export async function deleteRegistrationApplication(appId: string) {
  await removeApplicationFiles(appId);
  const { error } = await supabase.rpc('delete_registration_application', { p_application_id: appId });
  if (error) throw error;
}

export async function addRegistrationChild(appId: string, child: RegistrationChildInput): Promise<{ childId: string; clientKey: string | null; fullName: string }> {
  const { data, error } = await supabase.rpc('add_registration_child', {
    p_application_id: appId,
    p_child: {
      clientKey: child.clientKey,
      fullName: child.fullName,
      nationalId: child.nationalId,
      birthDate: child.birthDate,
      bloodType: child.bloodType ?? '',
      notes: child.notes ?? '',
    },
  });
  if (error) throw error;
  return data as { childId: string; clientKey: string | null; fullName: string };
}

export async function deleteRegistrationChild(appId: string, childId: string): Promise<void> {
  await removeApplicationFiles(appId, childId);
  const { error } = await supabase.rpc('delete_registration_child', { p_application_id: appId, p_child_id: childId });
  if (error) throw error;
}

export function errorMessage(error: unknown, ar: boolean) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return `${ar ? 'تعذر إتمام العملية.' : 'Unable to complete this action.'} ${message}`;
}
