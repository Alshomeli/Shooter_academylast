-- Prevent authenticated clients from reading sensitive columns directly.
-- Sensitive values remain available only through the existing manager-only private RPCs.
revoke select on table public.staff from authenticated;
revoke select on table public.parents from authenticated;
revoke select on table public.players from authenticated;

grant select (
  id, name, email, phone, role, specialization, status, joined_date,
  avatar_url, licenses, experience_years, rating, tactical_style, notes,
  user_id, created_at
) on table public.staff to authenticated;

grant select (
  id, name, nationality, phone, whatsapp_phone, email, address, occupation,
  workplace, avatar_url, status, notes, joined_date, created_at, user_id
) on table public.parents to authenticated;

grant select (
  id, name, birth_date, blood_type, jersey_number, position, team_id,
  parent_name, parent_phone, parent_email, parent_id, status, joined_date,
  created_at
) on table public.players to authenticated;
