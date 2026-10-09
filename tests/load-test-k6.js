// Concurrent-login load test (k6).
//
//   brew install k6            # or: https://grafana.com/docs/k6/latest/set-up/install-k6/
//   npx tsx scripts/seed-test-users.ts   # creates the accounts + tests/users.csv
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_ANON_KEY=<anon-key> \
//   APP_URL=https://shooter-academy-new-1vvk.bolt.host \
//     k6 run tests/load-test-k6.js
//
// --- Before you raise the VU counts -------------------------------------------
// Supabase Auth rate limits POST /auth/v1/token per client IP. supabase/auth
// applies the TokenRefresh limiter to the password grant too:
//
//   internal/api/apilimiter/apilimiter.go
//     o.Token = tollbooth.NewLimiter(gc.RateLimitTokenRefresh/(60*5), ...).SetBurst(30)
//   internal/conf/configuration.go
//     RateLimitTokenRefresh float64 `split_words:"true" default:"150"`
//
// That is 0.5 requests/second sustained with a burst of 30, keyed on the source
// IP. Every VU below logs in once per iteration, so more than ~1 VU looping on a
// 1s sleep already exceeds the default budget and the run measures 429s instead
// of the application. Raise GOTRUE_RATE_LIMIT_TOKEN_REFRESH on the project (or
// distribute the load across source IPs) before using the `peak` stages.
//
// GET /auth/v1/user carries no GoTrue limiter, which is why it is used as the
// "one authenticated request" step.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.APP_URL || 'https://shooter-academy-new-1vvk.bolt.host';
const SUPABASE_URL = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';

const loginsOk = new Rate('logins_ok');
const rateLimited = new Counter('auth_rate_limited');

// The credentials come from tests/users.csv, written by
// scripts/seed-test-users.ts. Deriving emails from __VU instead would drift out
// of sync with whatever was actually seeded.
const users = new SharedArray('users', () => {
  const csv = open('./users.csv');
  return csv
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('email,'))
    .map(line => {
      const [email, password] = line.split(',');
      return { email, password };
    });
});

const peak = (__ENV.K6_PROFILE || 'smoke') === 'peak';

export const options = {
  scenarios: {
    login_flood: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: peak
        ? [
            { duration: '5m', target: 50 },
            { duration: '10m', target: 200 },
            { duration: '30m', target: 500 },
            { duration: '5m', target: 1000 },
            { duration: '10m', target: 0 },
          ]
        : [
            { duration: '1m', target: 5 },
            { duration: '3m', target: 10 },
            { duration: '1m', target: 0 },
          ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    logins_ok: ['rate>0.99'],
    auth_rate_limited: ['count<10'],
  },
};

export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set.');
  }
  if (users.length === 0) {
    throw new Error('tests/users.csv is empty - run scripts/seed-test-users.ts first.');
  }
  return { userCount: users.length, profile: peak ? 'peak' : 'smoke' };
}

export default function () {
  const user = users[__VU % users.length];

  // 1. Front end still serving.
  const homeRes = http.get(BASE_URL, { tags: { name: 'frontend' } });
  check(homeRes, {
    'frontend returns 200': r => r.status === 200,
    'frontend under 800ms': r => r.timings.duration < 800,
  });

  // 2. Concurrent sign-in through Supabase Auth.
  const loginRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      tags: { name: 'login' },
    },
  );

  if (loginRes.status === 429) rateLimited.add(1);

  // 200 is the only acceptable outcome. Accepting 400 as "validated" hides the
  // two failures that matter most here: a credential mismatch against the seeded
  // accounts, and the per-IP auth rate limiter.
  const loggedIn = check(loginRes, {
    'login returns 200': r => r.status === 200,
    'login under 1000ms': r => r.timings.duration < 1000,
  });
  loginsOk.add(loggedIn && loginRes.status === 200);

  if (loginRes.status !== 200) {
    sleep(1);
    return;
  }

  // 3. One authenticated request with the issued token.
  const token = loginRes.json('access_token');
  const meRes = http.get(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    tags: { name: 'authenticated' },
  });
  check(meRes, { 'authenticated request returns 200': r => r.status === 200 });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        profile: peak ? 'peak' : 'smoke',
        seededUsers: users.length,
        loginsOk: data.metrics.logins_ok?.value?.rate,
        rateLimited: data.metrics.auth_rate_limited?.value?.count,
        p95: data.metrics.http_req_duration?.values?.['p(95)'],
      },
      null,
      2,
    ) + '\n',
  };
}
