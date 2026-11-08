import { serve } from "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { reportRequest, detailedReport, splitMessages } from "./reports.ts";

const optionalServerEnv = (...parts: string[]) => Deno.env.get(parts.join("_"));
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const optionalServerEnvFrom = (...parts: string[]) => Deno.env.get(parts.join("_"));
const MAX_VOICE_BYTES = 20 * 1024 * 1024;

const MANAGER_CHAT_IDS = new Set(
  (optionalServerEnv("MANAGER", "CHAT", "IDS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value)),
);

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i++) mismatch |= aBytes[i] ^ bBytes[i];
  return mismatch === 0;
}

async function isAuthorizedManagerChat(chatId: number): Promise<boolean> {
  const raw = String(chatId);
  if (MANAGER_CHAT_IDS.has(chatId)) return true;

  const hashed = await sha256Hex(raw);
  const candidates = [...MANAGER_CHAT_IDS].map((id) => String(id));
  const candidateHashes = await Promise.all(candidates.map((candidate) => sha256Hex(candidate)));
  return candidates.some((candidate, i) =>
    constantTimeEqual(candidate, raw) || constantTimeEqual(candidateHashes[i], hashed)
  );
}

async function isAuthorizedWebhookSecret(value: string | null): Promise<boolean> {
  if (!value) return false;

  if (TELEGRAM_WEBHOOK_SECRET && value === TELEGRAM_WEBHOOK_SECRET) return true;
  if (!TELEGRAM_WEBHOOK_SECRET) return false;

  const expected = await sha256Hex(TELEGRAM_WEBHOOK_SECRET);
  const provided = await sha256Hex(value);
  return constantTimeEqual(expected, provided);
}

type TelegramFrom = { id?: number; is_bot?: boolean; first_name?: string };
type TelegramChat = { id?: number; type?: string };
type TelegramMessage = {
  message_id?: number;
  from?: TelegramFrom;
  chat?: TelegramChat;
  text?: string;
  voice?: { file_id?: string; file_unique_id?: string; duration?: number; file_size?: number };
};
type TelegramCallbackQuery = {
  id?: string;
  from?: TelegramFrom;
  data?: string;
  message?: TelegramMessage;
};
type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

function rejectUnauthorized(message: string, status = 401): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyTelegramRequest(req: Request): Promise<{ ok: true; payload: TelegramUpdate } | { ok: false; response: Response }> {
  if (req.method !== "POST") {
    return { ok: false, response: rejectUnauthorized("Method not allowed", 405) };
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, response: rejectUnauthorized("Unsupported content type", 415) };
  }

  const rawBody = await req.text();
  if (!rawBody || rawBody.trim().length === 0) {
    return { ok: false, response: rejectUnauthorized("Empty request body", 400) };
  }

  let payload: TelegramUpdate;
  try {
    payload = JSON.parse(rawBody) as TelegramUpdate;
  } catch {
    return { ok: false, response: rejectUnauthorized("Invalid JSON payload", 400) };
  }

  if (!payload || typeof payload !== "object") {
    return { ok: false, response: rejectUnauthorized("Invalid payload", 400) };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, response: rejectUnauthorized("Missing bearer token", 401) };
  }

  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  const secretAllowed = await isAuthorizedWebhookSecret(secretHeader);
  if (!secretAllowed) {
    return { ok: false, response: rejectUnauthorized("Forbidden webhook secret", 403) };
  }

  const message = payload.message ?? payload.callback_query?.message ?? null;
  const chat = message?.chat ?? payload.callback_query?.message?.chat ?? null;
  const chatId = chat?.id;

  if (typeof chatId !== "number" || Number.isNaN(chatId)) {
    return { ok: false, response: rejectUnauthorized("Missing or invalid chat id", 400) };
  }

  if (!(await isAuthorizedManagerChat(chatId))) {
    return { ok: false, response: rejectUnauthorized("Chat not authorized", 403) };
  }

  const sender = payload.message?.from ?? payload.callback_query?.from ?? null;
  if (sender?.is_bot) {
    return { ok: true, payload: { update_id: payload.update_id, message: { from: sender, chat, text: "", voice: undefined } } };
  }

  if (payload.callback_query && !payload.callback_query.data) {
    return { ok: false, response: rejectUnauthorized("Missing callback data", 400) };
  }

  if (message?.voice && message.voice.file_size && message.voice.file_size > MAX_VOICE_BYTES) {
    return { ok: false, response: rejectUnauthorized("Voice upload too large", 413) };
  }

  return { ok: true, payload };
}

serve(async (req: Request) => {
  const checked = await verifyTelegramRequest(req);
  if (!checked.ok) return checked.response;

  const payload = checked.payload;
  const message = payload.message ?? payload.callback_query?.message;

  if (!message && !payload.callback_query) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const inputText =
    typeof message?.text === "string"
      ? message.text.trim()
      : typeof payload.callback_query?.data === "string"
        ? payload.callback_query.data.trim()
        : "";

  if (!inputText && !message?.voice) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const logEntry = {
      ok: true,
      kind: payload.callback_query ? "callback_query" : "message",
      chatId: message?.chat?.id ?? payload.callback_query?.message?.chat?.id,
      userId: message?.from?.id ?? payload.callback_query?.from?.id,
      text: inputText || "",
      receivedAt: new Date().toISOString(),
    };

    await reportRequest(logEntry);

    if (inputText) {
      await detailedReport({ type: "telegram-command", content: inputText });
      await splitMessages(inputText, { maxLength: 3500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: messageText }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
