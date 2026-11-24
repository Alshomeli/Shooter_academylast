import type { RegistrationApplication, RegistrationStatus } from '@/types';

export function mapApplication(row: Record<string, unknown>): RegistrationApplication {
  const children = (row.registration_children as Record<string, unknown>[] || []).map((c) => ({
    id: String(c.id),
    clientKey: c.client_key ? String(c.client_key) : undefined,
    fullName: String(c.full_name || ''),
    nationalId: c.national_id ? String(c.national_id) : undefined,
    birthDate: String(c.birth_date || ''),
    bloodType: c.blood_type ? String(c.blood_type) : undefined,
    notes: c.parent_notes ? String(c.parent_notes) : undefined,
    playerId: c.approved_player_id ? String(c.approved_player_id) : undefined,
  }));

  const documents = (row.registration_documents as Record<string, unknown>[] || []).map((d) => ({
    id: String(d.id),
    childId: d.child_id ? String(d.child_id) : undefined,
    storagePath: String(d.storage_path || ''),
    fileName: String(d.file_name || ''),
    mimeType: String(d.mime_type || ''),
    fileSize: Number(d.file_size) || 0,
    fileCategory: String(d.file_category || 'document') as 'photo' | 'document',
    documentType: d.document_type ? String(d.document_type) : undefined,
  }));

  return {
    id: String(row.id),
    registrationType: String(row.registration_type) as RegistrationApplication['registrationType'],
    status: String(row.status) as RegistrationStatus,
    parentName: String(row.parent_full_name || ''),
    parentNationalId: row.parent_national_id ? String(row.parent_national_id) : undefined,
    parentPhone: String(row.parent_phone || ''),
    parentEmail: String(row.parent_email || ''),
    parentWhatsapp: row.parent_whatsapp ? String(row.parent_whatsapp) : undefined,
    parentNationality: row.parent_nationality ? String(row.parent_nationality) : undefined,
    parentOccupation: row.parent_occupation ? String(row.parent_occupation) : undefined,
    parentWorkplace: row.parent_workplace ? String(row.parent_workplace) : undefined,
    parentAddress: row.parent_address ? String(row.parent_address) : undefined,
    parentNotes: row.parent_notes ? String(row.parent_notes) : undefined,
    children,
    documents,
    reviewNotes: row.review_notes ? String(row.review_notes) : undefined,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}
