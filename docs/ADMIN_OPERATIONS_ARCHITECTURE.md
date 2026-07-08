# Admin Operations Architecture (Phase 10)

This document describes the admin operations foundation built in Phase
10: the permission model, business-record tables (students, parents,
coaches, batches, schedules, enrollments), account provisioning, bulk
import, audit logging, and the security boundaries every future phase
must respect. It does not cover student/parent/coach dashboard
features, attendance, progress tracking, certificates, payments, or
tournament admin management — none of that exists yet.

## Permission Model

Phase 9 already gates the whole `/admin` route tree to
`STAFF | ADMIN | SUPER_ADMIN` (`src/app/admin/layout.tsx` calling
`requireRole()`). That check is necessary but not sufficient: it does
not distinguish what a STAFF user can do versus an ADMIN or
SUPER_ADMIN. Phase 10 adds a lightweight permission layer on top,
centralized in `src/lib/auth/permissions.ts`.

`AdminPermission` is a closed union: `VIEW_STUDENTS`, `MANAGE_STUDENTS`,
`VIEW_PARENTS`, `MANAGE_PARENTS`, `VIEW_COACHES`, `MANAGE_COACHES`,
`VIEW_BATCHES`, `MANAGE_BATCHES`, `VIEW_SCHEDULES`, `MANAGE_SCHEDULES`,
`VIEW_ENROLLMENTS`, `MANAGE_ENROLLMENTS`, `MANAGE_ACCOUNTS`,
`MANAGE_ROLES`, `VIEW_AUDIT_LOG`.

### Permission Matrix

| Permission | STAFF | ADMIN | SUPER_ADMIN |
| --- | --- | --- | --- |
| VIEW_STUDENTS | yes | yes | yes |
| MANAGE_STUDENTS | yes | yes | yes |
| VIEW_PARENTS | yes | yes | yes |
| MANAGE_PARENTS | yes | yes | yes |
| VIEW_COACHES | yes | yes | yes |
| MANAGE_COACHES | no | yes | yes |
| VIEW_BATCHES | yes | yes | yes |
| MANAGE_BATCHES | no | yes | yes |
| VIEW_SCHEDULES | yes | yes | yes |
| MANAGE_SCHEDULES | no | yes | yes |
| VIEW_ENROLLMENTS | yes | yes | yes |
| MANAGE_ENROLLMENTS | no | yes | yes |
| MANAGE_ACCOUNTS | no | yes | yes |
| VIEW_AUDIT_LOG | no | yes | yes |
| MANAGE_ROLES | no | no | yes |

STUDENT/PARENT/COACH all resolve to an empty permission set — they
cannot reach `/admin` at all (Phase 9's layout check blocks them before
permissions are even considered).

### `requirePermission()` Is the Real Boundary

`requirePermission(permission)` calls `requireRole(["STAFF", "ADMIN",
"SUPER_ADMIN"])` (the Phase 9 layout check, safe to call again — it's
idempotent) and then checks `hasPermission(profile.role, permission)`,
redirecting to `/admin` if the caller doesn't have it. Every admin
Server Action in `src/lib/actions/admin/*.ts` calls
`requirePermission()` as its first line, independently of whatever the
UI shows. The nav (`src/config/adminNavigation.ts`,
`src/components/admin/AdminShell.tsx`) filters visible links by
permission too, but that is a UX convenience, not a security boundary —
hiding a link does not stop a STAFF user from invoking a Server Action
directly if they somehow reference it; `requirePermission()` inside
that action is what actually stops them.

## Admin Shell

`src/components/admin/AdminShell.tsx` replaces the Phase 9
`ProtectedShell` placeholder for `/admin` only (portal/parent/coach
still use `ProtectedShell` — their scope didn't change this phase).
Desktop: a sticky left sidebar (`AdminSidebarNav`) plus a topbar plus a
`main` region. Mobile: a compact topbar with a menu button opening an
accessible drawer (`AdminMobileNav` — traps focus into the first link
on open, restores focus to the trigger on close, closes on Escape,
renders as a real `<nav>` inside a `role="dialog"` container). Nav
items are the fixed list in `src/config/adminNavigation.ts` — there is
no link to any route that doesn't exist yet (Attendance, Progress,
Certificates, Payments, Tournaments, Media all deliberately absent).

## Admin Routes Built This Phase

