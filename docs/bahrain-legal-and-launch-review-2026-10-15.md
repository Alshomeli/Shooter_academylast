# Shooter Academy — Bahrain legal and launch review (15 October 2026)

**Status: Draft wording updated in code; NOT legal certification, licensed legal opinion, or final operational sign-off.** Do not represent the public legal pages as approved until the business/operator data and actual procedures have been validated.

## Authoritative legal sources checked

1. Bahrain Personal Data Protection Law **Law No. (30) of 2018**, especially Articles 3 (purpose, minimization, retention), 4 and 24 (lawful processing and guardian consent where applicable), 8 and 9 (security/confidentiality), 17 (information to data subjects), 18-23 (data-subject rights). Legislation & Legal Opinion Commission: https://lloc.gov.bh/Legislation/HTM/K3018
2. Bahrain Consumer Protection **Law No. (35) of 2012**, especially Articles 2, 4-6 and 8 (accurate information, commercial identity, price/receipt and remedies for deficient service): https://www.lloc.gov.bh/Legislation/HTM/K3512
3. **Law No. (28) of 2026** amending the Consumer Protection Law, including a right to delivery of the contracted goods or service: https://www.lloc.gov.bh/Legislation/HTM/K2826
4. Cross-border transfers under **Ministerial Order No. (42) of 2022**: https://www.pdp.gov.bh/assets/pdf/executive-decisions/eng/trans-order-countries-and-territories-with-adequate-protection-en.pdf
5. Ministry of Industry and Commerce FAQ for *internet retail* licensing describes returns/refund/terms/consumer policies; do **not** assume its retail-sales conditions automatically classify football coaching services: https://moic.bh/index.php/en/faq/27

## Review of previous wording and improvements

- Previously missing: confirmed legal identity and registration particulars; separate parental publicity consent; disclosure of provider categories and possible transfers; retention schedule; fuller rights and complaint channels.
- Previous bank-transfer wording said an unapproved subscription is not 'paid', which could be misread as denying an actual completed transfer. Revised to distinguish **verification/activation inside the portal** from the payment and its evidence.
- Cancellation/refund wording now expressly preserves statutory rights concerning deficient or undelivered services; it avoids both unconditional refunds and blanket 'no refunds' clauses.
- Privacy now distinguishes private player profile photos from publicly shared promotional images. Enrolling a child does **not** by itself prove consent to publicly post their identifiable photograph.
- Arabic and English versions have matching topics, preserving `#payments` and `#refunds` navigation.
- These are disclosure and drafting fixes only. They **do not establish** that media permissions are recorded in the backend, that cross-border transfers are compliant, or that retention is automated.

## Operational decisions required BEFORE calling policies final

| Item | Needed from academy | Why |
|---|---|---|
| Contracting business identity | Confirm exact registered legal/trade name, CR number (if applicable), official mailing/registered address, and service operator | Bahrain consumer and PDPL disclosures |
| Subscription terms | Price by plan, what sessions are included, contract start/end dates, how renewals work, missed classes | Consumers need accurate advance terms |
| Refund/cancellation rule | Eligibility, time for requests, unused session handling, cancellation before/after start, refunds for unavailable/defective service, response channel and timeframe | Cannot invent a blanket refund rule |
| Consent record for minors | Separate public-photo/video consent wording, who can grant it, how recorded, withdrawal requests, any existing photos authorized | A published player photo is not inherently covered by player registration |
| Third-party and international processing | Confirm hosting/storage/Telegram and other notification providers, countries, processor contracts and any transfer conditions | PDPL disclosure and transfer compliance |
| Data retention & deletion | Concrete retention periods by category, backups, archives, handling parent data access/erasure requests, who processes them | PDPL retention/data rights |
| Cookies & external services | Verify analytics/marketing cookies and third-party embeds actually deployed; document choices as implemented | Prevent misleading cookie notices |
| Consumer complaints | Set who answers, workflow/handling times, accessible contact details and lawful escalations | Operational accuracy |
| Legal review/approval | Licensed Bahrain lawyer plus academy authorized representative | Review draft against real service conditions |

## Remaining agreed website checklist — evidence-based

- **Homepage visual, social row, news, gallery, EN/AR, player-of-month:** implemented in GitHub and reported by owner as live. Site-crawl evidence confirmed rendered bilingual pages and one three-photo festival album. Live manager authorization/Storage flows still require authenticated browser QA.
- **SEO:** robots and sitemap implemented, `?lang=en` alternates. Google Search Console verification **not confirmed**. Canonical domain must be chosen; `https://shooter.academy/` currently serves a different WordPress site from the Bolt host. Do not auto-point the Bolt `sitemap.xml` or metadata to that domain.
- **Mobile iPhone/Safari:** responsive CSS and mobile screenshots are not a substitute for a real-device, interaction-based acceptance test. Must test menu, language/theme switch, photo modal, playback, map link, keyboard focus.
- **Media ownership/consent:** public festival and player photos must be checked against guardian permissions before publishing; do not make their use conditional on merely registering.
- **Content admin:** manager should test save -> preview -> publish, video poster, activity album, restoration, and hidden news, including English text fields.
- **Optional AI writing helper:** not confirmed implemented. Adding AI text generation involves tool integration, content review, and a provider agreement. Do not auto-publish AI-written player achievements.
- **Domain/Google:** decide primary canonical website, then configure hosting/redirects, HTTPS, indexing, and Search Console for that site.

## Deployment rule

Do not touch payments, authentication, database migrations or domain records under this legal-copy-only PR. Keep updates in a reviewable branch until automatic checks pass. After merge, owner must use Bolt **Publish → Update** and re-check `/privacy?lang=en`, `/terms?lang=en#refunds`, and footer links. Legal wording remains marked draft until owner confirms the listed operational facts and a licensed legal professional signs off.
