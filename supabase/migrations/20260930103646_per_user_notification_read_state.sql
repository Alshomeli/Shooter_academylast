create table if not exists public.notification_reads (
  notification_id text not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(notification_id,user_id)
);
alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from anon;
grant select,insert,delete on public.notification_reads to authenticated;

drop policy if exists notification_reads_own_select on public.notification_reads;
create policy notification_reads_own_select on public.notification_reads for select to authenticated
using(user_id=(select auth.uid()));
drop policy if exists notification_reads_own_insert on public.notification_reads;
create policy notification_reads_own_insert on public.notification_reads for insert to authenticated
with check(user_id=(select auth.uid()) and exists(select 1 from public.notifications n where n.id=notification_id));
drop policy if exists notification_reads_own_delete on public.notification_reads;
create policy notification_reads_own_delete on public.notification_reads for delete to authenticated
using(user_id=(select auth.uid()));

create index if not exists idx_notification_reads_user on public.notification_reads(user_id,read_at desc);
