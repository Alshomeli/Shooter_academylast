create index if not exists telegram_attendance_tokens_training_id_idx on internal.telegram_attendance_tokens(training_id);
create index if not exists telegram_attendance_tokens_player_id_idx on internal.telegram_attendance_tokens(player_id);
create index if not exists trainings_completed_by_idx on public.trainings(completed_by);