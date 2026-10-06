-- Remediation 7: Protect players.notes which contains plaintext national IDs (CPR numbers)
-- Same pattern as get_staff_private() and get_parent_private()

-- 1. Revoke SELECT on players.notes from authenticated (keeps INSERT/UPDATE for staff who write notes)
REVOKE SELECT (notes) ON public.players FROM authenticated;

-- 2. Create manager-only RPC to retrieve private player notes
CREATE OR REPLACE FUNCTION public.get_player_private()
RETURNS TABLE(id text, notes text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'internal'
AS $function$
SELECT p.id::text, p.notes
FROM public.players p
WHERE internal.is_academy_admin();
$function$;

-- 3. Revoke PUBLIC and anon EXECUTE, grant only authenticated
REVOKE EXECUTE ON FUNCTION public.get_player_private() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_private() TO authenticated;