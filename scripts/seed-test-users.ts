/**
 * Seed throwaway auth users for the concurrent-login load tests.
 *
 *   SUPABASE_URL=https://<project-ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   SEED_CONFIRM=<project-ref> \
 *     npx tsx scripts/seed-test-users.ts
 *
 * Writes tests/users.csv, which tests/artillery-load-test.yml and
 * tests/load-test-k6.js both read. Run scripts/cleanup-test-users.ts (or
 * select public.clean_stress_test_accounts('student_%@shooter-academy.com'))
 * when you are done.
 *
 * The service role key bypasses RLS and can create and delete accounts, so this
 * script refuses to run unless SEED_CONFIRM matches the project ref in
 * SUPABASE_URL. There are deliberately no fallback values for either secret.
 *
 * Options (all optional):
 *   SEED_COUNT          number of accounts to create            (default 100)
 *   SEED_EMAIL_PREFIX   local part prefix                       (default student)
 *   SEED_EMAIL_DOMAIN   domain                                  (default shooter-academy.com)
 *   SEED_PASSWORD       shared password                         (default TestPassword123!)
 *   SEED_CONCURRENCY    parallel createUser calls               (default 5)
 *   SEED_CSV_PATH       payload file to write                   (default tests/users.csv)
 *   SEED_PARENT_ROWS    1 to also create a public.parents row   (default 0)
 */
import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type SeedConfig = {
  url: string;
  serviceRoleKey: string;
  count: number;
  emailPrefix: string;
  emailDomain: string;
  password: string;
  concurrency: number;
  csvPath: string;
  createParentRows: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

function readConfig(): SeedConfig {
  const url = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const password = process.env.SEED_PASSWORD?.trim() || 'TestPassword123!';

  // Match the rule the app enforces on human sign-ups in src/components/Login.tsx
  // so seeded accounts behave like real ones.
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('SEED_PASSWORD must be at least 10 characters and include letters and numbers.');
  }

  const config: SeedConfig = {
    url,
    serviceRoleKey,
    password,
    count: positiveInt('SEED_COUNT', 100),
    emailPrefix: process.env.SEED_EMAIL_PREFIX?.trim() || 'student',
    emailDomain: process.env.SEED_EMAIL_DOMAIN?.trim() || 'shooter-academy.com',
    concurrency: positiveInt('SEED_CONCURRENCY', 5),
    csvPath: process.env.SEED_CSV_PATH?.trim() || 'tests/users.csv',
    createParentRows: process.env.SEED_PARENT_ROWS?.trim() === '1',
  };

  const projectRef = new URL(config.url).hostname.split('.')[0];
  if ((process.env.SEED_CONFIRM?.trim() ?? '') !== projectRef) {
    throw new Error(
      `Refusing to run against ${projectRef}. Set SEED_CONFIRM=${projectRef} to confirm the target project.`,
    );
  }
  return config;
}

async function listExistingEmails(supabase: ReturnType<typeof createClient>, prefix: string, domain: string): Promise<Set<string>> {
  const existing = new Set<string>();
  const suffix = `@${domain.toLowerCase()}`;
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed on page ${page}: ${error.message}`);
    const users = data?.users ?? [];
    for (const user of users) {
      const email = user.email?.toLowerCase();
      if (email?.startsWith(prefix) && email.endsWith(suffix)) existing.add(email);
    }
    if (users.length < 1000) break;
    page += 1;
  }
  return existing;
}

async function ensureParentRow(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  name: string,
): Promise<void> {
  // src/lib/store.ts#db.getCurrentUser resolves a session to a public.parents row
  // by user_id. Without one the app shows "Could not load your account", so a
  // load test that walks the real app flow needs this row to exist.
  const { error } = await supabase.from('parents').upsert(
    {
      id: `stress-${userId}`,
      name,
      email,
      status: 'active',
      joined_date: new Date().toISOString().slice(0, 10),
      user_id: userId,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`parents upsert failed for ${email}: ${error.message}`);
}

async function runInBatches<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += concurrency) {
    await Promise.all(items.slice(start, start + concurrency).map(worker));
  }
}

async function main(): Promise<void> {
  const config = readConfig();
  const supabase = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emails: string[] = [];
  for (let i = 1; i <= config.count; i += 1) {
    emails.push(`${config.emailPrefix}_${i}@${config.emailDomain}`.toLowerCase());
  }

  const existing = await listExistingEmails(supabase, config.emailPrefix.toLowerCase(), config.emailDomain);
  const missing = emails.filter(email => !existing.has(email));

  console.log(
    `Target ${new URL(config.url).hostname}: ${emails.length} requested, ${existing.size} already present, ${missing.length} to create.`,
  );
  if (config.createParentRows) {
    console.log('SEED_PARENT_ROWS=1 — a public.parents row will be created for every seeded account.');
  }

  const failures: string[] = [];
  const created: Array<{ email: string; id: string }> = [];

  await runInBatches(missing, config.concurrency, async email => {
    const index = email.split('_')[1]?.split('@')[0] ?? '0';
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: config.password,
      email_confirm: true,
      user_metadata: { full_name: `Student Test ${index}` },
    });
    if (error || !data.user) {
      failures.push(`${email}: ${error?.message ?? 'no user returned'}`);
      console.error(`Failed to create ${email}: ${error?.message ?? 'no user returned'}`);
      return;
    }
    created.push({ email, id: data.user.id });
    console.log(`Created: ${email} (${data.user.id})`);
  });

  if (config.createParentRows) {
    const targets = [
      ...created.map(user => ({ id: user.id, email: user.email })),
      ...emails.filter(email => existing.has(email)).map(email => ({ id: '', email })),
    ].filter(target => target.id);
    await runInBatches(targets, config.concurrency, async target => {
      try {
        await ensureParentRow(supabase, target.id, target.email, `Student Test ${target.email.split('_')[1]?.split('@')[0] ?? ''}`.trim());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${target.email}: ${message}`);
        console.error(message);
      }
    });
  }

  const csvPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', config.csvPath);
  const csv = ['email,password', ...emails.map(email => `${email},${config.password}`)].join('\n') + '\n';
  await writeFile(csvPath, csv, 'utf8');
  console.log(`Wrote ${emails.length} rows to ${config.csvPath}`);

  if (failures.length > 0) {
    console.error(`${failures.length} account(s) failed. The CSV lists the full intended set; re-run to retry.`);
    process.exitCode = 1;
  } else {
    console.log('Seeding completed successfully.');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
