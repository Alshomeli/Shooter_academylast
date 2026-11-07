-- Reminder delivery history is disposable, not financial evidence. Preserve the
-- manager's existing pre-platform coverage flow that replaces an unpaid draft.
alter table internal.subscription_reminder_days
 drop constraint subscription_reminder_days_subscription_id_fkey,
 add constraint subscription_reminder_days_subscription_id_fkey
 foreign key(subscription_id) references public.subscriptions(id) on delete cascade;
alter table internal.subscription_telegram_reminders
 drop constraint subscription_telegram_reminders_subscription_id_fkey,
 add constraint subscription_telegram_reminders_subscription_id_fkey
 foreign key(subscription_id) references public.subscriptions(id) on delete cascade;
create index subscription_telegram_reminders_queued
 on internal.subscription_telegram_reminders(subscription_id) where status='queued';
