import { clean, shift, reportRequest, detailedReport, splitMessages, type ReadRows, type Row } from "./reports.ts";

const optionalServerEnv = (...parts: string[]) => Deno.env.get(parts.join("_"));

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_SECRET_KEYS = [SUPABASE_SERVICE_ROLE_KEY].filter(Boolean) as string[];

function serverApiKey(): string {
  if (SUPABASE_SERVICE_ROLE_KEY) return SUPABASE_SERVICE_ROLE_KEY;
  return SUPABASE_SECRET_KEYS[0] ?? "";
}

const WEBHOOK_SECRET = optionalServerEnv("TELEGRAM", "WEBHOOK", "SECRET");
const MANAGER_CHAT_IDS = optionalServerEnv("TELEGRAM", "MANAGER", "CHAT", "IDS");

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function bootstrapHashes(csv: string | undefined): Promise<Set<string>> {
  const hashes = new Set<string>();
  if (csv) {
    for (const part of csv.split(",").map((p) => p.trim()).filter(Boolean)) {
      hashes.add(await sha256Hex(part));
    }
  }
  return hashes;
}

let BOOTSTRAP_MANAGER_CHAT_HASHES: Set<string> | null = null;
let BOOTSTRAP_WEBHOOK_SECRET_HASHES: Set<string> | null = null;

async function ensureBootstrap(): Promise<{ chats: Set<string>; secrets: Set<string> }> {
  if (!BOOTSTRAP_MANAGER_CHAT_HASHES) BOOTSTRAP_MANAGER_CHAT_HASHES = await bootstrapHashes(MANAGER_CHAT_IDS);
  if (!BOOTSTRAP_WEBHOOK_SECRET_HASHES) BOOTSTRAP_WEBHOOK_SECRET_HASHES = await bootstrapHashes(WEBHOOK_SECRET);
  return { chats: BOOTSTRAP_MANAGER_CHAT_HASHES, secrets: BOOTSTRAP_WEBHOOK_SECRET_HASHES };
}

async function isAuthorizedWebhookSecret(secret: string | null): Promise<boolean> {
  if (!secret) return false;
  const hash = await sha256Hex(secret);
  return (await ensureBootstrap()).secrets.has(hash);
}

async function isAuthorizedManagerChat(chatId: number): Promise<boolean> {
  const hash = await sha256Hex(String(chatId));
  return (await ensureBootstrap()).chats.has(hash);
}

type TelegramIdentity = { role?: "manager" | "coach"; user_id?: string; staff_id?: string };
type LinkedIdentity = { role?: "manager" | "coach" | "parent"; user_id?: string; staff_id?: string };

async function fetchTelegramIdentity(chatId: number): Promise<LinkedIdentity | null> {
  const row = await callRpc<TelegramIdentity>("telegram_identity", { p_chat_id: chatId });
  return row && row.role ? row : null;
}

const DISPATCH_SECRET = optionalServerEnv("TELEGRAM", "DISPATCH", "SECRET");

async function isAuthorizedDispatch(secret: string | null): Promise<boolean> {
  if (secret && DISPATCH_SECRET && secret === DISPATCH_SECRET) return true;
  return secret ? isAuthorizedWebhookSecret(secret) : false;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GPT_MODEL = optionalServerEnv("OPENAI", "GPT", "MODEL") ?? "gpt-5.6-luna";
const MAX_VOICE_BYTES = 15 * 1024 * 1024;

type TelegramVoice = { file_id?: string; file_size?: number; duration?: number };
type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  voice?: TelegramVoice;
};
type TelegramCallbackQuery = {
  id: string;
  from?: { id: number };
  data?: string;
  message?: TelegramMessage;
};

const headersFor = (json: boolean): Record<string, string> => {
  const h: Record<string, string> = { apikey: serverApiKey() };
  if (json) h["content-type"] = "application/json";
  return h;
};

const authedHeaders = (): Record<string, string> => ({
  ...headersFor(true),
  Authorization: `Bearer ${serverApiKey()}`,
});

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: authedHeaders(),
    body: JSON.stringify(args),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (Array.isArray(json) ? (json[0] ?? null) : json) as T | null;
}

const read: ReadRows = async (table, params) => {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: authedHeaders(),
  });
  if (!res.ok) return [];
  return (await res.json()) as Row[];
};

