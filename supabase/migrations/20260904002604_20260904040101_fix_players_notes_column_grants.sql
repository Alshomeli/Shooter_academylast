-- Remediation 7 (corrected): Revoke table-level SELECT, grant column-level SELECT on all columns except notes
-- This follows the exact pattern used for staff.salary and parents.national_id

-- 1. Revoke table-level SELECT from authenticated (keeps INSERT, UPDATE, DELETE)
REVOKE SELECT ON public.players FROM authenticated;

-- 2. Grant column-level SELECT on all columns EXCEPT notes
GRANT SELECT (id, name, birth_date, blood_type, jersey_number, position, team_id,
              parent_name, parent_phone, parent_email, parent_id, status,
              joined_date, created_at) ON public.players TO authenticated;

-- 3. Ensure INSERT and UPDATE on notes column are preserved for staff who write notes
-- (These were already granted at table level; the column-level REVOKE SELECT does not affect INSERT/UPDATE)
GRANT INSERT (notes) ON public.players TO authenticated;
GRANT UPDATE (notes) ON public.players TO authenticated;