```
/admin                    overview (real counts, permission-gated cards)
/admin/students            list, search, filter, paginate
/admin/students/new        create
/admin/students/[id]       detail: edit, status, parent links, enrollments, account
/admin/students/import     bulk CSV import (preview -> confirm)
/admin/parents             list, search, filter, paginate
/admin/parents/new         create
/admin/parents/[id]        detail: edit, status, linked students, account
/admin/coaches             list, search, filter, paginate
/admin/coaches/new         create
/admin/coaches/[id]        detail: edit, status, assigned batches, account
/admin/batches             list, search, filter, paginate
/admin/batches/new         create
/admin/batches/[id]        detail: edit, status, coaches, schedules, current students
/admin/schedules           list, filter by day/active
/admin/schedules/new       create (optionally preselecting a batch via ?batchId=)
/admin/enrollments         list, filter by status
/admin/enrollments/new     create (student search + program + optional batch)
/admin/accounts            provision/deactivate/reactivate accounts; SUPER_ADMIN-only staff role table
/admin/audit-log           filtered, paginated audit trail
```

Every route above is `noindex, nofollow` (via `buildMetadata({..., index:
false})`), absent from the sitemap, and covered by `robots.ts`'s
existing `/admin` disallow rule (unchanged from Phase 9 — verified, not
re-added). Robots.txt is not a security control; the actual protection
is `requireRole()` at the layout and `requirePermission()` in every
mutation.

## Business Records vs. Auth Profiles

`students`, `parents`, and `coaches` are business records, not
authentication profiles. Each has a nullable `profile_id` — a student,
parent, or coach can exist in Phoenix's operational system (e.g.
imported from an offline roster) long before, or even without ever
having, a portal login. This is the opposite of assuming every business
record has a 1:1 `auth.users` row.

### Student

`students`: `id`, `profile_id` (nullable), `student_code`, `full_name`,
`date_of_birth`, `gender`, `email`, `phone`, `whatsapp`, `country`,
`state`, `city`, `address`, `fide_id`, `fide_rating`,
`chess_association_id`, `current_level`, `joined_on`, `status`,
`notes`, `created_at`, `updated_at`. Deliberately does not collect
government IDs (Aadhaar/PAN/passport) or medical records — those were
never requested and are out of scope.

`status` is a typed enum: `ACTIVE | INACTIVE | ON_HOLD | ALUMNI |
ARCHIVED`. There is no `DELETED` status and no automatic deletion of
inactive students — archiving is the only "removal" path, and it's a
status change, not a row delete.

### Parent

`parents`: `id`, `profile_id` (nullable), `full_name`, `email`, `phone`,
`whatsapp`, `country`, `state`, `city`, `status`, `notes`, `created_at`,
`updated_at`. `status`: `ACTIVE | INACTIVE | ARCHIVED`.

Email is intentionally **not** globally unique — families sometimes
share one email across parents, or a parent record may have no email
at all (phone-only contact). Uniqueness is not enforced at the database
level for `parents.email`.

**Phone normalization strategy** (used for import duplicate matching,
`src/lib/admin/importMatching.ts`): a phone value is trimmed; if it
starts with `+`, the `+` is kept and all other non-digit characters are
stripped; otherwise all non-digit characters are stripped and no `+` is
added. This means `+91 98765 43210`, `+919876543210`, and `+91-9876-5-43210`
all normalize to `+919876543210`, but a domestic number entered without
a country code (`9876543210`) normalizes to `9876543210` and will not
automatically match a version with a country code — this is a known,
intentional limitation (guessing a missing country code would risk
false-positive duplicate matches) and is not enforced as a stored
column, only used transiently for import matching.

### Coach

`coaches`: `id`, `profile_id` (nullable), `coach_code`, `full_name`,
`email`, `phone`, `whatsapp`, `bio`, `specializations` (`text[]`),
`status`, `joined_on`, `created_at`, `updated_at`. `status`: `ACTIVE |
INACTIVE | ARCHIVED`. No FIDE titles, ratings, certifications, or years
of experience are invented anywhere — `specializations` is free-text
labels the admin enters (comma-separated in the form, split server-side
into an array), not a fixed taxonomy.

### Parent-Student Relationship

`student_parents` (composite primary key `student_id, parent_id`):
`relationship` (`MOTHER | FATHER | GUARDIAN | OTHER`), `is_primary`,
`can_receive_updates`, `can_manage_student`, `created_at`. This is a
genuine many-to-many table — a student can have multiple linked
parents/guardians, and a parent can be linked to multiple students.
`relationship` is always admin-selected, never inferred from a name or
gender field, and the schema does not assume exactly one mother plus
one father. Linking uses `link_parent_to_student_with_audit()` (an
upsert via `ON CONFLICT (student_id, parent_id) DO UPDATE`, so
re-linking the same pair updates the relationship/flags rather than
erroring or duplicating). Unlinking is a hard delete of the join row
(not a status flag) — the relationship itself has no independent
lifecycle worth preserving once removed, unlike a business record.