async function postToTelegram(method: string, payload: Record<string, unknown>): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !text) return;
  for (const chunk of splitMessages(text)) {
    await postToTelegram("sendMessage", { chat_id: chatId, text: chunk });
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  await postToTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

async function editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: unknown): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  const payload: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await postToTelegram("editMessageText", payload);
}

const inlineKeyboard = (rows: Array<Array<{ text: string; callback_data: string }>>) => ({ inline_keyboard: rows });

async function telegramVoiceToText(voice: TelegramVoice): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN || !voice.file_id || !OPENAI_API_KEY) return null;
  if (voice.file_size !== undefined && voice.file_size > MAX_VOICE_BYTES) return null;
  const info = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${voice.file_id}`);
  const fileInfo = (await info.json()) as { ok?: boolean; result?: { file_path?: string } };
  if (!fileInfo?.ok || !fileInfo.result?.file_path) return null;
  const audio = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`);
  if (!audio.ok) return null;
  const form = new FormData();
  form.append("file", await audio.blob(), "voice.oga");
  form.append("model", "gpt-4o-mini-transcribe");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) return null;
  const parsed = (await res.json()) as { text?: string };
  return parsed.text ?? null;
}

const ADMIN_INTENTS = ["coaches", "attendance", "registrations", "revenue", "payment_proofs", "staff_documents"] as const;
type AdminIntent = (typeof ADMIN_INTENTS)[number];
const ADMIN_PERIODS = ["this_month", "last_month", "next_7_days"] as const;
type AdminPeriod = (typeof ADMIN_PERIODS)[number];
type AdminQuestion = { intent: AdminIntent; period: AdminPeriod; name?: string };

function deterministicAdminIntent(value: string): AdminQuestion | null {
  const q = clean(value);
  let intent: AdminIntent | null = null;
  if (q.includes("مدرب") || q.includes("coaches")) intent = "coaches";
  else if (q.includes("حضور") || q.includes("attendance")) intent = "attendance";
  else if (q.includes("تسجيل") || q.includes("registrations")) intent = "registrations";
  else if (q.includes("ايراد") || q.includes("revenue")) intent = "revenue";
  else if (q.includes("اثبات دفع") || q.includes("payment_proofs")) intent = "payment_proofs";
  else if (q.includes("شهادات") || q.includes("رخص") || q.includes("staff_documents")) intent = "staff_documents";
  if (!intent) return null;
  let period: AdminPeriod = "this_month";
  if (q.includes("الشهر الماضي") || q.includes("last_month")) period = "last_month";
  else if (q.includes("٧ ايام") || q.includes("7 ايام") || q.includes("next_7_days")) period = "next_7_days";
  return { intent, period };
}

function adminDateRange(period: AdminPeriod): { start: string; end: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (period === "last_month") {
    const d = new Date();
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
    return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
  }
  if (period === "next_7_days") return { start: today, end: shift(today, 7) };
  const d = new Date();
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return { start: first.toISOString().slice(0, 10), end: today };
}

async function classifyAdminQuestion(value: string): Promise<AdminQuestion | null> {
  const deterministic = deterministicAdminIntent(value);
  if (deterministic) return deterministic;
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: GPT_MODEL,
        input: `صنف سؤال المدير التالي إلى نية واحدة من: ${ADMIN_INTENTS.join(", ")} وفترة من: ${ADMIN_PERIODS.join(", ")}. أجب بصيغة JSON فقط بالحقول intent وperiod. السؤال: ${value}. لا تنشئ SQL ولا أسماء جداول.`,
      }),
    });
    if (!res.ok) return null;
    const parsed = (await res.json()) as { output_text?: string };
    const raw = parsed.output_text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const decoded = JSON.parse(match[0]) as { intent?: string; period?: string };
    if (!decoded.intent || !ADMIN_INTENTS.includes(decoded.intent as AdminIntent)) return null;
    const period = decoded.period && ADMIN_PERIODS.includes(decoded.period as AdminPeriod) ? (decoded.period as AdminPeriod) : "this_month";
    return { intent: decoded.intent as AdminIntent, period };
  } catch {
    return null;
  }
}

