# Telegram Manager integration

## Current state

The development branch is healthy and rebuilds all migrations successfully. `telegram-reply` is now the read-only Telegram Manager v1.

Security model:

- Telegram calls the webhook without a Supabase user JWT, so `verify_jwt = false` is required.
- Every request must pass `X-Telegram-Bot-Api-Secret-Token`.
- Administrative summaries are restricted to private chats.
- Allowed chats can be configured server-side in `TELEGRAM_MANAGER_CHAT_IDS`.
- The initial manager is bootstrapped using a one-way SHA-256 digest of the approved chat ID; the raw chat ID is not committed to source control.
- Bot token, webhook secret, and Supabase service role key stay in Edge Function secrets.
- The function does not expose player names, guardian details, national IDs, notes, or contact information.
- Telegram Manager v1 performs no inserts, updates, deletes, or RPC mutations.

## Commands

- `/whoami` — returns the Telegram chat/user IDs needed for server-side authorization setup.
- `ملخص اليوم` or `/summary` — active-player count, unpaid subscriptions, subscriptions ending today, and today's recorded income total.
- `من دفع اليوم؟` or `/payments` — today's income transaction count and total, without player-identifying details.
- `اشتراكات تنتهي اليوم` or `/expiring` — counts expiring today and during the next seven days.
- `مساعدة` or `/help` — command help.

## Required secret

Set `TELEGRAM_MANAGER_CHAT_IDS` to a comma-separated allowlist of authorized private Telegram chat IDs.

For future managers, place the approved chat ID in the Edge Function secret. Do not authorize based on Telegram username. The initial approved manager does not need `/whoami`; only its digest is stored in source control.

## Next stage

Mutating actions remain disabled until delegated staff identity is added. When enabled, mutations must reuse the existing `ai-operations-gateway` lifecycle:

`prepare -> preview -> explicit confirmation -> execute/cancel`

No Telegram mutation should bypass that confirmation flow.


## Webhook recovery

If the hosted Edge Function secret cannot be updated through the connected tooling, webhook registration can be recovered with a one-time bootstrap secret whose plaintext is never committed. Only its SHA-256 digest is stored in source control. The runtime still accepts the normal `TELEGRAM_WEBHOOK_SECRET` environment secret when configured.


## Voice notes

Authorized managers can send Telegram voice notes instead of typing supported administrative questions. The webhook uses Telegram `getFile`, downloads the voice note server-side, and transcribes it with OpenAI speech-to-text before passing the transcript through the same read-only intent routing used for text messages.

Required server secret: `OPENAI_API_KEY`. Never expose this key to the browser, Telegram messages, source control, or logs. Voice files are processed in memory and are not persisted by this function. Telegram bot downloads are limited to 20 MB.
