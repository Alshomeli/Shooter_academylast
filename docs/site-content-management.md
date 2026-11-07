# Website content management

Adds a manager-only `إدارة الموقع` section for news, gallery images, videos, public coach profiles and social/contact links. Draft edits are independent of the published snapshot. Saving never publishes; publishing copies the draft atomically. Hiding retains the draft. Restoring a revision creates a new draft version and does not publish automatically.

## Deployment order

1. Apply `20261014185958_manager_public_content.sql` to the Supabase project configured by Bolt's `VITE_SUPABASE_URL`. Verify that project before applying; the earlier review identified more than one database. The migration depends on the existing `internal.has_role(text[])` active-staff authorization helper.
2. The migration seeds the previously academy-approved public news/gallery/video/contact material, so the public homepage keeps its existing content. It does not publish private staff records or player documents.
3. Merge the frontend changes and publish from Bolt. Before the migration, the homepage retains the legacy content only when the API reports the content table missing. Other API failures show a load warning instead of silently restoring hidden content.
4. Verify with an active manager and a visitor: save, preview, publish, hide, revision restore, and actual Storage uploads/signed links. Confirm unauthorized roles cannot access drafts or write public content.

## Access and files

- Separate RLS-protected drafts/history and public snapshots; public reads contain published content only.
- The active manager predicate runs in the database and does not rely on editable JWT user metadata.
- History actors/timestamps/versions are recorded by database triggers, not client input. Clients have no history write privileges.
- Optimistic versions reject stale saves/publishes. Revisions list the latest 30 versions; earlier versions remain stored.
- A separate private `academy-content` bucket accepts JPEG/PNG/WebP/MP4, up to 20 MB server-side. UI images are limited to 5 MB, videos to 20 MB and signatures are checked before upload. This is a format check, not malware scanning.
- Visitor asset reads are allowed only while the file is referenced by published content. Signed links expire after one hour; an already-issued link may work until expiry after hiding.
- Orphan upload cleanup and automatic revision retention are not implemented; avoid deleting files referenced by published or historical content.

## Validation

Local lint, TypeScript and build passed. PGlite executed the migration and verified draft/history denial for visitors, coach denial, active-manager publishing, independent draft edits, stale-version rejection, hide/history behavior, and file-read policies. Browser QA could not run because the browser download failed in this environment. No production migration or live publication has been performed by this change.

Follow-up: complete browser/mobile QA and live database/API verification before release. Domain/canonical/sitemap/Search Console configuration requires the exact academy domain and relevant account access. MFA, backup/restore, and operational alert configuration remain separate work.

## Public website language translations (Arabic / English)

- The public homepage has a header language toggle: **EN / عربي**. The choice is saved in the existing user language preference and can be shared by appending `?lang=en` to the homepage or to `/privacy` and `/terms`.
- The homepage, accessible gallery controls, contact/footer copy, and the initial public media/news material have authored English wording. The legal pages are available in both languages; the legal copy remains a **preliminary draft requiring academy and legal approval**.
- Existing manager-managed material is **not machine-translated**. For a new or updated news story, gallery item, video, coach profile, or featured-player card, open **إدارة الموقع** and fill the optional English fields alongside Arabic before previewing/publishing:
  - `title_en`, `body_en`, `alt_en` for content and photos.
  - `album_en` for a gallery album, `role_en` for a coach.
  - `featured_name_en`, `featured_heading_en`, `featured_body_en` for the featured player.
- The English fields are stored in the **existing payload JSON**: no schema change or new migrations. Missing English copy displays the original approved Arabic text rather than fabricating an English translation. Keep album titles consistent across photos for a single activity.
- Both languages reuse the same media assets, permissions, and publication controls. Always test the EN view, media captions, photo-group links, the news modal, and `/terms?lang=en#refunds` before deploying from Bolt.