## Code Generation

`student_code` (format `PCA-<year>-<5-digit-sequence>`, e.g.
`PCA-2026-00042`) and `coach_code` (format `PCA-C-<4-digit-sequence>`,
e.g. `PCA-C-0007`) are generated by PostgreSQL sequences
(`student_code_seq`, `coach_code_seq`) wired up as column `DEFAULT`
expressions calling `generate_student_code()` /
`generate_coach_code()` (`supabase/migrations/0012_admin_operations_schema.sql`).
`nextval()` on a sequence is atomic under concurrent transactions, so
two simultaneous inserts can never receive the same code — this is why
codes are never computed client-side or via `count(*) + 1` (which is
not concurrency-safe). The sequence is a single global monotonic
counter (not reset per year); the year embedded in a student code is
just the creation year for readability, not a separate per-year
counter. **These formats are new-system identifiers.** No claim is made
that any pre-existing, offline Phoenix student/coach numbering (if one
exists) follows this pattern — a bulk import does not attempt to
preserve or infer a legacy code, it always gets a fresh DB-generated
one.

`batch_code` is different: it is admin-entered on the create form, not
DB-generated. Batches are created far less frequently than students,
and the academy may want a code that reflects its own naming
convention (e.g. tied to program/location/time) rather than a bare
sequence.

## Batch Architecture

`batches`: `id`, `batch_code`, `name`, `program_id` (FK to `programs`),
`location_id` (nullable FK to `academy_locations`), `training_mode`
(`ONLINE | OFFLINE | HYBRID`), `level` (free text, nullable),
`primary_coach_id` (nullable FK to `coaches`), `capacity` (nullable),
`status`, `start_date`/`end_date` (nullable), `created_at`,
`updated_at`. `status`: `DRAFT | ACTIVE | PAUSED | COMPLETED |
ARCHIVED` — again, no hard delete as a normal workflow; archiving is a
status change. No batches are seeded — every batch in the system was
created through this admin UI by an operator, never fabricated
("Beginner Batch A", "Weekend Champions", etc. do not exist as seed
data).

### Batch-Coach Relationship

A batch does not assume a single permanent coach forever — Phoenix
already has a `primary_coach_id` convenience field on `batches` for the
common case, but the authoritative, historized relationship lives in
`batch_coaches`: `id`, `batch_id`, `coach_id`, `role` (`PRIMARY |
ASSISTANT | GUEST`), `assigned_at`, `ended_at` (nullable). A partial
unique index on `(batch_id, coach_id, role) WHERE ended_at IS NULL`
prevents the same coach from being assigned twice in the same active
role on the same batch, while still allowing full assignment history
(a coach can be unassigned — `ended_at` set — and reassigned later, and
the old row is preserved as history rather than deleted).
Coach-scoped permissions (e.g. "a coach can only manage their own
assigned batch's students") are explicitly deferred — see "Deferred to
Future Phases" below.

### Academy Locations & Programs

`academy_locations` (Phase 7) is reused as-is — Phase 10 does not
create a competing branches table. The only confirmed, seeded location
is Madipakkam, Chennai; no international branches are seeded.

`programs` (Phase 7, previously empty) is seeded in
`supabase/migrations/0015_admin_indexes.sql` with the six existing
authoritative program slugs/names/descriptions from
`src/content/programs.ts` (`beginner-chess`, `intermediate-chess`,
`advanced-chess`, `professional-training`, `tournament-preparation`,
`online-chess-coaching`), inserted idempotently
(`ON CONFLICT (slug) DO NOTHING`). **The public marketing site is not
migrated to Supabase this phase** — `src/content/programs.ts` remains
the sole source of truth for public program pages, hero copy, SEO, etc.
This DB row exists solely so admin batches and enrollments have a
stable `program_id` foreign key to point at. If a program's public name
or description changes in the future, update `programs.ts` for the
public site, and add a **new** migration to update the DB row to match
— never hand-edit `0015` after it has been applied, and never let the
two drift silently (a future phase should consider a lint/test that
diffs the two lists).

## Class Schedules vs. Class Sessions

`class_schedules` are **recurring definitions** — "this batch meets
every Tuesday 16:00-17:00 IST" — not a record of what actually
happened on a given date. Fields: `id`, `batch_id`, `day_of_week`
(typed weekday enum, not a string), `start_time`/`end_time` (real
`time` columns, not one text field), `timezone` (defaults to
`Asia/Kolkata`, documented as the academy's confirmed operating
timezone, not a guess), `effective_from`/`effective_until` (nullable
dates), `active`, `created_at`, `updated_at`. A check constraint
enforces `end_time > start_time`; another enforces `effective_until >=
effective_from` when both are present.

A future `class_sessions` table (not built this phase) would represent
the dated, concrete occurrences of a schedule — "the Tuesday 2026-07-14
16:00 session of Batch X" — and attendance would attach to a session
row, never to a `class_schedules` row directly (attendance for a
specific date shouldn't retroactively change if the recurring schedule
is edited later). Building `class_sessions` and attendance is
explicitly deferred to a future phase.

## Program Enrollment vs. Batch Membership

Two distinct concepts, kept in two distinct tables on purpose:

- `student_program_enrollments`: "this student is enrolled in this
  program" — `id`, `student_id`, `program_id`, `batch_id` (nullable —
  a student can be enrolled in a program before being assigned to a
  specific batch), `status` (`ACTIVE | PAUSED | COMPLETED | WITHDRAWN |
  CANCELLED` — **not** a payment/billing status; there are no fee or
  payment columns here), `enrolled_on`, `completed_on` (nullable),
  `notes`, `created_at`, `updated_at`.
