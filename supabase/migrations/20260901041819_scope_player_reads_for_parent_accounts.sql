/*
# Limit parent accounts to their own child's player record

1. Problem
   The SELECT policy on `players` allowed any active member, including accounts
   registered with the lowest role (`parent`), to read every player row in the
   academy: name, birth date, blood type, notes and family contact details.

2. Change
   - `select_players_authenticated` now allows the four staff roles to read all
     rows, and a `parent` account to read only rows whose `parent_email`
     matches the signed-in email address.

3. Security
   - Staff behaviour is unchanged.
   - Parent accounts can no longer read other families' children.
*/

DROP POLICY IF EXISTS "select_players_authenticated" ON public.players;

CREATE POLICY "select_players_authenticated"
ON public.players FOR SELECT
TO authenticated
USING (
  internal.has_role(ARRAY['manager','accountant','coach','receptionist'])
  OR (
    internal.has_role(ARRAY['parent'])
    AND lower(coalesce(parent_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND coalesce(parent_email, '') <> ''
  )
);
