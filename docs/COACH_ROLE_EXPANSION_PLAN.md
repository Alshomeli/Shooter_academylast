# Coaching roles: staged design and security gate

Status: implementation prepared in `20261011145140_coach_specialties_and_parent_portal.sql`; release requires the checks below.

## Existing constraints
- Current Role is manager/accountant/coach/receptionist/parent.
- teams.coach_id holds a primary coach; internal.is_coach_of_team currently checks an active primary coach.
- Adding UI choices alone will NOT grant correct RLS authorization.
- Staff registration approval, database constraints, team-scope helpers, player documents and storage rules must be audited together.

## Assistant coach
- Manager assigns assistant_coach to an active primary coach. Team scope follows that coach's CURRENT team assignments.
- Access ends immediately after reassignment, link removal, staff deactivation, or coach deactivation.
- Sporting permissions may match primary coach on those teams; financial, audit, staff-private, and managerial privileges remain prohibited.
- Approval and valid authenticated active staff identity required.

## Goalkeeper coach
- Manager designates a goalkeeper_coach and defines which cohort/team/player assignments that specialist serves.
- A player with validated goalkeeper position is assigned to the corresponding designated goalkeeper coach, retaining existing primary team and coach.
- Multiple specialists require deterministic manager-configured routing; do not infer from arbitrary free text.
- Permit sporting access only to eligible assigned keepers. No cross-team access to outfield players.

## Staging release gate
1. Inspect current staff, staff_applications, position and assignment CHECK constraints, triggers, RPCs, grants, RLS and storage.
2. Add explicit constrained assignment entities and manager-only mutators with referential and uniqueness safeguards.
3. Update authentication/onboarding/approvals and server-side permission helpers atomically with relevant policies.
4. Wire manager assignment UI, specialist views, localized labels and mobile navigation.
5. Test own-team and other-team access, revocation, inactive coaches, parent isolation, financial denial, duplicate goalkeeper assignments and mixed team contexts in isolated DB.
6. Pass typecheck, lint, test, build and staging runtime checks before considering release.

No production data edits, payment changes, bulk player migrations, deployment or merge in this document.

## Implemented routing and manager workflow
- Staff retains role `coach`; `coach_kind` distinguishes team, assistant and goalkeeper coaches.
- After approving an assistant application, the manager opens Staff → Edit and chooses an active supervising coach. Unlinked assistants have no player access.
- In Teams → Edit, the manager chooses one goalkeeper coach for each age team. Each specialist may serve several teams. The single foreign key prevents conflicting specialists for the same team.
- Only the exact supported goalkeeper position values (حارس مرمى / حارس / goalkeeper / gk) enter that specialist scope; name or notes never determine access.
- Parent photos and documents remain available after approval. Private object paths must match the child owned by that parent.
- The isolated PostgreSQL suite covers reassignment, deactivation, unlinked assistants, multiple specialists, document path forgery, cross-parent access, evaluation/attendance RPCs and both legacy and match-aware attendance signatures.
- Parent portal has all six navigation options at the top on desktop and mobile, plus the existing registration/payment workflows.

## Release procedure
Apply the new migration before publishing the frontend. It patches the installed attendance scope in place, preserving the match-aware seven-argument function if present. Do not replay historical migrations or reset academy data. Existing team coaches retain their original scope. Configure goalkeeper teams and assistant supervisors explicitly in the manager UI.
