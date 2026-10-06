---
name: project-build-standards
description: >
  Core standards for building any app, website, or platform in Bolt — covers logical UI ordering,
  comprehensive secure database design with role-based access, and a phase-by-phase build-then-review
  workflow. Use this skill on EVERY new project, every new feature, every redesign, and every time the
  user asks to build, improve, or restructure an app. Apply it automatically even if the user does not
  mention it — these are baseline quality standards for all work.
---

# Project Build Standards

These are the foundational rules for building any project. They apply to every app, platform, or website
regardless of type — academies, stores, dashboards, booking systems, portfolios, or anything else.

## 1. Logical Navigation and UI Ordering

Organize every menu, sidebar, tab bar, and navigation element in a logical workflow sequence that
mirrors how a real user thinks about the system — not in the order features were built.

**The principle**: a user reading the menu top to bottom should feel like they are following a natural
workflow. Group related items together and order them from most foundational to most derived.

**How to decide the order**:
- Start with the core entities the system manages (players, products, students, properties, etc.)
- Then the people or relationships connected to those entities (parents, contacts, teams)
- Then the operational activities (attendance, schedules, bookings, orders)
- Then financial operations (subscriptions, payments, invoices, transactions)
- Then analytics and reporting (reports, dashboards, statistics)
- Then system administration last (settings, users, audit logs)

**Example — a sports academy sidebar**:
1. Dashboard (overview first)
2. Player Management (the core entity)
3. Teams (grouping of core entities)
4. Parent/Guardian Info (connected to players, so comes after)
5. Staff (operational people)
6. Attendance (daily operations)
7. Schedules & Training (operational planning)
8. Tournaments (events)
9. Subscriptions & Payments (financial)
10. Reports (analytics)
11. Settings (admin, always last)

**Bad ordering**: Settings > Reports > Players > Attendance > Parents — this forces users to jump
around with no logical flow.

Apply this same logic to form field ordering, table columns, dashboard card placement, and any
other sequential UI element. The user should never have to hunt for something that logically
follows from what they just saw.

## 2. Comprehensive and Secure Database Design

Build the database as a complete foundation from the start — not table by table as features get added.
Think through the full data model before writing the first migration.

### Table design principles

- **One table per real-world concept**: players, teams, subscriptions, attendance, transactions — each
  gets its own table with clear purpose. Do not mix unrelated data into a single table.
- **Proper relationships**: use foreign keys between related tables (player belongs to team, subscription
  belongs to player). Add indexes on every foreign key column and on columns used in filters or lookups.
- **Data integrity from day one**: add CHECK constraints for valid ranges (amounts >= 0, valid status
  values, valid roles). Add NOT NULL on required fields. Use enums or check constraints for fields with
  a known set of values (status, role, type).
- **Timestamps on everything**: every table should have `created_at` defaulting to `now()`. Tables
  tracking changes should also have `updated_at`.

### Role-based access control (RBAC)

Every project with multiple user types needs proper permissions. Design these based on the principle
of least privilege — each role sees only what they need.

**How to design roles for any project**:

1. **Identify user types**: list every distinct person who uses the system (admin, manager, employee,
   customer, viewer, etc.)
2. **Map each type to their real-world responsibilities**: what does a coach actually need to do?
   What does a parent need to see? Write it down before writing any policies.
3. **Build policies that match reality**:
   - The top admin/manager gets full access to all data and all actions
   - Operational roles (coach, teacher, agent) get read/write on their domain only
   - End users (student, parent, customer) get read-only access to their own data
   - Financial data is always restricted to admin + finance roles only
   - System settings are always admin-only

**RLS policy template by role level**:

| Access Level | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Admin/Manager | All rows | All tables | All tables | All tables |
| Operational (coach, staff) | All rows | Their domain tables | Their domain tables | None or admin only |
| End user (parent, student) | Own data only | Limited or none | Own profile only | None |

- Always enable Row Level Security on every table
- Always revoke anonymous access in any app with authentication
- Always use `has_role()` or equivalent helper functions — never hardcode role checks in policies
- Salary, financial, and personal ID data should have extra column-level restrictions

### Database checklist before moving on

Before considering the database phase done, verify:
- Every table has RLS enabled
- Every table has SELECT, INSERT, UPDATE, DELETE policies
- Foreign key indexes exist
- CHECK constraints exist for numeric and enum fields
- No anonymous grants on authenticated apps
- Role-based write restrictions match the real-world permission model

## 3. Phase-by-Phase Build and Review Workflow

Never build everything at once. Work in phases, and treat each phase boundary as a quality gate.

### The build cycle

```
Plan Phase -> Build Phase -> Review Phase -> Fix Phase -> Next Phase
                                  ^                          |
                                  |__________________________|
```

**For each phase**:

1. **Build it**: implement the feature or section completely — UI, database, validation, error
   handling, all of it. Do not leave half-finished flows.
2. **Review it thoroughly before moving on**: after finishing, review the phase as if auditing
   someone else's work. Check:
   - Does every button, link, and form actually work?
   - Are error states handled (empty data, network failure, invalid input)?
   - Is the UI responsive on mobile, tablet, and desktop?
   - Are Arabic and English translations complete (for bilingual projects)?
   - Does the database layer have proper validation and security?
   - Is the code clean — no unused imports, no dead code, no lint errors?
3. **Fix everything found**: do not carry known issues to the next phase. Fix them now.
4. **Then move on**: only start the next phase after the current one is solid.

### Final comprehensive review

After all phases are complete, do a deep full-project audit covering:

- **Security**: RLS policies, auth flow, exposed credentials, role enforcement
- **Data integrity**: constraints, indexes, relationships, cascade behavior
- **UI/UX**: navigation order, responsive design, loading states, error messages
- **Performance**: bundle size, lazy loading, unnecessary re-renders
- **Code quality**: dead code, unused dependencies, lint/type errors
- **Feature completeness**: are there obvious missing flows? (e.g., a list with no way to add items,
  a detail view nothing links to, a form with no validation)

**Proactive improvement**: after the audit, do not just list issues — fix them. If something is
clearly missing or broken, build it. Only ask the user about decisions that genuinely need their
input (design preferences, business logic choices). For technical gaps, missing validations, broken
flows, or security holes — just fix them and explain what was done.

### What "done" looks like

A phase or project is done when:
- Zero build errors, zero TypeScript errors, zero lint errors
- Every interactive element works end to end
- Error states show friendly messages, not technical errors
- The database is secure and complete for the feature set
- The UI follows logical ordering and is responsive
- A real user could use it without hitting a dead end
