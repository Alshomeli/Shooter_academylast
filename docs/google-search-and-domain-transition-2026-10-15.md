# Shooter Academy — Google Search setup (official Bolt website)

The **current official public website** is `https://shooter-academy-new-1vvk.bolt.host/` until a domain controlled by the academy is explicitly connected and tested. **Do not point its canonical, sitemap or verification to `shooter.academy`**, which currently displays an unrelated/previous WordPress implementation and has not been verified as the selected production domain.

## What is ready in GitHub

- Public homepage: self-referencing canonical on the Bolt host; separate `ar`, `en`, `x-default` language alternates.
- `/?lang=en` receives an English canonical and metadata on client navigation; the static HTML includes alternate links for both languages.
- `public/robots.txt` permits the public page, limits known admin/auth routes and advertises the sitemap.
- `public/sitemap.xml` includes the Arabic homepage and `?lang=en` variant.
- The protected login/admin pages continue to use their existing `noindex` behavior.

**Important limitation:** the site uses a client-rendered React app. Google can render JavaScript in many cases, but do not assume that Search Console has indexed its pages, that crawlers always see the client-updated English canonical, or that social previews execute client code. Check the URL Inspection rendered HTML and consider static prerendering/SSR in a separate tested change if indexing proves unreliable.

## Google Search Console — exact owner actions

1. Open https://search.google.com/search-console and choose **Add property**.
2. Choose **URL prefix**, not Domain, and enter exactly `https://shooter-academy-new-1vvk.bolt.host/`. The URL-prefix property does not require ownership of the entire `bolt.host` domain.
3. Choose **HTML tag verification** or **HTML file upload**. Copy the exact unique value Google shows. Do **not** generate a placeholder token. A verified owner can share the tag/file with the project maintainer for adding to `index.html` or `public/`, followed by a Bolt **Publish → Update**.
4. Confirm that Google's verification method is publicly accessible on the Bolt production URL; click **Verify** in Search Console.
5. In Search Console, open **Sitemaps**, submit `sitemap.xml` and check whether Google can fetch it.
6. Use **URL Inspection** on `/` and `/?lang=en`. Check selected canonical, JavaScript-rendered content, and indexing. Request indexing if appropriate, understanding that Google controls crawl and ranking. Monitor Coverage/Pages and Performance.

**A Search Console verification token is not an API key for Google Maps or Analytics.** No Google credentials were invented, copied from WordPress, or committed to this repository. A map iframe can be displayed without providing the academy with a secret Maps API key; enable a billable Google Maps API only if actual application functionality requires it.

## Retiring the separate WordPress website

Two situations require different procedures:

### If the academy controls the domain and WordPress hosting

- Confirm ownership, registrar/DNS permissions, current WordPress admin, and any email/MX records on that domain.
- If the goal is to keep the domain: attach it to the Bolt project under **Settings → Domains & Hosting → Connect a domain you own**; use the DNS values Bolt gives for **that domain**, verify HTTPS and live links. Move all canonical/hreflang/robots/sitemap/OpenGraph URLs to the new official domain **after** a tested move. Preserve mail DNS records.
- If WordPress is no longer needed, disable publication or redirect old WordPress URLs with appropriate **301 redirects** to relevant pages of the academy's official site. Do not assume a domain-level redirect can replace application authentication callbacks without testing.
- If the goal is only to keep the old site out of Google while leaving it accessible, apply a **noindex** meta or X-Robots-Tag from the old WordPress hosting. Do **not** block the page in robots.txt before Google reads the noindex.
- With verified ownership in Search Console, use **Removals** for a temporary urgent suppression, not as a permanent replacement for removing/redirecting/noindexing the old content.

### If the academy does NOT control the old WordPress website/domain

- We cannot disable or modify it using the Bolt/GitHub repository. Do not attempt DNS edits, takeovers, or Google removal on a property the user does not own.
- Contact its operator and hosting provider requesting correction or removal. If content falsely impersonates the academy or infringes rights, use the relevant legal/reporting channels with evidence. The fact that Bolt is the preferred site is not proof of legal ownership of a different website/domain.
- Strengthen the official Bolt website's verifiable identity and Google Search Console property.

## Domain and content precautions

- The academy's registered commercial identity, guardian photo/video permissions and actual refund rules remain pending operational/legal confirmation.
- Do not configure or publish sensitive Google API credentials in `VITE_*` environment variables or HTML. Client-side secrets are public. Use server secrets only when the relevant API specifically requires a secret.
- Keep source domain changes out of this SEO-only update until the operator confirms control of a custom domain and that all relevant redirects and DNS values are tested.

Official Google docs:
- https://support.google.com/webmasters/answer/9008080
- https://support.google.com/webmasters/answer/7479439
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://support.bolt.new/cloud/domains/third-party-guides
