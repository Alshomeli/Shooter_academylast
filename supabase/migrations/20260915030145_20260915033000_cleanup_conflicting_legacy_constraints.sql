alter table public.subscriptions drop constraint if exists subscriptions_amount_positive_chk;
alter table public.subscriptions drop constraint if exists subscriptions_plan_type_chk;
alter table public.subscriptions drop constraint if exists subscriptions_status_chk;
alter table public.notifications validate constraint notifications_message_nonempty_chk;
alter table public.notifications validate constraint notifications_title_nonempty_chk;
