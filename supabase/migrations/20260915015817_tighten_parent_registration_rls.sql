DROP POLICY IF EXISTS insert_parents_authorized ON public.parents;
CREATE POLICY insert_parents_authorized
ON public.parents
FOR INSERT
TO authenticated
WITH CHECK (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]));

DROP POLICY IF EXISTS update_parents_authorized ON public.parents;
CREATE POLICY update_parents_authorized
ON public.parents
FOR UPDATE
TO authenticated
USING (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]))
WITH CHECK (internal.has_role(ARRAY['manager'::text, 'receptionist'::text]));

