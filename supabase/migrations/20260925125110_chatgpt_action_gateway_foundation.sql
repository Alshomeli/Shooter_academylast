create table if not exists public.ai_action_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('approve_registration','review_registration','record_subscription_payment')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  preview jsonb not null default '{}'::jsonb check (jsonb_typeof(preview) = 'object'),
  status text not null default 'pending' check (status in ('pending','executed','cancelled','expired','failed')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  executed_at timestamptz,
  constraint ai_action_requests_expiry_after_create check (expires_at > created_at)
);

create index if not exists ai_action_requests_user_status_created_idx
  on public.ai_action_requests (user_id, status, created_at desc);

alter table public.ai_action_requests enable row level security;

revoke all on table public.ai_action_requests from public, anon, authenticated;
grant select, insert, update on table public.ai_action_requests to service_role;

comment on table public.ai_action_requests is
  'Short-lived server-side confirmation records for AI-assisted administrative actions. Business mutations still execute under the authenticated user JWT so existing RPC authorization remains authoritative.';
