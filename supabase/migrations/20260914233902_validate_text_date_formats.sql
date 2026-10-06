alter table public.players
  add constraint chk_players_birth_date_iso
  check (birth_date is null or trim(birth_date) = '' or birth_date ~ '^\d{4}-\d{2}-\d{2}$'),
  add constraint chk_players_joined_date_iso
  check (joined_date is null or trim(joined_date) = '' or joined_date ~ '^\d{4}-\d{2}-\d{2}$');

alter table public.trainings
  add constraint chk_trainings_session_date_iso
  check (session_date is null or trim(session_date) = '' or session_date ~ '^\d{4}-\d{2}-\d{2}$');

alter table public.subscriptions
  add constraint chk_subscriptions_start_date_iso
  check (start_date is null or trim(start_date) = '' or start_date ~ '^\d{4}-\d{2}-\d{2}$'),
  add constraint chk_subscriptions_end_date_iso
  check (end_date is null or trim(end_date) = '' or end_date ~ '^\d{4}-\d{2}-\d{2}$'),
  add constraint chk_subscriptions_paid_at_format
  check (paid_at is null or trim(paid_at) = '' or paid_at ~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$');

alter table public.transactions
  add constraint chk_transactions_transaction_date_iso
  check (transaction_date is null or trim(transaction_date) = '' or transaction_date ~ '^\d{4}-\d{2}-\d{2}$');
