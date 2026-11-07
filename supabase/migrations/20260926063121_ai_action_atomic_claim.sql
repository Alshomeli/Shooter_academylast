alter table public.ai_action_requests
  drop constraint if exists ai_action_requests_status_check



alter table public.ai_action_requests
  add constraint ai_action_requests_status_check
  check (
    status = any (
      array[
        'pending'::text,
        'executing'::text,
        'executed'::text,
        'cancelled'::text,
        'expired'::text,
        'failed'::text
      ]
    )
  )
