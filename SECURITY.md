# Security Policy

## Supported versions

The project actively maintains security updates for the current default branch and the most recent release line.

| Version | Supported |
| --- | --- |
| main / current default branch | Yes |
| latest tagged release | Yes |
| older versions | No |

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use one of the following private reporting methods:

1. GitHub Security Advisories (preferred):
   https://github.com/Alshomeli/Shooter_academylast/security/advisories
2. If the advisory workflow is unavailable, contact the maintainer through the repository owner profile and request a private security report.

When reporting, include:
- the affected component or endpoint
- reproduction steps or PoC
- impact assessment
- affected versions or commit hashes
- any suggested mitigation

## Response expectations

We will do our best to acknowledge valid reports promptly:

- Initial acknowledgment: within 5 business days
- Triage and impact assessment: within 10 business days
- Planned fix or mitigation timeline: communicated after triage

We ask reporters to avoid public disclosure until a fix has been prepared and released.

## Disclosure timeline

Security fixes will be prioritized and released as soon as practical. In most cases, public disclosure will happen only after the issue has been remediated or the affected parties have been notified.

## Security best practices for contributors

- Do not commit secrets or private tokens to the repository.
- Validate all user-supplied input server-side.
- Keep dependency versions updated.
- Review Supabase Edge Function authorization checks before enabling external webhooks.
- Prefer private reporting over public issue discussions for confirmed vulnerabilities.

## Security headers and production hygiene

`public/_headers` is the single source of truth for the frontend security
headers. It is copied into `dist/` by `vite build` and applied by Netlify.

- **CSP is enforced.** `Content-Security-Policy` is sent as an enforcing header,
  not `Content-Security-Policy-Report-Only`. `bolt.new` is deliberately not
  allow-listed, so enforcement removes the third-party badge script.
- **Known carve-out:** `script-src` still contains `'unsafe-inline'` because the
  hosting layer injects an inline bootstrap script into `index.html`. Removing
  the token is only safe once that injection is gone (tracked as follow-up); do
  not add new inline scripts to the document.
- **HSTS** is declared here with `max-age=31536000`. If the edge/CDN overrides
  it (currently Cloudflare), the shorter value wins — keep both at 12 months.
- **Injected scripts are blocked.** `/.webmcp/*` is answered with 404 by
  `public/_redirects`; any script served from the site origin must exist in this
  repository.

After every deploy run:

```bash
npm run verify:prod:hygiene                 # default https://shooter.academy
node scripts/verify-production-hygiene.mjs https://<preview-host>
```

The gate fails the run if CSP is Report-Only, if `bolt.new` or `/.webmcp/`
reappear, if HSTS drops below one year, or if the static HTML shell is missing.