async function adminAnswer(parsedQuestion: { intent: AdminIntent; period: AdminPeriod }): Promise<string> {
  const intent = parsedQuestion.intent;
  const range = adminDateRange(parsedQuestion.period);
  if (parsedQuestion.intent === "revenue") {
    const rows = await read("transactions", { transaction_date_gte: range.start, transaction_date_lte: range.end, select: "id,type,amount,transaction_date,note" });
    const revenues = rows.filter((row) => String(row.type).toLowerCase() === "revenue");
    const total = revenues.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const subs = await read("subscriptions", { select: "id,status" });
    return `الإيرادات (${range.start} إلى ${range.end}): ${total} دينار من ${revenues.length} عملية. عدد الاشتراكات المسجلة: ${subs.length}.`;
  }
  if (parsedQuestion.intent === "payment_proofs") {
    const rows = await read("payment_proofs", { submitted_at_gte: range.start, submitted_at_lte: range.end, select: "id,status,submitted_at" });
    return `إثباتات الدفع بانتظار التحقق: ${rows.length} طلب خلال الفترة (${range.start} إلى ${range.end}).`;
  }
  if (parsedQuestion.intent === "staff_documents") {
    const rows = await read("staff_documents", { submitted_at_gte: range.start, submitted_at_lte: range.end, select: "id,doc_type,status" });
    return `شهادات/رخص الطاقم: ${rows.length} مستند خلال الفترة (${range.start} إلى ${range.end}).`;
  }
  const table = intent === "coaches" ? "coaches" : intent === "attendance" ? "attendance" : "registrations";
  const params =
    intent === "attendance"
      ? { session_date_gte: range.start, session_date_lte: range.end, select: "id,session_date,status" }
      : intent === "coaches"
        ? { role: "eq.coach", select: "id,full_name,role" }
        : { submitted_at_gte: range.start, submitted_at_lte: range.end, select: "id,status,submitted_at" };
  const rows = await read(table, params);
  if (intent === "coaches") {
    return `عدد المدربين: ${rows.length}\n` + rows.map((row) => `- ${String(row.full_name ?? "")}`).join("\n");
  }
  return `الحالات (${range.start} إلى ${range.end}):\n` + rows.map((row) => `- الحالة: ${String(row.status ?? "")}`).join("\n");
}

const REFUSAL_TEXT = "الأوامر الإدارية غير مدعومة عبر البوت. يمكن للأكاديمية إدخال التعديلات من لوحة الإدارة، والبوت يعرض التقارير فقط.";

function roleMenuPayload(role: "manager" | "coach"): { text: string; markup: ReturnType<typeof inlineKeyboard> } {
  if (role === "manager") {
    return {
      text: "قائمة المدير:",
      markup: inlineKeyboard([
        [{ text: "ملخص اليوم", callback_data: "menu:overview" }],
        [{ text: "إثباتات الدفع بانتظار التحقق", callback_data: "admin:payment_proofs" }],
        [{ text: "شهادات/رخص الطاقم", callback_data: "admin:staff_documents" }],
        [{ text: "الحضور الناقص", callback_data: "admin:attendance" }],
      ]),
    };
  }
  return {
    text: "قائمة المدرب:",
    markup: inlineKeyboard([
      [{ text: "حصة اليوم", callback_data: "coach:today" }],
      [{ text: "ملخص الحضور", callback_data: "coach:attendance" }],
      [{ text: "مباريات فريقي", callback_data: "coach:matches" }],
      [{ text: "إنهاء الحصة", callback_data: "training:complete:today" }],
    ]),
  };
}

async function sendRoleMenu(chatId: number, role: "manager" | "coach"): Promise<void> {
  const payload = roleMenuPayload(role);
  await postToTelegram("sendMessage", { chat_id: chatId, text: payload.text, reply_markup: payload.markup });
}

async function handleManagerCommand(chatId: number, inputText: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  let request = reportRequest(inputText, today);
  if (!request && (value => value.includes("ملخص"))(inputText)) request = reportRequest("ملخص اليوم", today);
  if (!request && (value => value.includes("دفع") || value.includes("اشتراك"))(inputText)) request = reportRequest("اشتراكات اليوم", today);
  if (!request) {
    const adminQuestion = await classifyAdminQuestion(inputText);
    if (adminQuestion) {
      await sendMessage(chatId, await adminAnswer(adminQuestion));
      return;
    }
    await sendMessage(chatId, REFUSAL_TEXT);
    return;
  }
  try {
    const text = await detailedReport(request, read);
    await sendMessage(chatId, text);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_report_date") {
      await sendMessage(chatId, "التاريخ المطلوب غير صالح. جرّب صيغة مثل: تقرير 2026-09-30");
    } else {
      await sendMessage(chatId, "تعذر توليد التقرير الآن. حاول مرة أخرى لاحقاً.");
    }
  }
}

