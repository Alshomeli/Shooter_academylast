# Prelaunch data protection

No production cleanup has been executed or approved by this implementation.

## Protected records

- All staff records with role `manager`, regardless of active status, and every linked Auth user and identity. Never assume only one manager exists.
- Academy settings, teams, coach assignments, published site content, schema, policies, triggers, functions and audit history.
- Any real operational record or file, and all dependencies of protected records.

## Blocking conditions before cleanup

1. Obtain a full database backup including Auth and internal schemas and a separate copy of actual Storage object bytes. The public-table JSON snapshot is only a partial backup.
2. Restore those backups to an isolated environment and verify record counts, links, object hashes and manager authentication. Keep production Auth/OAuth settings and server secrets recoverable privately.
3. Identify disposable test records by an explicit reviewed ID manifest. Names, missing parent links or birth years are not proof that a record is disposable.
4. Capture the exact set of protected manager IDs and Auth IDs. Abort if the set changes, any manager lacks an Auth link, or any proposed deletion reaches protected records.
5. Preview foreign-key and file dependencies and expected counts before any deletion. Do not use whole-table TRUNCATE, broad CASCADE or delete all Auth users.
6. Validate a clean-start scenario in isolation: manager login; create approved staff; assign teams and goalkeeper coaches; register parent and child; check birth category assignment; verify restricted views, document access, attendance and isolated payment-to-revenue linkage. No production payment or notification sends.
7. Obtain final approval for the exact deletion manifest. Database cleanup must be transactional with count/set guards. Storage deletion is a separate approved operation after verified file backup.
8. Recheck manager account sets and settings before commit and after cleanup. Verify no orphaned references. Retain the recovery point and a cleanup audit.

Email confirmation stays unchanged until the final launch step. Code tests do not replace live device, role, restore or delivery checks.
