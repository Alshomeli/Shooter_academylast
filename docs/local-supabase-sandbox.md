# Shooter Academy — Local Supabase sandbox (free)

**Local only.** These commands do not create a cloud project, deploy, or use the production Supabase project. Docker Desktop/Engine must already be installed and running. The `supabase:local:check` command verifies that Docker is available and refuses startup if this checkout contains a Supabase remote-project link.

## Quick start

```bash
npm ci
npm run test:isolated
npm run supabase:local:check
npm run supabase:local:start
npm run supabase:local:status
```

The first test runs the full isolated PGlite payment regression suite. The local Supabase command starts Docker-backed Auth/Postgres/Storage services. Use `npm run supabase:local:stop` to stop the containers.

**Important:** The original project contains existing migrations from earlier versions. Local Supabase startup can apply migrations automatically. Treat local startup as an **environment smoke check only** until all legacy migrations have been reviewed. A failed local startup does not imply production was touched. Do **not** run `supabase link`, `db push`, `db pull`, `functions deploy`, or `db reset --linked` in this workflow.

### Local frontend

Run `npm run supabase:local:status` to see the local API URL and anon/publishable key. Create an **untracked** `.env.local` with the local URL and key matching the variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` used in `src/lib/supabase.ts`, then run `npm run dev`. Never paste a production service-role key into a Vite environment variable. The local frontend is for developer verification only, not production activation.

### Readiness

- All PGlite SQL test suites, type checks, and build checks run independently of Docker.
- Real Supabase RLS and Storage integration requires local schema migration compatibility and a separate, explicitly created fake parent and manager in the **local** auth service.
- No test should be run against real users, production data, the restoration database, or paid services.
- Feature flag `VITE_ENABLE_FAMILY_RECEIPTS` defaults to disabled. Only use `true` in **local** `.env.local` after the local migration set and RLS policies have passed full tests.

### Troubleshooting

If Docker is unavailable, the isolated PGlite tests still run using `npm run test:isolated`. If local Supabase startup fails on a legacy migration, keep the feature flag disabled and fix a **local-only migration compatibility issue** on the development branch instead of connecting to a remote project.
