/**
 * Production hygiene gate.
 *
 * The guard audit of 2026-11-23 found two scripts executing on the live site
 * that do not exist in this repository:
 *   - https://bolt.new/badge.js                      (third-party badge)
 *   - /.webmcp/bridge.js                             (same-origin AI bridge)
 * and a CSP that was shipped Report-Only, i.e. not enforced.
 *
 * This script asserts the deployed contract after a publish. Run it after every
 * deploy; it never mutates anything.
 *
 *   node scripts/verify-production-hygiene.mjs                 # https://shooter.academy/
 *   node scripts/verify-production-hygiene.mjs https://preview.example.net
 */
const base = (process.argv[2] || 'https://shooter.academy').replace(/\/+$/, '');

const checks = [];
function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function head(url) {
  const res = await fetch(url, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
  return { res, body: await res.text().catch(() => '') };
}

const home = await head(`${base}/`);
const html = home.body;
record('home responds 200', home.res.status === 200, `status ${home.res.status}`);

const csp = home.res.headers.get('content-security-policy') || '';
const cspRo = home.res.headers.get('content-security-policy-report-only') || '';
record('CSP is enforced (not Report-Only)', csp.length > 0 && cspRo.length === 0, csp ? 'header present' : 'header missing');
record("CSP blocks third-party scripts (no bolt.new)", !/bolt\.new/.test(csp), 'bolt.new must not be allow-listed');

record('no bolt.new script in HTML', !/bolt\.new/.test(html));
record('no /.webmcp bridge in HTML', !/webmcp/.test(html));

const bridge = await fetch(`${base}/.webmcp/bridge.js`, { redirect: 'manual' });
record('/.webmcp/bridge.js is not served', bridge.status !== 200, `status ${bridge.status}`);

const hsts = home.res.headers.get('strict-transport-security') || '';
const maxAge = Number((hsts.match(/max-age=(\d+)/i) || [])[1] || 0);
record('HSTS max-age >= 1 year (preload eligible)', maxAge >= 31536000, hsts || 'header missing');

const xfo = home.res.headers.get('x-frame-options') || '';
const nosniff = home.res.headers.get('x-content-type-options') || '';
record('X-Frame-Options present', Boolean(xfo), xfo || 'missing');
record('X-Content-Type-Options: nosniff', /nosniff/i.test(nosniff), nosniff || 'missing');

record('static shell is served in HTML (works without JS)', /id="static-shell"/.test(html), `${html.length} bytes of HTML`);

const failed = checks.filter(c => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.error('\nBlocking findings:\n' + failed.map(f => ` - ${f.name}${f.detail ? `: ${f.detail}` : ''}`).join('\n'));
  process.exit(1);
}
