import type { Lang } from '@/types';
import { roleLabel } from './i18n';

type BilingualLabel = { ar: string; en: string };

const ACTION_LABELS: Record<string, BilingualLabel> = {
  login: { ar: 'تسجيل الدخول', en: 'Sign in' },
  logout: { ar: 'تسجيل الخروج', en: 'Sign out' },
  subscription_support_granted: { ar: 'تسجيل دعم مرتجع بعد الدفع', en: 'Post-payment support refund recorded' },
  subscription_payment_recorded: { ar: 'تسجيل دفعة اشتراك', en: 'Subscription payment recorded' },
  payment_recorded: { ar: 'تسجيل دفعة', en: 'Payment recorded' },
  registration_approved: { ar: 'اعتماد طلب التسجيل', en: 'Registration approved' },
  registration_rejected: { ar: 'رفض طلب التسجيل', en: 'Registration rejected' },
  attendance_recorded: { ar: 'تسجيل الحضور', en: 'Attendance recorded' },
  content_published: { ar: 'نشر المحتوى', en: 'Content published' },
  settings_updated: { ar: 'تحديث الإعدادات', en: 'Settings updated' },
  player_created: { ar: 'إضافة لاعب', en: 'Player created' },
  player_updated: { ar: 'تعديل بيانات لاعب', en: 'Player updated' },
  player_deleted: { ar: 'حذف لاعب', en: 'Player deleted' },
  staff_created: { ar: 'إضافة موظف', en: 'Staff member created' },
  staff_updated: { ar: 'تعديل بيانات موظف', en: 'Staff member updated' },
  staff_deleted: { ar: 'حذف موظف', en: 'Staff member deleted' },
  file_uploaded: { ar: 'رفع ملف', en: 'File uploaded' },
  file_deleted: { ar: 'حذف ملف', en: 'File deleted' },
};

const ACTION_WORDS: Record<string, BilingualLabel> = {
  add: { ar: 'إضافة', en: 'Added' },
  added: { ar: 'إضافة', en: 'Added' },
  approve: { ar: 'اعتماد', en: 'Approved' },
  approved: { ar: 'اعتماد', en: 'Approved' },
  archive: { ar: 'أرشفة', en: 'Archived' },
  archived: { ar: 'أرشفة', en: 'Archived' },
  attendance: { ar: 'الحضور', en: 'Attendance' },
  content: { ar: 'المحتوى', en: 'Content' },
  create: { ar: 'إنشاء', en: 'Created' },
  created: { ar: 'إنشاء', en: 'Created' },
  delete: { ar: 'حذف', en: 'Deleted' },
  deleted: { ar: 'حذف', en: 'Deleted' },
  document: { ar: 'مستند', en: 'Document' },
  evaluation: { ar: 'تقييم', en: 'Evaluation' },
  file: { ar: 'ملف', en: 'File' },
  login: { ar: 'تسجيل الدخول', en: 'Sign in' },
  logout: { ar: 'تسجيل الخروج', en: 'Sign out' },
  parent: { ar: 'ولي أمر', en: 'Parent' },
  payment: { ar: 'دفعة', en: 'Payment' },
  player: { ar: 'لاعب', en: 'Player' },
  publish: { ar: 'نشر', en: 'Published' },
  published: { ar: 'نشر', en: 'Published' },
  record: { ar: 'تسجيل', en: 'Recorded' },
  recorded: { ar: 'تسجيل', en: 'Recorded' },
  reject: { ar: 'رفض', en: 'Rejected' },
  rejected: { ar: 'رفض', en: 'Rejected' },
  registration: { ar: 'طلب تسجيل', en: 'Registration' },
  remove: { ar: 'حذف', en: 'Removed' },
  staff: { ar: 'موظف', en: 'Staff member' },
  subscription: { ar: 'اشتراك', en: 'Subscription' },
  team: { ar: 'فريق', en: 'Team' },
  update: { ar: 'تحديث', en: 'Updated' },
  updated: { ar: 'تحديث', en: 'Updated' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
};

export function auditActionLabel(action: string, lang: Lang): string {
  const original = action.trim();
  const normalized = original.toLowerCase();
  const exact = ACTION_LABELS[normalized];
  if (exact) return exact[lang];

  const words = normalized.split(/[._\s-]+/).filter(Boolean);
  if (words.length < 2 || words.some((word) => !ACTION_WORDS[word])) return original;
  return words.map((word) => ACTION_WORDS[word][lang]).join(' ');
}

export function auditRoleLabel(role: string, lang: Lang): string {
  return role === 'manager' ? roleLabel(role, lang) : role;
}

export function auditActionMatchesSearch(action: string, query: string, lang: Lang): boolean {
  const normalizedQuery = query.toLowerCase();
  return action.toLowerCase().includes(normalizedQuery) ||
    auditActionLabel(action, lang).toLowerCase().includes(normalizedQuery);
}

const REDACTED: Record<Lang, string> = { ar: '[محجوب]', en: '[redacted]' };
const SENSITIVE_KEY = /(?:password|passwd|secret|token|authorization|credential|cookie|session|email|phone|mobile|address|national.?id|civil.?id|identity.?number|birth.?date|date.?of.?birth|dob|ipaddress|^(?:ip|key)$|(?:user|player|parent|guardian|child)id|(?:user|player|parent|guardian|child|full|first|last)?name|file.?path|signed.?url)/i;

function redactText(value: string, lang: Lang): string {
  const replacement = REDACTED[lang];
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${replacement}`)
    .replace(/\b(?:password|passwd|secret|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization)\s*[:=]\s*["']?[^\s,;"'}]+/gi, (match) => `${match.split(/[:=]/, 1)[0]}=${replacement}`)
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement)
    .replace(/\+\d[\d ().-]{6,}\d/g, replacement)
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement);
}

function sanitizeJson(value: unknown, lang: Lang): unknown {
  if (Array.isArray(value)) return value.map((entry) => sanitizeJson(entry, lang));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const personalOrSecret = (SENSITIVE_KEY.test(key) && !normalizedKey.endsWith('name')) ||
        /^(?:user|player|parent|guardian|child|full|first|last)?name$/.test(normalizedKey) ||
        /^(?:user|player|parent|guardian|child)id$/.test(normalizedKey);
      return [key, personalOrSecret ? REDACTED[lang] : sanitizeJson(entry, lang)] as const;
    }));
  }
  return typeof value === 'string' ? redactText(value, lang) : value;
}

/** Format JSON for on-screen/export display only; never mutates or rewrites stored details. */
export function formatAuditDetails(details: string | null | undefined, lang: Lang): string {
  if (!details?.trim()) return '';
  try {
    const parsed: unknown = JSON.parse(details);
    return JSON.stringify(sanitizeJson(parsed, lang), null, 2);
  } catch {
    return redactText(details, lang);
  }
}
