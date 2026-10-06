export type Role = 'manager' | 'accountant' | 'coach' | 'receptionist' | 'parent';

export interface Staff {
  version?: number;
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  salary: number;
  specialization: string;
  status: 'active' | 'inactive' | 'pending';
  joinedDate: string;
  avatarUrl: string;
  privateFieldsLoaded?: boolean;
  nationalId?: string;
  licenses?: string[];
  experienceYears?: number;
  rating?: number;
  tacticalStyle?: string;
  notes?: string;
  userId?: string;
}

export interface Team {
  version?: number;
  id: string;
  name: string;
  ageGroup: string;
  coachId: string;
  trainingDays: string[];
  trainingTime: string;
  pitchNumber: string;
}

export interface Player {
  version?: number;
  privateFieldsLoaded?: boolean;
  id: string;
  name: string;
  birthDate: string;
  bloodType: string;
  jerseyNumber: number;
  position: string;
  teamId: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  parentId: string;
  status: 'active' | 'inactive';
  notes: string;
  joinedDate: string;
}

export interface Parent {
  version?: number;
  userId?: string;
  privateFieldsLoaded?: boolean;
  id: string;
  name: string;
  nationalId: string;
  nationality: string;
  phone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  occupation: string;
  workplace: string;
  avatarUrl: string;
  status: 'active' | 'inactive';
  notes: string;
  joinedDate: string;
}

export interface Subscription {
  version?: number;
  id: string;
  playerId: string;
  planType: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  amount: number;
  startDate: string;
  endDate: string;
  status: 'paid' | 'unpaid';
  paymentMethod?: string;
  paidAt?: string;
}

export interface Attendance {
  version?: number;
  id: string;
  playerId: string;
  sessionDate: string;
  sessionType: 'training' | 'match';
  trainingId?: string;
  matchId?: string;
  status: 'present' | 'absent' | 'excused';
  notes?: string;
}

export interface Match {
  version?: number;
  id: string;
  teamId: string;
  opponent: string;
  matchDate: string;
  location: string;
  result: 'win' | 'loss' | 'draw' | 'scheduled';
  academyScore: number;
  opponentScore: number;
  scorers?: string;
  notes?: string;
}

export interface Training {
  version?: number;
  id: string;
  teamId: string;
  title: string;
  sessionDate: string;
  durationMinutes: number;
  objectives: string;
}

export interface Transaction {
  version?: number;
  subscriptionId?: string;
  playerId?: string;
  id: string;
  type: 'revenue' | 'expense';
  category: string;
  amount: number;
  transactionDate: string;
  description: string;
  recordedBy: string;
}

export interface Tournament {
  version?: number;
  id: string;
  name: string;
  organizer: string;
  season: string;
  startDate: string;
  endDate: string;
  teamsCount: number;
  logoEmoji: string;
}

export interface PlayerEvaluation {
  id: string;
  playerId: string;
  teamId: string;
  coachId: string;
  evaluationDate: string;
  periodType: 'monthly' | 'quarterly' | 'custom';
  technicalScore: number | null;
  tacticalScore: number | null;
  physicalScore: number | null;
  mentalScore: number | null;
  disciplineScore: number | null;
  overallScore: number | null;
  strengths: string;
  developmentAreas: string;
  coachNotes: string;
  coachRecommendation: string;
  detailedScores: Record<string, number | null>;
  developmentPriorities: string[];
  trainingAction: string;
  reassessmentDate: string | null;
  finalRecommendation: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  timestamp: string;
  userRole: string;
  userName: string;
  details: string;
}

export interface Notification {
  version?: number;
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
}

export interface Settings {
  version?: number;
  id: string;
  name: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  subscriptionFeeMonthly: number;
  subscriptionFeeQuarterly: number;
  subscriptionFeeSemiAnnual: number;
  subscriptionFeeYearly: number;
  benefitIban?: string;
  benefitAccountName?: string;
  paymentInstructionsAr?: string;
  paymentInstructionsEn?: string;
}

export interface PaymentProof {
  id: string;
  subscriptionId: string;
  playerId: string;
  parentUserId: string;
  amount: number;
  transferDate: string;
  proofPath: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_info';
  parentNote: string;
  reviewNote: string;
  reviewedBy?: string;
  reviewedAt?: string;
  receiptNumber?: number;
  createdAt: string;
}

export interface PlayerDocument {
  id: string;
  playerId?: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileCategory: 'photo' | 'document';
  fileSize: number;
  uploadedAt: string;
}

export interface StaffDocument {
  id: string;
  staffId: string;
  documentType: string;
  title: string;
  filePath: string;
  expiryDate?: string;
  notes: string;
  createdAt: string;
}

export interface CurrentUser {
  authUserId?: string;
  registrationOnly?: boolean;
  registrationMode?: 'parent' | 'staff';
  accountDisabled?: boolean;
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface StaffApplication {
  id: string;
  applicantUserId: string;
  requestedRole: 'manager' | 'coach' | 'accountant' | 'receptionist';
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  specialization: string;
  experienceYears: number | null;
  licenses: string[];
  applicantNotes: string;
  status: 'draft' | 'pending' | 'needs_info' | 'approved' | 'rejected';
  reviewNotes: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedStaffId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Lang = 'ar' | 'en';
export type ViewId =
  | 'dashboard'
  | 'approvals'
  | 'players'
  | 'parents'
  | 'teams'
  | 'staff'
  | 'subscriptions'
  | 'attendance'
  | 'schedules'
  | 'tournaments'
  | 'evaluations'
  | 'reports'
  | 'audit-logs'
  | 'mobile'
  | 'ai-center'
  | 'messages'
  | 'settings'
  | 'registration'
  | 'staff-registration'
  | 'registration-admin';

/* ---- Registration module ---- */

export type RegistrationType = 'initial_onboarding' | 'new_application';
export type RegistrationStatus = 'draft' | 'pending' | 'under_review' | 'needs_info' | 'approved' | 'rejected';

export interface RegistrationParentInput {
  requestId?: string;
  registrationType: RegistrationType;
  fullName: string;
  nationalId: string;
  phone: string;
  email: string;
  whatsapp?: string;
  nationality?: string;
  occupation?: string;
  workplace?: string;
  address?: string;
  notes?: string;
}

export interface RegistrationChildInput {
  childId?: string;
  clientKey: string;
  fullName: string;
  nationalId: string;
  birthDate: string;
  bloodType?: string;
  notes?: string;
}

export interface RegistrationDraftResult {
  applicationId: string;
  status: 'draft';
  registrationType: RegistrationType;
  children: Array<{
    clientKey?: string;
    childId: string;
    fullName: string;
  }>;
}

export interface RegistrationChild {
  clientKey?: string;
  id: string;
  fullName: string;
  nationalId?: string;
  birthDate: string;
  bloodType?: string;
  notes?: string;
  playerId?: string;
}

export interface RegistrationDocument {
  id: string;
  childId?: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileCategory: 'photo' | 'document';
  documentType?: string;
}

export interface RegistrationApplication {
  id: string;
  registrationType: RegistrationType;
  status: RegistrationStatus;
  parentName: string;
  parentNationalId?: string;
  parentPhone: string;
  parentEmail: string;
  parentWhatsapp?: string;
  parentNationality?: string;
  parentOccupation?: string;
  parentWorkplace?: string;
  parentAddress?: string;
  parentNotes?: string;
  children: RegistrationChild[];
  documents: RegistrationDocument[];
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}
