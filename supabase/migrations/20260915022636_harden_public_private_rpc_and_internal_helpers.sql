REVOKE EXECUTE ON FUNCTION public.get_player_private() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_parent_private() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_staff_private() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_subscription_payment(text,numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_private() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_private() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_private() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_subscription_payment(text,numeric,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_parent_private()
RETURNS TABLE(id text, national_id text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p.id::text, p.national_id
  FROM public.parents p
  WHERE (SELECT internal.is_academy_admin());
$$;

CREATE OR REPLACE FUNCTION public.get_staff_private()
RETURNS TABLE(id text, salary numeric, national_id text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT s.id::text, s.salary::numeric, s.national_id
  FROM public.staff s
  WHERE (SELECT internal.is_academy_admin());
$$;

CREATE OR REPLACE FUNCTION public.record_subscription_payment(p_subscription_id text,p_amount numeric,p_payment_method text,p_transaction_date text DEFAULT NULL,p_description text DEFAULT NULL)
RETURNS public.transactions
LANGUAGE sql
SET search_path TO ''
AS $$
  SELECT internal.record_subscription_payment($1,$2,$3,$4,$5);
$$;

REVOKE EXECUTE ON FUNCTION internal.current_staff_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.current_staff_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.current_user_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.has_role(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.has_role(text[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.is_academy_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.is_academy_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.is_academy_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.is_academy_member() TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.is_active_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.is_active_member() TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.is_coach_of_team(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.is_coach_of_team(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.is_coach_of_parent(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.is_coach_of_parent(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.is_parent_of_player(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.is_parent_of_player(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION internal.record_subscription_payment(text,numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.record_subscription_payment(text,numeric,text,text,text) TO authenticated;