async function handleManagerCallback(callbackQuery: TelegramCallbackQuery): Promise<void> {
  const callbackChatId = callbackQuery.message?.chat.id ?? callbackQuery.from?.id ?? 0;
  const callbackChatType = callbackQuery.message?.chat.type ?? "private";
  await answerCallbackQuery(callbackQuery.id);
  if (callbackChatType !== "private") return;
  if (!(await isAuthorizedManagerChat(callbackChatId))) return;
  await sha256Hex(String(callbackChatId));
  const data = callbackQuery.data ?? "";
  const messageId = callbackQuery.message?.message_id ?? 0;
  if (data.startsWith("reg:approve:")) {
    const applicationId = data.slice("reg:approve:".length);
    const ok = await callRpc<boolean>("telegram_approve_registration_application", { p_application_id: applicationId });
    await answerCallbackQuery(callbackQuery.id, ok ? "تم اعتماد طلب التسجيل" : "تعذر اعتماد الطلب");
    return;
  }
  if (data.startsWith("staff:approve:") || data.startsWith("staff:review:")) {
    const applicationId = data.split(":").at(-1) ?? "";
    const ok = await callRpc<boolean>("telegram_approve_staff_application", { p_application_id: applicationId });
    await editMessageText(callbackChatId, messageId, ok ? "تم اعتماد طلب الطاقم" : "تعذر اعتماد الطلب");
    return;
  }
  if (data.startsWith("training:complete:")) {
    const trainingId = data.slice("training:complete:".length);
    const ok = await callRpc<boolean>("telegram_complete_training", { p_training_id: trainingId });
    if (ok) await editMessageText(callbackChatId, messageId, "تم إنهاء الحصة.");
    return;
  }
  if (data.startsWith("menu:")) {
    await handleManagerCommand(callbackChatId, "ملخص اليوم");
  }
}

