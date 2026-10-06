alter table public.staff drop constraint if exists chk_staff_role_valid;
alter table public.staff add constraint chk_staff_role_valid check (role = any (array['manager'::text,'accountant'::text,'coach'::text,'receptionist'::text]));
