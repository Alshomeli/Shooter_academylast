alter table public.ai_action_requests
  drop constraint if exists ai_action_requests_operation_check



alter table public.ai_action_requests
  add constraint ai_action_requests_operation_check
  check (operation = any (array[
    'approve_registration'::text,
    'review_registration'::text,
    'record_subscription_payment'::text,
    'record_attendance'::text,
    'publish_player_evaluation'::text
  ]))
