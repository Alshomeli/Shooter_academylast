import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({
  entryPoints: ['src/lib/store.ts'], bundle: true, write: false, tsconfig: 'tsconfig.app.json', platform: 'node', format: 'esm',
  plugins: [{ name: 'mock-auth', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'mock', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabase = globalThis.__routingSupabase;', loader: 'js' }));
  } }],
});
let rows, metadata, updates, queries;
globalThis.window = { location: { search: '' } };
globalThis.__routingSupabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'self', email: 'test@example.invalid', user_metadata: metadata } } }),
    updateUser: async ({data}) => { updates.push(data); Object.assign(metadata, data); return {}; },
  },
  from(table) {
    queries.push(table);
    const chain = { select() { return chain; }, eq() { return chain; }, order() { return chain; }, limit() { return chain; },
      async maybeSingle() { return { data: rows[table] ?? null, error: null }; } };
    return chain;
  },
};
const { db } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function reset(search = '') { rows = {}; metadata = {}; updates = []; queries = []; window.location.search = search; }
test('Google staff applicant retains intent with no staff permissions', async () => {
  reset('?view=staff-registration');
  const user = await db.getCurrentUser();
  assert.equal(user.registrationOnly, true); assert.equal(user.registrationMode, 'staff');
  assert.deepEqual(updates, [{onboarding_mode:'staff'}]);
  window.location.search = '';
  assert.equal((await db.getCurrentUser()).registrationMode, 'staff');
});
test('existing and disabled accounts override URL and metadata', async () => {
  for (const status of ['active', 'inactive']) {
    reset('?view=registration');
    rows.staff = { id: 's1', role: 'coach', status };
    const user = await db.getCurrentUser();
    assert.equal(user.role, 'coach'); assert.equal(Boolean(user.registrationOnly), false);
    assert.equal(Boolean(user.accountDisabled), status === 'inactive');
    assert.equal(updates.length, 0);
  }
});
test('existing applications take priority over entry links', async () => {
  reset('?view=registration');
  rows.staff_applications = { requested_role: 'coach', status: 'pending' };
  assert.equal((await db.getCurrentUser()).registrationMode, 'staff');
  reset('?view=staff-registration');
  rows.registration_applications = { id: 'parent-request' };
  assert.equal((await db.getCurrentUser()).registrationMode, 'parent');
  assert.equal(updates.length, 0);
});
test('unidentified user sees choice instead of parent portal', async () => {
  reset();
  const user = await db.getCurrentUser();
  assert.equal(user.registrationMode, 'choose'); assert.equal(user.registrationOnly, true);
  assert.equal(updates.length, 0);
});
