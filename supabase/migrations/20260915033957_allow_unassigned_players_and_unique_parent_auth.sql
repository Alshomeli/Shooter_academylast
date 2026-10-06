alter table public.players alter column team_id drop not null;
create unique index if not exists ux_parents_user_id_not_null on public.parents (user_id) where user_id is not null;