- `batch_enrollments`: "this student is currently assigned to this
  batch" — `id`, `student_id`, `batch_id`, `assigned_at`, `ended_at`
  (nullable), `status` (`ACTIVE | ENDED | TRANSFERRED`) — a full
  assignment history, not just a current pointer. A partial unique
  index on `(student_id, batch_id) WHERE status = 'ACTIVE'` prevents
  two simultaneous active assignments of the same student to the same
  batch, but **does not** prevent a student from being actively
  assigned to two different batches at once — whether "one batch at a
  time" should be a hard rule was not confirmed by the academy, so it
  is not enforced; this is an open business-rule question, flagged
  here rather than guessed at.

Program enrollment and batch membership are kept separate rather than
collapsed into one table because a student can be enrolled in a
program without yet having a batch (enrollment happens first,
scheduling second), and because a student's batch can change over time
independently of their program enrollment status.

## Admin CRUD & Forms

Every entity (students, parents, coaches, batches, schedules,
enrollments, accounts) supports list, view, create, edit, and
archive/deactivate — never a hard delete as the normal workflow.
Individual record routes (`/admin/students/[id]` etc.) validate the URL
segment is a real UUID (`src/lib/admin/uuid.ts`) before querying; an
invalid ID renders Next.js's `notFound()` (a real 404), never a raw
database error.

Forms use Zod schemas in `src/lib/validation/admin/*.ts`, shared
between the client form component (for immediate UX feedback) and the
Server Action (the actual security boundary — client validation can
always be bypassed, so every action re-parses with the same schema).
Controlled fields are never accepted from the browser payload:
`student_code`/`coach_code` (DB-generated via `DEFAULT`), `status` on
create (defaults server/DB-side), `profile_id`, `created_at`,
`updated_at` — none of these appear as writable fields in any create/
update schema.

## Search & Pagination at Scale

With 5,000+ students, no list page ever fetches an unbounded result
set. `src/lib/admin/pagination.ts` centralizes: `DEFAULT_PAGE_SIZE =
25`, `ALLOWED_PAGE_SIZES = [25, 50]`, `parsePaginationParams()` (falls
back safely on an invalid `?page=`/`?pageSize=` rather than trusting
it), `toRange()` (converts to Supabase's `.range(from, to)`),
`sanitizeSearchQuery()` (trims, caps at 100 characters, treats an
effectively-empty query as no filter), and `resolveSortColumn()` (an
explicit allow-list — a requested `?sort=` value that isn't in the
allow-list falls back to a safe default column; an admin list never
lets an arbitrary string become a raw SQL `ORDER BY` column).

Search terms are passed through Supabase's `.ilike()`/`.or()` query
builder, which parameterizes the query — there is no raw SQL string
interpolation anywhere in the admin query layer. Every list page's
filters (search text, status, page, page size) travel as URL query
parameters so pages are shareable/bookmarkable and support the
browser's back button correctly; the known tradeoff is that a search
term is visible in the URL (and therefore in browser history/server
logs) — this is acceptable for name/code/email search terms but is a
documented reason DOB, full address, guardian phone, and notes are
never put in a URL anywhere in the admin UI.

List views intentionally show a narrow column set (e.g. students:
code, name, level, status, joined date — not DOB, full address,
guardian phone, or notes) — that detail lives only on the record's
detail page, which runs a separate, wider `select("*")` query scoped to
one row.

## Account Provisioning

`/admin/accounts` and `src/lib/actions/admin/accounts.ts` are the only
place a portal account (an `auth.users` row + a `profiles` row) gets
created from a business record. Creating a student/parent/coach
business record, or creating an enrollment, **never** automatically
provisions an account — provisioning is always a separate, explicit
admin action, gated by `MANAGE_ACCOUNTS`.

Role is derived from the business record type, never chosen freely by
the admin: a student's invited account always gets `role: 'STUDENT'`,
a parent's `role: 'PARENT'`, a coach's `role: 'COACH'`. There is no
control anywhere in this flow that lets an admin pick `SUPER_ADMIN` (or
even `STAFF`/`ADMIN`) for a normal student/parent/coach provisioning
action.

### Auth/Profile/Business-Record Linking & Failure Handling

Provisioning touches three things that cannot be wrapped in one native
database transaction: the Supabase Auth Admin API (`auth.users`, a
separate system from Postgres proper), the `profiles` table, and the
business record's `profile_id` column. `provisionAccount()` (the shared
implementation backing `provisionStudentAccount`/
`provisionParentAccount`/`provisionCoachAccount`) proceeds in explicit,
checked steps:

