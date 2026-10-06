alter table public.subscriptions add constraint chk_subscriptions_date_range check (end_date >= start_date);
alter table public.players add constraint chk_players_birth_before_joined check (birth_date <= joined_date);
alter table public.trainings add constraint chk_trainings_duration_positive check (duration_minutes > 0 and duration_minutes <= 480);
alter table public.matches add constraint chk_matches_scores_nonnegative check (academy_score >= 0 and opponent_score >= 0);
