alter table public.players
  add column if not exists national_id text;

comment on column public.players.national_id is
  'Player CPR / national identifier. Required by the production registration workflow; nullable for legacy/test rows.';

create unique index if not exists uq_players_national_id_normalized
  on public.players ((lower(trim(national_id))))
  where nullif(trim(national_id), '') is not null;

create unique index if not exists uq_parents_national_id_normalized
  on public.parents ((lower(trim(national_id))))
  where nullif(trim(national_id), '') is not null;

alter table public.academy_settings
  add column if not exists subscription_fee_semi_annual numeric not null default 0;

update public.academy_settings
set subscription_fee_semi_annual = subscription_fee_quarterly * 2
where subscription_fee_semi_annual = 0
  and subscription_fee_quarterly > 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_academy_settings_semi_annual_nonnegative'
      and conrelid = 'public.academy_settings'::regclass
  ) then
    alter table public.academy_settings
      add constraint chk_academy_settings_semi_annual_nonnegative
      check (subscription_fee_semi_annual >= 0);
  end if;
end $$;

create index if not exists idx_attendance_player_id
  on public.attendance (player_id);

create index if not exists idx_subscriptions_end_date
  on public.subscriptions (end_date);

create index if not exists idx_player_documents_player_category
  on public.player_documents (player_id, file_category);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_player_documents_photo_mime'
      and conrelid = 'public.player_documents'::regclass
  ) then
    alter table public.player_documents
      add constraint chk_player_documents_photo_mime
      check (
        file_category <> 'photo'
        or file_type in ('image/jpeg','image/png','image/webp')
      );
  end if;
end $$;
