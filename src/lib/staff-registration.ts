import { supabase } from '@/lib/supabase';
import type { StaffApplication } from '@/types';

const map = (r: Record<string, unknown>): StaffApplication => ({
  id: String(r.id),
  applicantUserId: String(r.applicant_user_id),
  requestedRole: String(r.requested_role) as StaffApplication['requestedRole'],
  fullName: String(r.full_name || ''),
  email: String(r.email || ''),
  phone: String(r.phone || ''),
  nationalId: String(r.national_id || ''),
  specialization: String(r.specialization || ''),
  experienceYears: r.experience_years == null ? null : Number(r.experience_years),
  licenses: Array.isArray(r.licenses) ? r.licenses.map(String) : [],
  applicantNotes: String(r.applicant_notes || ''),
  status: String(r.status) as StaffApplication['status'],
  reviewNotes: String(r.review_notes || ''),
  submittedAt: r.submitted_at ? String(r.submitted_at) : null,
  reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
  approvedStaffId: r.approved_staff_id ? String(r.approved_staff_id) : null,
  createdAt: String(r.created_at || ''),
  updatedAt: String(r.updated_at || ''),
});

export async function getMyStaffApplication(): Promise<StaffApplication | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;
  const { data, error } = await supabase.from('staff_applications')
    .select('*').eq('applicant_user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? map(data as Record<string, unknown>) : null;
}

export async function getStaffApplications(): Promise<StaffApplication[]> {
  const { data, error } = await supabase.from('staff_applications')
    .select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => map(r as Record<string, unknown>));
}

export async function saveStaffApplication(input: {
  requestedRole: StaffApplication['requestedRole'];
  fullName: string;
  phone: string;
  nationalId?: string;
  specialization?: string;
  experienceYears?: number | null;
  licenses?: string[];
  applicantNotes?: string;
}): Promise<StaffApplication> {
  const { data, error } = await supabase.rpc('create_or_update_staff_application', {
    p_requested_role: input.requestedRole,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_national_id: input.nationalId || null,
    p_specialization: input.specialization || null,
    p_experience_years: input.experienceYears ?? null,
    p_licenses: input.licenses || [],
    p_applicant_notes: input.applicantNotes || null,
  });
  if (error) throw error;
  return map(data as Record<string, unknown>);
}

export async function submitStaffApplication(id: string): Promise<StaffApplication> {
  const { data, error } = await supabase.rpc('submit_staff_application', { p_application_id: id });
  if (error) throw error;
  return map(data as Record<string, unknown>);
}

export async function reviewStaffApplication(id: string, status: 'needs_info' | 'rejected', notes: string): Promise<StaffApplication> {
  const { data, error } = await supabase.rpc('review_staff_application', {
    p_application_id: id,
    p_status: status,
    p_notes: notes || null,
  });
  if (error) throw error;
  return map(data as Record<string, unknown>);
}

export async function approveStaffApplication(id: string): Promise<StaffApplication> {
  const { data, error } = await supabase.rpc('approve_staff_application', { p_application_id: id });
  if (error) throw error;
  return map(data as Record<string, unknown>);
}