1. Re-fetch the business record server-side (never trust a client-sent
   snapshot); refuse if it already has a `profile_id` (`CONFLICT`) or
   has no email on file (invitations require an email).
2. Call `supabase.auth.admin.inviteUserByEmail()` via the service-role
   client. If this fails or returns no user, **stop** — return a safe
   message telling the admin to check the Supabase Auth dashboard
   before retrying, rather than attempting an automatic retry. An
   automatic retry against "email already has an account" is
   explicitly avoided because it could silently attach the wrong
   business record to an existing auth user.
3. Insert the `profiles` row using the returned auth user id. If this
   fails, an auth user now exists with no usable Phoenix profile — this
   is reported as `success: false` with a distinct message ("invitation
   sent, but linking the profile failed — contact support, don't
   re-invite"), not as success, and the event is logged distinctly
   (`logAdminEvent`) so it's discoverable for manual reconciliation.
4. Update the business record's `profile_id`. If this fails, same
   treatment — reported as a distinct failure, never silently
   swallowed, and the fix is a manual reconciliation (linking the
   already-created `profiles` row to the business record by hand),
   never an automatic second invite.

Only after all three steps succeed is `ACCOUNT_INVITED` written to the
audit log and `success: true` returned. Nothing in the frontend ever
displays "Invitation sent" or "Account created" unless every step
above actually completed — this matters especially when Supabase is
unconfigured (`isAdminSupabaseConfigured()` returns false up front,
short-circuiting the whole flow with a safe `DATABASE_UNAVAILABLE`
message rather than fabricating success).

### Deactivate / Reactivate

`deactivateAccount()`/`reactivateAccount()` flip `profiles.active` — a
Phoenix profile can be turned off without deleting the auth user or the
business record. This is deliberately a much smaller, safer operation
than provisioning (no Auth Admin API call, no multi-step reconciliation
needed) since it only touches one row.

## Privileged Role Management

Normal provisioning (student/parent/coach invite) never exposes a role
picker at all — role is always derived, never chosen. Separately,
`changeStaffRole()` lets a **SUPER_ADMIN only** (gated on the
`MANAGE_ROLES` permission, which no other role has) change an existing
profile between `STAFF` and `ADMIN`. Two safeguards keep this narrow:

- `changeStaffRoleSchema` only accepts `"STAFF" | "ADMIN"` as the
  target role — `SUPER_ADMIN` is not a selectable value anywhere in
  this schema or in the `/admin/accounts` UI.
- The action re-fetches the target profile's **current** role and
  refuses to proceed unless it is already `STAFF` or `ADMIN` — so this
  action can never be used to promote a STUDENT/PARENT/COACH profile
  into staff, and can never touch the existing SUPER_ADMIN row.

Phase 10 does not build any UI path to create a second SUPER_ADMIN.
The first (and, as of this phase, only) SUPER_ADMIN remains Phase 9's
manual SQL bootstrap. This is a deliberate, conservative choice — the
spec allowed deferring it, and doing so avoids a much larger set of
"who can create a super-admin, and how do we stop that from being
abused" design questions that haven't been decided yet.

## Bulk Student Import

`/admin/students/import` (`src/components/admin/students/ImportWizard.tsx`,
`src/lib/actions/admin/import.ts`) is a two-step, explicit-confirmation
flow, not a Google Sheets sync and not an auto-import-on-select:

1. **Preview** (`previewStudentImport`): parses the uploaded CSV
   server-side with a small, dependency-free RFC4180-subset parser
   (`src/lib/admin/csv.ts` — chosen over pulling in a new CSV library
   mid-phase, since the accepted format is a fixed, narrow header
   allow-list), validates the header row against
   `IMPORT_ALLOWED_HEADERS` (rejecting any unrecognized column
   outright) and `IMPORT_REQUIRED_HEADERS`, enforces a row cap
   (`MAX_IMPORT_ROWS = 500` per import — a 5,000-student rollout is
   ~10 controlled imports, not one giant file) and a file size cap
   (`MAX_IMPORT_FILE_SIZE_BYTES = 2 MB`), Zod-validates every row, and
   runs duplicate detection. **Nothing is inserted at this step.**
2. **Confirm** (`confirmStudentImport`): takes only the rows the admin
   has reviewed, re-validates and re-checks duplicates server-side
   (never trusts the client's copy of the preview, since time may have
   passed), and inserts in controlled chunks of `IMPORT_INSERT_CHUNK_SIZE
   = 50` rows. `student_code` is never taken from the CSV as the new
   record's code — it is always DB-generated; a `student_code` column
   in the CSV is used only for duplicate detection (see below). A
   single `BULK_IMPORT_COMPLETED` audit event is written per import
   (not one per row — that would be thousands of audit rows for one
   file), with only aggregate counts as metadata.

No accounts are created and no invitations are sent as a side effect of
import — business records are created first; provisioning is always a
later, separate, explicit action.

### CSV Safety

Only `.csv` files are accepted (extension + MIME check); no
`.xlsm`/macro-bearing formats are supported, and the parser never
evaluates a cell's contents as a formula (it only ever produces plain
strings). **Formula injection** (a cell value starting with `=`, `+`,
`-`, or `@`, which some spreadsheet programs interpret as a formula
when a CSV is later re-opened) is not a risk at *import* time — Postgres
storage doesn't interpret anything — but would be a risk if this data
is ever *exported* back to CSV and opened in Excel/Sheets. Phase 10 has
no export feature yet, so `neutralizeForExport()`
(`src/lib/admin/csv.ts`) is written but intentionally unused — it
prefixes a risky value with a leading apostrophe, skipping phone/
WhatsApp-shaped fields (a leading `+` there is a real country code, not
a formula) — ready for whoever builds export in a future phase.