async function handleCoachTrainingCallback(callbackQuery: TelegramCallbackQuery): Promise<boolean> {
  const chatId = callbackQuery.message?.chat.id ?? callbackQuery.from?.id ?? 0;
  const chatType = callbackQuery.message?.chat.type ?? "private";
  if (chatType !== "private" || !callbackQuery.data?.startsWith("training:complete:")) return false;

  const telegramChatId = callbackQuery.from?.id ?? chatId;
  const identity = await fetchTelegramIdentity(telegramChatId);
  if (identity?.role !== "coach" || !identity.staff_id) {
    await answerCallbackQuery(callbackQuery.id, "غير مصرح لهذا الإجراء.");
    return true;
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bahrain" });
  // Materialize recurring sessions using the actual RPC contract (p_chat_id).
  await callRpc<number>("telegram_ensure_today_trainings", { p_chat_id: telegramChatId });

  const teams = await read("teams", {
    coach_id: `eq.${identity.staff_id}`,
    select: "id",
  });
  const teamIds = teams.map((team) => String(team.id ?? "")).filter(Boolean);
  if (!teamIds.length) {
    await answerCallbackQuery(callbackQuery.id, "لا توجد فرق مرتبطة بحسابك.");
    return true;
  }

  const trainings = await read("trainings", {
    team_id: `in.(${teamIds.join(",")})`,
    session_date: `eq.${today}`,
    select: "id,team_id",
  });
  if (!trainings.length) {
    await answerCallbackQuery(callbackQuery.id, "لا توجد حصة مسجلة لك اليوم.");
    return true;
  }

  let completedCount = 0;
  for (const training of trainings) {
    const completed = await callRpc<boolean>("telegram_complete_training", {
      p_chat_id: telegramChatId,
      p_training_id: String(training.id),
    });
    if (completed === true) completedCount += 1;
  }

  const resultText = completedCount === trainings.length
    ? "تم إنهاء الحصة بنجاح."
    : completedCount > 0
      ? `تم إنهاء ${completedCount} من ${trainings.length} حصص. راجع الحضور أو صلاحيات الفريق للحصص المتبقية.`
      : "تعذر إنهاء الحصة. تأكد من تسجيل حضور جميع اللاعبين.";
  await answerCallbackQuery(callbackQuery.id, resultText);
  await editMessageText(chatId, callbackQuery.message?.message_id ?? 0, resultText);
  return true;
}

async function handleCoachCommand(chatId: number, coachId: string, inputText: string): Promise<void> {
  const q = clean(inputText);
  const today = new Date().toISOString().slice(0, 10);
  const team = await callRpc<{ team_id: string }>("telegram_ensure_today_trainings", { p_coach_id: coachId, p_date: today });
  const teamId = team?.team_id ?? "";
  if (q.includes("انهاء") || q.includes("complete")) {
    await callRpc<boolean>("telegram_complete_training", { coach_id: coachId, team_id: teamId, p_date: today });
    await sendMessage(chatId, "تم إنهاء الحصة.");
    return;
  }
  if (q.includes("غياب") || q.includes("attendance")) {
    await callRpc<boolean>("telegram_set_training_attendance", { coach_id: coachId, team_id: teamId, p_date: today, p_status: "absent" });
    await sendMessage(chatId, "تم تحديث الحضور الناقص.");
    return;
  }
  if (q.includes("ملاحظة") || q.includes("note")) {
    await callRpc<boolean>("telegram_quick_player_note", { coach_id: coachId, team_id: teamId, p_note: inputText });
    await sendMessage(chatId, "تم تسجيل الملاحظة.");
    return;
  }
  await sendRoleMenu(chatId, "coach");
}

Deno.serve(async (req) => {
  const secretHeader = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  const dispatchSecretHeader = req.headers.get("X-Shooter-Dispatch-Secret");
  if (!(await isAuthorizedWebhookSecret(secretHeader)) && !(await isAuthorizedDispatch(dispatchSecretHeader))) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (payload.action === "flush_registration_notifications") {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const callbackQuery = payload.callback_query as TelegramCallbackQuery | undefined;
  if (callbackQuery) {
    const handledByCoach = await handleCoachTrainingCallback(callbackQuery);
    if (!handledByCoach) await handleManagerCallback(callbackQuery);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const message = payload.message as TelegramMessage | undefined;
  if (!message) return new Response(JSON.stringify({ ok: true }), { status: 200 });

  const chatId = message.chat.id;
  const chatType = message.chat.type;
  if (chatType !== "private") return new Response(JSON.stringify({ ok: true }), { status: 200 });

  if ((message.text ?? "").trim() === "/whoami") {
    await sendMessage(chatId, `معرّف المحادثة: ${chatId}`);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (await isAuthorizedManagerChat(chatId)) {
    let inputText = message.text ?? "";
    if (!inputText && message?.voice) {
      const voiceMessage = message.voice;
      const transcribed = await telegramVoiceToText(voiceMessage);
      if (!transcribed) {
        await sendMessage(chatId, "تعذر تحويل الرسالة الصوتية إلى نص.");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      inputText = transcribed;
    }
    await handleManagerCommand(chatId, inputText);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const telegramIdentity = await fetchTelegramIdentity(chatId);
  if (!telegramIdentity) {
    await sendMessage(chatId, "هذه البوابة مخصصة للإدارة والمدربين وأولياء الأمور المسجلين فقط.");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (telegramIdentity.role === "parent") {
    await sendMessage(chatId, "بوابة ولي الأمر: لا يمكن عرض تقارير الإدارة عبر البوت. راسل الأكاديمية من التطبيق لعرض بيانات اللاعب.");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (telegramIdentity.role === "manager") {
    await handleManagerCommand(chatId, message.text ?? "");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const linkedIdentity = telegramIdentity;
  if (linkedIdentity?.role !== "coach") {
    await sendMessage(chatId, "هذه البوابة مخصصة للإدارة والمدربين وأولياء الأمور المسجلين فقط.");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  let incomingText = textMessage(message);
  await handleCoachCommand(chatId, linkedIdentity.user_id ?? "", incomingText);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

function textMessage(message: TelegramMessage): string {
  return message.text ?? "";
}
