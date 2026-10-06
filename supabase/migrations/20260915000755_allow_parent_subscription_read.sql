CREATE POLICY select_subscriptions_parent_own_children
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  internal.has_role(ARRAY['parent'::text])
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = subscriptions.player_id
      AND COALESCE(NULLIF(trim(p.parent_email), ''), '') <> ''
      AND lower(trim(p.parent_email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
  )
);

