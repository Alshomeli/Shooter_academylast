import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { documentUploadCopy, uploadErrorCopy } from '../src/lib/upload-copy.ts';
import { auditActionLabel, auditActionMatchesSearch, formatAuditDetails } from '../src/lib/audit-display.ts';

const auditLogsSource = readFileSync(new URL('../src/views/AuditLogs.tsx', import.meta.url), 'utf8');
const documentUploadSource = readFileSync(new URL('../src/components/DocumentUpload.tsx', import.meta.url), 'utf8');

test('upload copy is bilingual and explains the existing photo and document limits', () => {
  const photoAr = documentUploadCopy('ar', 'photo');
  const photoEn = documentUploadCopy('en', 'photo');
  const documentAr = documentUploadCopy('ar', 'document');
  const documentEn = documentUploadCopy('en', 'document');

  assert.equal(photoAr.empty, 'لا توجد ملفات مرفوعة بعد');
  assert.equal(photoEn.empty, 'No files uploaded yet');
  assert.match(photoAr.guidance, /20 ميجابايت/);
  assert.match(photoAr.guidance, /2 ميجابايت/);
  assert.match(photoEn.guidance, /up to 20 MB/);
  assert.match(photoEn.guidance, /2 MB target/);
  assert.equal(photoAr.cancel, 'إلغاء');
  assert.equal(photoEn.cancel, 'Cancel');
  assert.match(documentAr.guidance, /PDF حتى 5 ميجابايت/);
  assert.match(documentAr.guidance, /PNG حتى 20 ميجابايت/);
  assert.match(documentEn.guidance, /PDF up to 5 MB/);
  assert.match(documentEn.guidance, /PNG up to 20 MB/);
  assert.match(documentEn.dropPrompt, /drag/);
});

test('upload errors are localized without altering their validation result', () => {
  assert.match(uploadErrorCopy('حجم الملف كبير جداً. الحد الأقصى 20 ميجابايت', 'ar'), /20 ميجابايت/);
  assert.equal(uploadErrorCopy('حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت', 'en'), 'The file is too large. Maximum size: 5 MB.');
  assert.equal(uploadErrorCopy('صيغة الملف غير مدعومة. المسموح: JPG, PNG, WebP, PDF', 'en'), 'Unsupported file type. Allowed formats: JPG, PNG, WebP, and PDF.');
});

test('known technical audit actions receive useful Arabic and English labels', () => {
  assert.equal(auditActionLabel('login', 'ar'), 'تسجيل الدخول');
  assert.equal(auditActionLabel('subscription_payment_recorded', 'en'), 'Subscription payment recorded');
  assert.equal(auditActionLabel('player_updated', 'ar'), 'تعديل بيانات لاعب');
  assert.equal(auditActionLabel('registration_approved', 'en'), 'Registration approved');
  assert.equal(auditActionLabel('unknown_action', 'en'), 'unknown_action');
});

test('audit action search matches the displayed localized label and technical action', () => {
  assert.equal(auditActionMatchesSearch('login', 'تسجيل الدخول', 'ar'), true);
  assert.equal(auditActionMatchesSearch('registration_approved', 'اعتماد طلب التسجيل', 'ar'), true);
  assert.equal(auditActionMatchesSearch('subscription_payment_recorded', 'subscription payment recorded', 'en'), true);
  assert.equal(auditActionMatchesSearch('registration_approved', 'registration_approved', 'ar'), true);
  assert.equal(auditActionMatchesSearch('unknown_action', 'unknown_action', 'en'), true);
});

test('audit detail JSON is rendered LTR with plaintext bidi handling for punctuation', () => {
  assert.match(auditLogsSource, /<pre dir="ltr" style=\{\{ unicodeBidi: 'plaintext' \}\}/);
});

test('document deletion confirmation passes the localized cancel label to ConfirmDialog', () => {
  assert.match(documentUploadSource, /<ConfirmDialog[\s\S]*?cancelLabel=\{copy\.cancel\}/);
});

test('audit JSON is pretty-printed, sensitive keys are redacted, and source text is unchanged', () => {
  const stored = JSON.stringify({
    action: 'subscription_payment_recorded',
    amount: 12.5,
    player_id: 'synthetic-player-1',
    email: 'synthetic@example.test',
    session_token: 'synthetic-secret-token',
    nested: { status: 'paid', phone: '+973 3000 0000' },
  });
  const display = formatAuditDetails(stored, 'en');

  assert.match(display, /\n  "amount": 12.5,/);
  assert.match(display, /"action": "subscription_payment_recorded"/);
  assert.match(display, /"status": "paid"/);
  assert.equal((display.match(/\[redacted\]/g) || []).length, 4);
  assert.doesNotMatch(display, /synthetic-player-1|synthetic@example\.test|synthetic-secret-token|\+973/);
  assert.equal(stored, JSON.stringify({
    action: 'subscription_payment_recorded',
    amount: 12.5,
    player_id: 'synthetic-player-1',
    email: 'synthetic@example.test',
    session_token: 'synthetic-secret-token',
    nested: { status: 'paid', phone: '+973 3000 0000' },
  }));
});

test('non-JSON details also mask credentials and contact data', () => {
  const display = formatAuditDetails('Bearer synthetic.jwt.value; contact synthetic@example.test', 'ar');
  assert.doesNotMatch(display, /synthetic\.jwt\.value|synthetic@example\.test/);
  assert.match(display, /\[محجوب\]/);
});
