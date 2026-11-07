alter table public.ai_action_requests
  add column if not exists execution_started_at timestamptz;

create index if not exists ai_action_requests_execution_state_idx
  on public.ai_action_requests (user_id, status, execution_started_at);

comment on column public.ai_action_requests.execution_started_at is
  'Set while an AI action is actively executing; used to recover abandoned executions.';
