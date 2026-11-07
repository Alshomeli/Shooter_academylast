/**
 * Remove the throwaway accounts created by scripts/seed-test-users.ts.
 *
 *   SUPABASE_URL=https://<project-ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   SEED_CONFIRM=<project-ref> \
 *     npx tsx scripts/cleanup-test-users.ts
 *
 * Two phases, in this order:
 *   1. public.clean_stress_test_accounts(pattern) removes the public-schema rows
 *      (parents, staff, registration_applications, notifications). This must run
 *      first: staff.user_id, parents.user_id and
 *      registration_applications.applicant_user_id reference auth.users(id) ON
 *      DELETE SET NULL, so deleting the auth user first leaves those rows behind
 *      with a nulled user_id, and internal.has_role() / is_academy_member() can
 *      still resolve an orphaned staff row by matching the JWT email claim.
 *   2. auth.admin.deleteUser() removes the auth users through GoTrue, so the
 *      delete is audited and any cached sessions are invalidated. Deleting
 *      straight from auth.users in SQL skips both.
 */
import { createClient } from '@supabase/supabase-js';

const DEFAULT_PREFIX = 'student';
const DEFAULT_DOMAIN = 'shooter-academy.com';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const url = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const prefix = (process.env.SEED_EMAIL_PREFIX?.trim() || DEFAULT_PREFIX).toLowerCase();
  const domain = (process.env.SEED_EMAIL_DOMAIN?.trim() || DEFAULT_DOMAIN).toLowerCase();
  const pattern = `${prefix}\\_%@${domain}`;

  const projectRef = new URL(url).hostname.split('.')[0];
  if ((process.env.SEED_CONFIRM?.trim() ?? '') !== projectRef) {
    throw new Error(`Refusing to run against ${projectRef}. Set SEED_CONFIRM=${projectRef} to confirm the target project.`);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Public-schema rows.
  const { data: summary, error: rpcError } = await supabase.rpc('clean_stress_test_accounts', {
    email_pattern: pattern.replace('\\_', '_'),
  });
  if (rpcError) throw new Error(`clean_stress_test_accounts failed: ${rpcError.message}`);
  console.log('Public schema cleanup:', JSON.stringify(summary));

  // 2. Auth users, through the Admin API.
  const victims: Array<{ id: string; email: string }> = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed on page ${page}: ${error.message}`);
    const users = data?.users ?? [];
    for (const user of users) {
      const email = user.email?.toLowerCase() ?? '';
      if (email.startsWith(`${prefix}_`) && email.endsWith(`@${domain}`)) {
        victims.push({ id: user.id, email });
      }
    }
    if (users.length < 1000) break;
    page += 1;
  }

  console.log(`Deleting ${victims.length} auth user(s) matching ${pattern}`);
  const failures: string[] = [];
  for (const victim of victims) {
    const { error } = await supabase.auth.admin.deleteUser(victim.id);
    if (error) {
      failures.push(`${victim.email}: ${error.message}`);
      console.error(`Failed to delete ${victim.email}: ${error.message}`);
    } else {
      console.log(`Deleted: ${victim.email}`);
    }
  }

  if (failures.length > 0) {
    console.error(`${failures.length} deletion(s) failed; re-run to retry.`);
    process.exitCode = 1;
    return;
  }
  console.log('Cleanup completed successfully.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