### Duplicate Matching Hierarchy

`src/lib/admin/importMatching.ts` implements a strict hierarchy, run as
a handful of batched `.in()` queries against the whole file's candidate
values (not one query per row):

1. `student_code`, if supplied and it matches an existing student.
2. `fide_id`, if supplied and it matches an existing student.
3. normalized email + date of birth.
4. normalized phone + date of birth.
5. anything else is **not** flagged as a duplicate and is left for the
   admin to review in the preview table — there is no automatic merge
   by name similarity alone, which is explicitly called out as unsafe
   (common names collide; this system never guesses).

## Audit Logging

`admin_audit_log`: `id`, `actor_profile_id`, `actor_role`, `action`
(a 25-value typed enum — see `AdminAuditAction` in
`src/lib/supabase/types.ts`), `entity_type` (a 10-value check
constraint: `student | parent | coach | batch | schedule | enrollment |
batch_enrollment | account | role | import`), `entity_id`, `summary`
(a short human-readable line), `metadata` (jsonb, small and structured —
e.g. `{status_to: "ACTIVE"}`, never a full before/after row dump, never
a password or token, never a large PII blob). `/admin/audit-log`
(gated on `VIEW_AUDIT_LOG`) shows timestamp, actor role, action, entity
type, and summary — never raw metadata JSON by default — with
server-side pagination and filters for action, entity type, and date
range.

**Two audit-write strategies exist, and the boundary between them is
deliberate:**

- The four composite creates (`create_student_with_audit`,
  `link_parent_to_student_with_audit`, `create_batch_with_audit`,
  `create_enrollment_with_audit`) write their audit row inside the same
  Postgres function/transaction as the business insert — genuinely
  atomic; the audit event cannot exist without the business row, or
  vice versa.
