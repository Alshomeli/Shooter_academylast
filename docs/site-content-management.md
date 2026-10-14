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
