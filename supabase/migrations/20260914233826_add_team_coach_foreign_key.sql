alter table public.teams
  add constraint fk_teams_coach_id
  foreign key (coach_id) references public.staff(id)
  on delete restrict;

create index if not exists idx_teams_coach_id on public.teams(coach_id);
