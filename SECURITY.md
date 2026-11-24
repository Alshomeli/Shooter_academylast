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
