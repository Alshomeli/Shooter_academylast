/*
# Allow parent accounts to self-register their child as a player

1. Problem
   The `insert_players_authorized` policy only allows manager, coach, and
   receptionist roles to INSERT into `players`. A parent who self-registers
   cannot add their own child's player record — the INSERT is rejected by RLS.

2. Change
   - Recreate `insert_players_authorized` to also allow the `parent` role,
     but only when the player's `parent_email` matches the signed-in user's
     email. This prevents a parent from creating player records for other
     families.

3. Security
   - Staff roles (manager, coach, receptionist) can still insert any player.
   - Parent accounts can only insert a player whose `parent_email` matches
     their own auth email — verified by `auth.jwt() ->> 'email'`.
*/

DROP POLICY IF EXISTS "insert_players_authorized" ON public.players;
CREATE POLICY "insert_players_authorized" ON public.players FOR INSERT
  TO authenticated WITH CHECK (
    internal.has_role(ARRAY['manager','coach','receptionist'])
    OR (
      internal.has_role(ARRAY['parent'])
      AND lower(coalesce(parent_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND coalesce(parent_email, '') <> ''
    )
  );
