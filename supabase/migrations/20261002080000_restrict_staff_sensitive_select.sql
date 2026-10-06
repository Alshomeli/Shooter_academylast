REVOKE SELECT ON TABLE public.staff FROM authenticated;
GRANT SELECT (
  row_version, id, name, email, phone, role, specialization, status, joined_date,
  avatar_url, licenses, experience_years, rating, tactical_style, notes, user_id, created_at
) ON TABLE public.staff TO authenticated;
