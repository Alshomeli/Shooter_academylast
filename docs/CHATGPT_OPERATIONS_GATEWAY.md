# ChatGPT Operations Gateway

This gateway is the server-side foundation for letting an AI assistant prepare and execute academy administration actions without bypassing the application's existing authorization rules.

## Security model

- The caller must have a valid Supabase JWT.
- The gateway verifies the active staff account and role.
- Mutating actions are always two-step:
  1. `prepare` validates the target record and returns a short-lived preview.
  2. `execute` requires the same authenticated user, the request ID, and `confirm: true`.
- Prepared requests expire after 10 minutes.
- The short-lived request records are not readable or writable directly by browser clients.
- The actual business RPC is invoked with the user's JWT, so existing role checks remain authoritative.
- Successful executions are recorded through the existing audit-log RPC.
- The assistant must never silently execute a mutation from natural-language intent alone.

## Supported operations

### approve_registration
Manager only. Uses `approve_registration_application`.

### review_registration
Manager only. Supports `under_review`, `needs_info`, and `rejected`.
Uses `review_registration_application`.

### record_subscription_payment
Manager or accountant. The amount is read from the subscription in the database rather than trusted from AI input. Uses `record_subscription_payment`.

## Request examples

Prepare:
```json
{
  "mode": "prepare",
  "operation": "record_subscription_payment",
  "params": {
    "subscriptionId": "sub-123",
    "paymentMethod": "card"
  }
}
```

Execute only after the user confirms the preview:
```json
{
  "mode": "execute",
  "requestId": "<prepared-request-id>",
  "confirm": true
}
```

Cancel:
```json
{
  "mode": "cancel",
  "requestId": "<prepared-request-id>"
}
```

## Future ChatGPT connector

Expose only the Edge Function endpoint as the action surface. Keep Supabase tables private from the connector. Map each natural-language command to a supported operation, show the returned preview to the user, and call execute only after explicit confirmation.

Recommended next read-only tools: dashboard summary, pending registrations, overdue subscriptions, document coverage, and attendance summary.
Recommended later mutations: manager-reviewed notifications and assignment workflows, each using the same prepare/confirm/execute pattern.
