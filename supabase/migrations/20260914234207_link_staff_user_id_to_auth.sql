alter table public.staff
  add constraint fk_staff_user_id
  foreign key (user_id) references auth.users(id)
  on delete set null;

create unique index uq_staff_user_id on public.staff(user_id) where user_id is not null;
