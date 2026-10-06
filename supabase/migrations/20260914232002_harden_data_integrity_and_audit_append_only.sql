do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_players_team_id') then
    alter table public.players add constraint fk_players_team_id foreign key (team_id) references public.teams(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='chk_players_status') then
    alter table public.players add constraint chk_players_status check (status in ('active','inactive','suspended'));
  end if;
  if not exists (select 1 from pg_constraint where conname='chk_subscriptions_status') then
    alter table public.subscriptions add constraint chk_subscriptions_status check (status in ('unpaid','paid'));
  end if;
  if not exists (select 1 from pg_constraint where conname='chk_subscriptions_plan_type') then
    alter table public.subscriptions add constraint chk_subscriptions_plan_type check (plan_type in ('monthly','quarterly','semi_annual','annual'));
  end if;
  if not exists (select 1 from pg_constraint where conname='chk_transactions_type') then
    alter table public.transactions add constraint chk_transactions_type check (type in ('revenue','expense'));
  end if;
  if not exists (select 1 from pg_constraint where conname='chk_attendance_status') then
    alter table public.attendance add constraint chk_attendance_status check (status in ('present','absent','excused'));
  end if;
end $$;

-- Audit history should be append-only; managers can review it but not rewrite or erase history.
drop policy if exists update_audit_logs_manager on public.audit_logs;
drop policy if exists delete_audit_logs_manager on public.audit_logs;

