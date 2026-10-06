/*
# Remove table-wide privileges the app never uses

1. Problem
   The `anon` and `authenticated` roles held TRUNCATE, TRIGGER and REFERENCES on
   every application table. TRUNCATE in particular ignores row level security
   entirely, so it is a privilege that should not be reachable by a client role.

2. Change
   - Revokes TRUNCATE, TRIGGER and REFERENCES on all tables in the `public`
     schema from `anon` and `authenticated`, and removes them from the default
     privileges for future tables.

3. Security
   - No effect on normal use: the API only issues SELECT, INSERT, UPDATE and
     DELETE, which are untouched.
*/

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated', t.relname);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;
