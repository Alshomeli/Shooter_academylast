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
3. **HTML tag verification received from academy owner and committed to `index.html`.** Publish the latest `main` version through Bolt **Publish → Update** and verify that the Google tag appears in the deployed page's raw HTML `<head>`. Do not generate another token.
4. Confirm that Google's verification method is publicly accessible on the Bolt production URL; click **Verify** in Search Console.
5. In Search Console, open **Sitemaps**, submit `sitemap.xml` and check whether Google can fetch it.
6. Use **URL Inspection** on `/` and `/?lang=en`. Check selected canonical, JavaScript-rendered content, and indexing. Request indexing if appropriate, understanding that Google controls crawl and ranking. Monitor Coverage/Pages and Performance.

**A Search Console verification token is not an API key for Google Maps or Analytics.** The academy owner supplied the HTML verification tag for the official Bolt property; the exact value was placed in `index.html` for verification. This public site-ownership tag is not a secret or a Google Maps/Analytics API credential. No other Google credentials were invented or copied from WordPress. A map iframe can be displayed without providing the academy with a secret Maps API key; enable a billable Google Maps API only if actual application functionality requires it.

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

## Continued indexation review — 15 October 2026

- Search Console: the academy owner verified the official Bolt URL-prefix property and submitted a valid sitemap. Google **successfully processed** `sitemap.xml` and discovered **two** homepage URLs (Arabic/English).
- The latest submitted URL Inspection screenshot showed the root page as **Crawled — currently not indexed**. It confirmed that Googlebot Smartphone successfully fetched the page, was permitted to crawl and was permitted to index. A subsequent **Request Indexing** attempt failed due to the daily quota; no indexing request can be made through this GitHub project. Wait for Google, review URL Inspection the next day and retry only when available; repeated submissions do not guarantee indexing.
- Public web searches with `site:shooter-academy-new-1vvk.bolt.host` yielded no results during this review; that search is not a complete substitute for the Search Console property report.
- Independent HTTP fetch shows that initial `index.html` contains a Vite/React app shell (`<div id="root"></div>`), with actual homepage text rendered later by JavaScript. Google documents that it renders JavaScript but this is a separate crawl/render/index pipeline. Do not claim this alone caused "crawled, not indexed" or promise automatic ranking from metadata.
- Added **Organization + WebSite** JSON-LD to the initial HTML containing the academy's already public name, old approved red/white logo, contacts, location and links. Kept the original JPG logo, which is **1200×896** and publicly crawlable. No trade registry number or unverifiable legal identity claimed. The metadata is removed from private/legal views after SPA routing.
- The added structured data assists search engines in understanding the academy; **it does not guarantee indexing or rich results**. Site content remains JavaScript-rendered. If Google later reports rendered-content issues, investigate static pre-rendering/SSR in a separately reviewed change rather than replacing the live app impulsively.

Google references:
- https://developers.google.com/search/docs/appearance/structured-data/organization
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

### Next checks in Search Console
1. After the daily request limit clears, inspect the Arabic homepage. Use **Test live URL** and view the rendered HTML or screenshot to confirm the main heading and primary copy are visible to Googlebot.
2. Retry **Request Indexing** once if offered, not repeatedly.
3. Inspect `/?lang=en` as a separate URL. Check Google-selected canonical against `/?lang=en` and confirm the English page is rendered in English.
4. Review the Page indexing and Performance reports over the following days. "Discovered" does not equal "Indexed".