- Every other mutation (updates, status changes, unlink, schedule
  create, batch-coach assign/unassign) calls
  `recordAdminAudit()` (`src/lib/admin/audit.ts`) as a **separate**
  statement after the business mutation has already committed. This is
  a documented, accepted tradeoff: if the audit RPC call itself fails
  (e.g. a transient network blip), the business mutation is *not*
  rolled back — only the audit write is lost, and it's logged
  (`console.error("[admin-audit-write-failed]", ...)`) so it's at least
  discoverable server-side. The audit log is treated as an operational
  record, not the source of truth for business data, so this asymmetry
  was accepted rather than wrapping every single-table update in its
  own bespoke atomic RPC.

Browser clients cannot insert an audit row directly — there is no
public insert policy on `admin_audit_log`, and every audit-writing
function (`record_admin_audit`, and the four composite RPCs) has
`EXECUTE` explicitly revoked from `PUBLIC` and granted only to
`service_role` (see "Service-Role Security Boundary" below).

## Service-Role Security Boundary

All Phase 10 admin data access goes through
`src/lib/supabase/admin.ts`'s `getAdminSupabaseClient()` — a
service-role client, guarded by `import "server-only"` so a Client
Component can never import it (a build-time enforcement, not just a
convention). **The service-role key bypasses Row Level Security
entirely.** This means RLS is *not* the enforcement mechanism for
Phase 10's admin operations — `requirePermission()` in the application
layer is. This is worth stating plainly because it's easy to
mistakenly treat RLS as "the" security layer: here, RLS is a backstop
for defense-in-depth, not the primary gate.

A second, independent security detail specific to the four composite
RPC functions: **PostgreSQL grants `EXECUTE` on a newly created function
to `PUBLIC` by default** (unlike tables, which have no default grants).
Combined with these functions being `SECURITY DEFINER` (they run as the
function owner and therefore bypass RLS), leaving the default grant in
place would mean *any* authenticated user — including a STUDENT — could
call `create_student_with_audit` directly via the Supabase client
library, completely bypassing `requirePermission()`. Every function in
`supabase/migrations/0014_admin_audit_and_functions.sql` therefore has
an explicit `revoke all on function ... from public;` followed by
`grant execute on function ... to service_role;`. This is the direct
contrast to Phase 7's public-facing submission RPCs
(`supabase/migrations/0009_submission_functions.sql`), which are
intentionally granted to `anon, authenticated` because they exist
specifically for anonymous website visitors to call.

## RLS Strategy

Every Phase 10 table has Row Level Security enabled
(`supabase/migrations/0012_admin_operations_schema.sql`), but
`supabase/migrations/0013_admin_operations_rls.sql` deliberately adds
**zero policies** — a deny-by-default posture, identical to Phase 7's
treatment of `contact_enquiries`/`reporting_outbox`. Given that all
admin access is via the service-role client (which bypasses RLS
regardless of policies), adding STAFF/ADMIN/SUPER_ADMIN-scoped
policies here would be dead code that creates a false sense of
protection — the real gate is `requirePermission()`. RLS is retained
(enabled, zero policies) purely as a backstop: if some future code path
ever queries these tables with the anon or authenticated key instead of
the service-role key, it gets nothing, rather than accidentally
succeeding.

### Deferred Future Portal Policies

