# ChatGPT Operations integration contract

This repository exposes administrative mutations through the Supabase Edge Function `ai-operations-gateway`.

## Safety contract

A connector must never call a business mutation directly. The required sequence is:

1. Send `mode: prepare` with an allow-listed operation.
2. Display the returned preview to the authenticated staff member.
3. Obtain an explicit confirmation from that person.
4. Send `mode: execute` with the prepared `requestId` and `confirm: true`.
5. Refresh application data and show the gateway result.

Cancellation uses `mode: cancel`. Recent actions can be fetched with `mode: history`. A connector can request `mode: snapshot` for a read-only, aggregate operational summary (unpaid subscriptions, active players, draft evaluations, and registration applications needing action). The snapshot does not return player names or other personal details.

The connector must authenticate with the user's Supabase access token. It must **never** contain or transmit the Supabase service-role key.

## Allow-listed operations

- `approve_registration`
- `review_registration`
- `record_subscription_payment`
- `record_attendance`
- `publish_player_evaluation`
- `create_subscription`

Role checks, ownership checks, rate limiting, expiration, atomic execution claims, existing database RPC checks, and audit logging remain enforced server-side.

The OpenAPI contract is in `docs/chatgpt-operations-openapi.yaml`. It prepares the project for a future ChatGPT/custom connector, but adding the file itself does not install or authorize a connector.
