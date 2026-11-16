# Tavily free-tier research integration (Shooter Academy)

## Status
Implemented on feature branch only. Disabled by default and not deployed to production.

## Setup (no card required)
1. Create a **Researcher / Free** Tavily account: https://www.tavily.com/pricing
2. Obtain the Tavily API key in the Tavily dashboard. Do **not** paste this key into GitHub, app source, a chat message, a client-side environment variable, or a screenshot.
3. In Supabase Dashboard > Shooter academy > Edge Functions > Secrets, save:
   - `TAVILY_API_KEY` = your key
   - `AI_TAVILY_SEARCH_ENABLED` = `true` (only after the code is deployed and its behavior reviewed)
4. Keep `AI_WEB_GROUNDING_ENABLED` unused/disabled; this code no longer uses Google Search grounding.
5. Deploy `ai-management-assistant` *after* reviewing and merging PR #101. No database schema change is required.
6. In the coach's Training persona, select the search option and request a new session plan.
7. Validate the sources list and that it labels research as unavailable when search fails.

## Free-tier safeguards
- The Tavily request uses `search_depth: basic` and `max_results: 4`.
- Only one Tavily search per explicit coaching request; requests for recorded sessions do not search.
- A sanitized, generic, topic/age-based search query is constructed server-side, never the raw question or academy snapshot.
- Short text snippets are sent to Gemini as **untrusted reference material**; they are not instructions.
- In-memory 6-hour cache for duplicate queries within a warm Edge Function instance (not a global/durable quota).
- The feature is server-gated and defaults to off; on missing key or API errors it produces an explicit no-live-sources notice.
- The provider's Free plan enforces a credit exhaustion boundary, but **if the Tavily account is upgraded or pay-as-you-go is enabled, these code safeguards do NOT enforce a global billing cap**. Keep account on Free, avoid paid upgrades, and monitor the Tavily dashboard.

## Important restrictions
- Gemini usage and Supabase hosting quotas are separate from Tavily; Tavily being free does not make these services free.
- No secret or external API request is made while the server toggle is off.
- The UI displays citations only when the provider returns searchable references. It should not claim sources are verified or newest without dates.
- No writes to players, attendance, fees or any other internal records are allowed from this integration.

## Tests
`npm ci && npm run lint && npm run typecheck && npm test && npm run build`

See `tests/ai-coaching-grounding-contract.test.mjs`.