Student/parent/coach *portal* features (a student viewing their own
record, a parent viewing their linked students, a coach viewing their
assigned batch's students) do not exist yet, and Phase 10 does **not**
preemptively build the RLS policies for them (e.g. `students.profile_id
= auth.uid()`, a `student_parents` join for parent access, a
`batch_coaches`/`batch_enrollments` join for coach access). Building
those policies now, before the actual portal query patterns exist,
risks guessing wrong and having to unwind incorrect policies later.
This is intentionally left for the phase that builds those portal
features.

## Admin Query/Action Architecture

Query modules (`src/lib/queries/admin/*.ts`, read-only, `server-only`)
are kept separate from mutation actions (`src/lib/actions/admin/*.ts`,
`"use server"`). Every query module function returns
`AdminQueryResult<T>` — a discriminated union of `{ok: true, data: T}`
or `{ok: false, code: "DATABASE_UNAVAILABLE" | "UNKNOWN"}`
(`src/lib/admin/queryResult.ts`) — so every page can honestly
distinguish "zero rows" from "the database is unreachable" instead of
rendering an empty table in both cases. Server Actions return
`AdminActionResult<T>` (`src/lib/admin/errors.ts`) with a `success`
flag and a pre-written safe message — never a raw Postgres error
string, Supabase service error, Auth Admin API error, SQL function
name, or constraint name. `getSafeAdminMessage()` maps a small, fixed
set of error codes (`AUTHORIZATION_DENIED`, `DATABASE_UNAVAILABLE`,
`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`,
`ACCOUNT_PROVISIONING_FAILED`, `IMPORT_VALIDATION_FAILED`, `UNKNOWN`) to
plain-language text; `logAdminEvent()` writes the real code/area
server-side for debugging without ever sending that detail to the
browser.

Client Component "islands" that need search-as-you-type or reference
data (student/parent/coach/batch pickers, program/location dropdowns)
never import a query module directly — they call thin
`"use server"` wrappers in `src/lib/actions/admin/search.ts`, each of
which still calls the matching `requirePermission()` check before
delegating to the query module. This keeps every server-only
import boundary intact while still letting Client Components fetch
data on demand.

## Database Type Strategy

`src/lib/supabase/types.ts` is a hand-written, narrow TypeScript
mirror of the Phase 10 schema (row interfaces, enum unions, and the
`Database` type's `Tables`/`Functions` shape for the tables/RPCs this
phase actually touches) — not a full, mechanically-generated
`Database` type covering every table in the project, and not a
pretense that it was generated. The project does not currently run
`npx supabase gen types typescript --project-id <id> --schema public >
src/lib/supabase/types.ts` in this sandbox (no live Supabase project
is provisioned here); when one is, that command should be run and its
output should replace/merge with the hand-written types, at which point
this note can be removed. Until then, keeping the hand types narrow
(only the columns/functions actually queried) is preferred over
maintaining a large, easily-stale fake "complete" schema.

## Accessibility

The admin shell supports full keyboard navigation, visible focus rings
(`focus-visible:outline`) on every interactive control, and a "Skip to
content" link. The mobile drawer (`AdminMobileNav`) moves focus to its
first link on open, restores focus to the trigger button on close,
closes on Escape, and is marked up as `role="dialog"
aria-modal="true"`. Nav links use `aria-current="page"` for the active
route. Forms use real `<label htmlFor>` elements (`FormField`), and
validation errors render with `role="alert"`. Tables use semantic
`<th scope="col">` headers. Status is always shown as a labeled badge
(`StatusBadge`) — text plus a border color, never a bare color dot —
so status is never communicated by color alone.

## Performance at Scale

Every list page is a Server Component performing server-side
pagination/filtering/search (never fetching all rows and filtering in
the browser). Client Components exist only where real interaction is
needed (forms, search-as-you-type pickers, toggle buttons) — there is
no global client-side state store (no Redux/Zustand), and list pages
select only the columns they display, with a separate, wider query for
detail pages.

## Scale Decisions & Known Open Questions

- **Batch membership "one active batch at a time"**: not enforced —
  flagged as an open business-rule question for the academy (see
  "Program Enrollment vs. Batch Membership" above).
- **Coach-scoped permissions** (a coach's own portal seeing only their
  assigned batch's students): deferred, not built — see "Batch-Coach
  Relationship" above.
- **A second SUPER_ADMIN via UI**: deferred — see "Privileged Role
  Management" above.
- **CSV export / formula-injection neutralization on export**: the
  mitigation function exists (`neutralizeForExport()`) but is unused,
  since there is no export feature yet.
- **Program/DB sync drift**: manual today (a new migration whenever
  `src/content/programs.ts` changes); no automated diff/test exists yet
  to catch drift between the two.

## Phase 17 — Certificates + Achievements

`/admin/certificates*` and `/admin/achievements*` were added in Phase 17,
gated on new `VIEW_CERTIFICATES`/`MANAGE_CERTIFICATES`/`VIEW_ACHIEVEMENTS`/
`MANAGE_ACHIEVEMENTS` permissions (`ADMIN`/`SUPER_ADMIN` only — deliberately
excluded from `STAFF_PERMISSIONS`). Unlike every other admin entity in
this document, certificate and achievement mutations do **not** go through
the service-role client (`getAdminSupabaseClient()`) — they call
`create_`/`update_`/`issue_`/`revoke_student_certificate` and
`create_`/`update_`/`publish_`/`archive_student_achievement` through the
normal per-request session client, because those RPCs independently
resolve `auth.uid()` and verify ADMIN via a new `current_admin_profile_id()`
helper. `requirePermission()` remains the first-layer, route/action-level
gate exactly as everywhere else in this document — the RPC's own check is
additional defense-in-depth, not a replacement. Student search for the
certificate/achievement "new record" forms uses a dedicated narrow RPC
(`search_students_for_admin_record()`, capped at 20 results, no contact
PII) rather than the existing `searchStudentsForSelect()` used by
Enrollments/etc. — see `docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md`,
"Admin Student Search Architecture" for why a separate RPC was introduced
instead of reusing the service-role search. Full schema, lifecycle, and
security details live in that document, not duplicated here.
