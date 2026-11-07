import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../supabase/functions/telegram-reply/index.ts', import.meta.url), 'utf8');
const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');

test('Telegram webhook requires the provider secret and is configured without platform JWT verification', () => {
  assert.match(source, /optionalServerEnv\("TELEGRAM", "WEBHOOK", "SECRET"\)/);
  assert.match(source, /X-Telegram-Bot-Api-Secret-Token/);
  assert.match(source, /status:\s*401/);
  assert.match(config, /\[functions\.telegram-reply\][\s\S]*verify_jwt\s*=\s*false/);
});

test('Telegram manager is limited to direct chats and an explicit chat allowlist', () => {
  assert.match(source, /chatType !== "private"/);
  assert.match(source, /optionalServerEnv\("TELEGRAM", "MANAGER", "CHAT", "IDS"\)/);
  assert.match(source, /isAuthorizedManagerChat/);
  assert.match(source, /BOOTSTRAP_MANAGER_CHAT_HASHES/);
  assert.match(source, /crypto\.subtle\.digest\("SHA-256"/);
  assert.doesNotMatch(source, /5853714848/);
  assert.match(source, /\/whoami/);
});

test('Telegram manager mutations are limited to explicit approval RPCs', () => {
  assert.match(source, /ملخص اليوم/);
  assert.match(source, /transactions/);
  assert.match(source, /subscriptions/);
  assert.match(source, /telegram_approve_registration_application/);
  assert.match(source, /telegram_approve_staff_application/);
  assert.match(source, /reg:approve:/);
  assert.match(source, /staff:approve:/);
  assert.doesNotMatch(source, /\.insert\(/);
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /\.delete\(/);
});

test('Telegram bot credentials stay in server environment', () => {
  assert.match(source, /Deno\.env\.get\("TELEGRAM_BOT_TOKEN"\)/);
  assert.match(source, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.doesNotMatch(source, /\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/);
});


test('Telegram webhook bootstrap secret is stored only as a digest', () => {
  assert.match(source, /BOOTSTRAP_WEBHOOK_SECRET_HASHES/);
  assert.match(source, /isAuthorizedWebhookSecret/);
  assert.match(source, /crypto\.subtle\.digest\("SHA-256"/);
  assert.doesNotMatch(source, /QTX8VAH4At1fHrnlRBgLTRA6LIWTroAsUAhkE2xdbiY/);
});


test('Telegram server-side PostgREST calls authenticate with service role as apikey and bearer', () => {
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /SUPABASE_SECRET_KEYS/);
  assert.match(source, /serverApiKey/);
  assert.match(source, /if \(SUPABASE_SERVICE_ROLE_KEY\) return SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /apikey:\s*serverApiKey\(\)/);
  assert.match(source, /Authorization:\s*[\`'\"]Bearer\s*\$\{serverApiKey\(\)\}/);
  assert.doesNotMatch(source, /createClient\(/);
});

test('Telegram understands common Arabic phrasing beyond exact slash commands', () => {
  assert.match(source, /value\.includes\("ملخص"\)/);
  assert.match(source, /value\.includes\("دفع"\)/);
  assert.match(source, /value\.includes\("اشتراك"\)/);
});


test('Telegram manager accepts private voice notes and transcribes them server-side', () => {
  assert.match(source, /message\?\.voice/);
  assert.match(source, /getFile\?file_id=/);
  assert.match(source, /api\.telegram\.org\/file\/bot/);
  assert.match(source, /OPENAI_API_KEY/);
  assert.match(source, /\/v1\/audio\/transcriptions/);
  assert.match(source, /gpt-4o-mini-transcribe/);
  assert.match(source, /MAX_VOICE_BYTES/);
});

test('Voice transcription happens only after manager authorization', () => {
  const authIndex = source.indexOf('isAuthorizedManagerChat(chatId)');
  const transcribeCallIndex = source.lastIndexOf('telegramVoiceToText(voiceMessage)');
  assert.ok(authIndex >= 0);
  assert.ok(transcribeCallIndex > authIndex);
});


test('Telegram Smart Admin v2 supports safe natural-language read queries', () => {
  assert.match(source, /classifyAdminQuestion/);
  assert.match(source, /deterministicAdminIntent/);
  assert.match(source, /gpt-5\.6-luna/);
  assert.match(source, /\/v1\/responses/);
  assert.match(source, /"coaches"/);
  assert.match(source, /"attendance"/);
  assert.match(source, /"registrations"/);
  assert.match(source, /"revenue"/);
  assert.match(source, /role:\s*"eq\.coach"/);
});

test('Smart Admin v2 keeps model output away from SQL and database identifiers', () => {
  assert.match(source, /لا تنشئ SQL/);
  assert.match(source, /ADMIN_INTENTS/);
  assert.match(source, /ADMIN_PERIODS/);
  assert.doesNotMatch(source, /execute_sql/i);
  assert.doesNotMatch(source, /\.insert\(/);
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /\.delete\(/);
  assert.doesNotMatch(source, /execute_sql/i);
});

test('Smart Admin v2 supports bounded Bahrain date ranges', () => {
  assert.match(source, /adminDateRange/);
  assert.match(source, /this_month/);
  assert.match(source, /last_month/);
  assert.match(source, /next_7_days/);
  assert.match(source, /transaction_date_gte/);
  assert.match(source, /session_date_gte/);
  assert.match(source, /submitted_at_gte/);
});


test('Telegram financial summaries use the canonical revenue transaction type', () => {
  assert.match(source, /String\(row\.type\)\.toLowerCase\(\) === "revenue"/);
  assert.doesNotMatch(source, /String\(row\.type\)\.toLowerCase\(\) === "income"/);
  assert.match(source, /const revenues = rows\.filter/);
});


test('optional Telegram overrides do not trigger Bolt secret requirements', () => {
  assert.doesNotMatch(source, /Deno\.env\.get\("TELEGRAM_WEBHOOK_SECRET"\)/);
  assert.doesNotMatch(source, /Deno\.env\.get\("TELEGRAM_MANAGER_CHAT_IDS"\)/);
  assert.match(source, /parts\.join\("_"\)/);
});


test('Telegram staff and manager application callbacks require private authorized manager chats', () => {
  assert.match(source, /staff:approve:/);
  assert.match(source, /staff:review:/);
  assert.match(source, /callbackChatType !== "private"/);
  assert.match(source, /isAuthorizedManagerChat\(callbackChatId\)/);
  assert.match(source, /sha256Hex\(String\(callbackChatId\)\)/);
  assert.match(source, /telegram_approve_staff_application/);
  assert.match(source, /answerCallbackQuery/);
});


test('telegram manager assistant keeps payment proof and staff document queries in daily operations', () => {
  assert.match(source, /"payment_proofs"/);
  assert.match(source, /"staff_documents"/);
  assert.match(source, /إثباتات الدفع بانتظار التحقق/);
  assert.match(source, /شهادات\/رخص الطاقم/);
  assert.match(source, /parsedQuestion\.intent === "payment_proofs"/);
  assert.match(source, /parsedQuestion\.intent === "staff_documents"/);
});


test('Telegram operations are restricted to manager and coach linked roles', () => {
  assert.match(source, /role\?: "manager" \| "coach"/);
  assert.doesNotMatch(source, /role\?: "manager" \| "coach" \| "parent"/);
  assert.match(source, /linkedIdentity\?\.role !== "coach"/);
  assert.match(source, /telegram_identity/);
});

test('Coach daily operations stay scoped through server RPCs', () => {
  assert.match(source, /telegram_set_training_attendance/);
  assert.match(source, /telegram_complete_training/);
  assert.match(source, /telegram_quick_player_note/);
  assert.match(source, /telegram_ensure_today_trainings/);
  assert.match(source, /coach_id:/);
  assert.match(source, /team_id:/);
});

test('Coach attendance UI supports correction and completion workflow', () => {
  assert.match(source, /editMessageText/);
  assert.match(source, /الحالة:/);
  assert.match(source, /الحضور الناقص/);
  assert.match(source, /إنهاء الحصة/);
  assert.match(source, /training:complete:/);
});

test('Telegram role menus expose bounded operational shortcuts', () => {
  assert.match(source, /sendRoleMenu/);
  assert.match(source, /حصة اليوم/);
  assert.match(source, /ملخص الحضور/);
  assert.match(source, /مباريات فريقي/);
  assert.match(source, /ملخص اليوم/);
  assert.match(source, /إثباتات الدفع/);
});
