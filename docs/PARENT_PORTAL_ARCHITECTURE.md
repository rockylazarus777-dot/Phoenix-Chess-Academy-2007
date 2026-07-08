# Parent Portal Architecture

Phase 12 built the parent-facing portal at `/parent` on top of the
Phase 9 auth foundation, the Phase 10 operational database, and the
security patterns established by the Phase 11 student portal. This
document covers the security model, data flow, and privacy decisions
specific to the parent portal. See `docs/AUTH_ARCHITECTURE.md` for
login/session/role fundamentals, `docs/ADMIN_OPERATIONS_ARCHITECTURE.md`
for the operational schema, and `docs/STUDENT_PORTAL_ARCHITECTURE.md`
for the sibling student-facing system this one deliberately parallels
without importing from.

## Parent Portal routes

Phase 12 built seven routes under `/parent`; Phase 14 added an eighth,
`/parent/students/[studentId]/attendance`; Phase 15 added a ninth,
`/parent/students/[studentId]/progress`; Phase 16 added two more,
`/parent/students/[studentId]/assignments` and
`/parent/students/[studentId]/assignments/[assignmentId]` (see
`docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`,
`docs/STUDENT_PROGRESS_ARCHITECTURE.md`, and
`docs/ASSIGNMENTS_ARCHITECTURE.md` for the full architecture):

- `/parent` — dashboard
- `/parent/profile` — read-only profile
- `/parent/students` — My Students (every linked student)
- `/parent/students/[studentId]` — one linked student's overview
- `/parent/students/[studentId]/programs`
- `/parent/students/[studentId]/batches`
- `/parent/students/[studentId]/schedule`
- `/parent/students/[studentId]/attendance` — **(Phase 14)** that student's attendance history
- `/parent/students/[studentId]/progress` — **(Phase 15)** that student's published progress evaluations
- `/parent/students/[studentId]/assignments` — **(Phase 16)** that student's assignments (read-only)
- `/parent/students/[studentId]/assignments/[assignmentId]` — **(Phase 16)** assignment detail + submission/feedback (read-only)

No other `/parent/*` route exists. There is no certificates, payments,
messaging, or tournament-portal route, and none of those appear as
disabled/"coming soon" nav items.

## Authentication boundary

`src/app/parent/layout.tsx` calls `getCurrentParent()`, which calls
`requireRole(["PARENT"])` as its first step (see
`src/lib/auth/requireRole.ts`) — the exact same Phase 9 redirect
contract used by every other protected segment: no session → `/login`;
no profile row → `/login?error=PROFILE_MISSING`; inactive profile →
`/login?error=ACCOUNT_UNAVAILABLE`; wrong role → that role's own home.
There are no Server Actions or Route Handlers under `/parent` in Phase
12 (confirmed: no `"use server"` file exists anywhere in
`src/app/parent`, `src/lib/parent`, or `src/lib/queries/parent` — the
portal is entirely read-only), so there is nothing beyond the layout
that independently needs its own authorization check this phase.

## Parent identity resolution

`src/lib/parent/getCurrentParent.ts` is the sole resolver, structured
identically to (but independent of) `src/lib/portal/getCurrentStudent.ts`:

1. `requireRole(["PARENT"])` → `AuthProfile`.
2. Query `parents where profile_id = <authenticated profile id>`, using
   the authenticated (anon-key, RLS-enforced) Supabase server client —
   never the service-role client.
3. Return a discriminated `ParentIdentityResult`: `OK` (profile + narrow
   `ParentPortalIdentity` + computed access level), `DATABASE_UNAVAILABLE`,
   `NOT_LINKED`, or `UNKNOWN`.

No code path accepts a parent ID from the browser (query string, form
field, cookie). `getCurrentParent()` is the only place a parent ID
enters a request, and every downstream query function receives it as a
plain argument from server code. `getCurrentParent()` is wrapped in
React's `cache()` for per-request (not global) memoization — the same
safe pattern documented for `getCurrentStudent()`.

## Profile-to-parent link architecture

`parents.profile_id` is a nullable FK to `profiles.id`. A parent's
authenticated identity flows `auth.uid() → profiles.id →
parents.profile_id` — the only chain used anywhere in Phase 12. Email
and phone are never used as a lookup fallback.

## Missing parent link behavior

If no `parents` row has a matching `profile_id`, every page renders
`ParentPortalState code="PARENT_NOT_LINKED"`:

> "Your Phoenix parent account is signed in, but the parent record is
> not currently linked. Please contact Phoenix Chess Academy for
> assistance."

followed by `siteConfig.contact.email`/`phone`. This never mentions the
`parents` table, `profile_id`, a UUID, or provisioning details, and
never falls back to matching by email or phone.

## Parent status access matrix

`src/lib/parent/access.ts` centralizes status → access level.
`public.parent_status` (0012_admin_operations_schema.sql) has only
three values — there is no ON_HOLD/ALUMNI-equivalent for parents the
way there is for students:

| `parent_status` | Access level |
| --- | --- |
| `ACTIVE` | `FULL` |
| `INACTIVE` | `DENIED` |
| `ARCHIVED` | `DENIED` |

The three-way `ParentPortalAccessLevel` type is kept (matching the
student portal's shape) even though `READ_ONLY` is currently unreachable
— this is not an invented status value, just an unused branch of an
already-generic result type, so a future parent status addition
wouldn't force every caller to change its type.

## Parent Portal identity type

`ParentPortalIdentity`: `id, fullName, email, phone, whatsapp, status`.
Excludes `notes`, `profile_id`, `created_at`/`updated_at`, and
country/state/city (those live on the profile page only).

## Parent-to-student authorization

`src/lib/parent/authorization.ts` exports `getLinkedStudent(parentId,
studentId)` — the one authoritative check for every
`/parent/students/[studentId]*` route. It does not query `students`
first and then decide whether to show it: the query IS the join
against `student_parents` (`.eq("parent_id", parentId).eq("student_id",
studentId)` with `students!inner(...)`) — there is no code path where a
student row is fetched before the relationship is confirmed. `parentId`
comes only from `getCurrentParent()`; `studentId` is a route parameter
treated purely as a resource identifier, validated as a UUID and then
checked against the relationship, never trusted as authorization by
itself. Every one of the four dynamic pages calls this independently —
none relies on "the dashboard already linked here correctly."

## Student route identifier decision

`studentId` appears in the URL only as a resource identifier, exactly
as the spec requires. Invalid UUID, a UUID with no matching student,
and a real-but-unlinked student's UUID all return the same `NOT_FOUND`
reason from `getLinkedStudent()`, and every page responds identically:
`notFound()` (Next.js's standard 404). A parent who manually edits the
URL to another family's student UUID gets an ordinary 404 — indistinguishable
from a typo — never a message that confirms or denies whether that
student exists or is linked to someone else.

## Student enumeration protection

This is the same decision as above, stated as its own section since the
spec calls it out explicitly: the only two possible outcomes for a
`[studentId]` route are (a) real content, once `getLinkedStudent`
succeeds, or (b) a plain 404 via `notFound()`. There is no
"access denied for student {name}" message and no code path that
reveals a student's name, code, or status before authorization
succeeds. `DATABASE_UNAVAILABLE` is handled separately (an honest
"portal unavailable" state, not a 404) so a real outage is never
disguised as "that student doesn't exist."

## Linked student privacy boundary

`ParentLinkedStudent` (`src/lib/parent/authorization.ts`): `id,
studentCode, fullName, currentLevel, status, joinedOn, fideId,
fideRating, relationship, isPrimary`. This is deliberately NOT
`StudentPortalIdentity` (which includes the student's own email/phone —
a different privacy boundary entirely) and never a full `students` row.
No internal notes, full address, student personal email/phone/WhatsApp,
DOB, or chess association ID are included — being linked to a student
does not mean every field on that student's record should be exposed to
a parent.

## Parent linked student type

See "Linked Student Privacy Boundary" above — `ParentLinkedStudent` is
the one type used everywhere a linked student's identity needs to be
displayed inside the parent portal.

## Linked student programs

`src/lib/queries/parent/programs.ts` → `listParentStudentPrograms(studentId)`
queries `student_program_enrollments` for that one (already-authorized)
student, joined with `programs(slug, name)` and `batches(name)`. Shows
program name, status, enrolled/completed dates, batch summary. No fee,
payment status, attendance, or completion-percentage field exists to
show.

## Program database/public content linking

Identical defensive behavior to the student portal: each DB program's
slug is validated against `getProgramBySlug()` before rendering a
link; an unmatched slug renders as plain text, never a broken link.

## Program empty state

An empty `student_program_enrollments` list renders `ParentPortalState
code="NO_PROGRAMS"` ("No program enrollment is currently linked to this
student record.") plus a separate "Explore Phoenix Programs" link to
the public `/programs` listing — visually and textually distinct from
"this student's enrolled programs."

## Linked student batches

`src/lib/queries/parent/batches.ts` → `listParentStudentBatches(studentId)`
mirrors the student portal's batch query exactly in shape (batch name,
code, program, mode, level, location, assignment status, assigned/ended
dates, coach names), scoped to one already-authorized student.
Capacity, other students, student count, internal notes, and coach
contact fields are never selected.

## Current/historical batch display

Same `{ current, historical }` split as the student portal, using
`assignmentStatus === "ACTIVE"`. Supports multiple simultaneous current
batches — no invented one-batch rule. `/parent/students/[studentId]/batches`
renders "Current Batches" always and "Previous Batches" only when
non-empty.

## Parent coach display privacy

`get_student_batch_coaches()` (Phase 11) resolves coaches for
`current_student_id()` — it cannot be reused for a parent, since a
parent isn't a student and has no `current_student_id()`. Phase 12
adds an independent, parameterized RPC:
`get_parent_linked_student_batch_coaches(target_student_id uuid)`
(`supabase/migrations/0017_parent_portal_rls.sql`). It takes the target
student explicitly (a parent may have more than one linked student,
unlike a student who only ever needs their own), but authorization is
enforced *inside* the function body via `parent_has_student()`, not by
trusting the caller — an unauthorized `target_student_id` simply
returns zero rows, indistinguishable from an authorized student with no
assigned coach yet. Returns only `batch_id, coach_id, full_name, role`,
never email/phone/whatsapp/bio/specializations. `coaches` itself has no
parent-facing SELECT policy at all.

## Linked student class schedule

`src/lib/queries/parent/schedule.ts` → `getParentStudentSchedule(studentId)`
mirrors the student portal's schedule query exactly: collects batch IDs
via both `batch_enrollments` and `student_program_enrollments.batch_id`
for the one authorized student, queries `class_schedules` where
`active = true`. Recurring weekly definitions only — no calendar
library, no dated events, no "Join Class" button (confirmed: no
FullCalendar dependency, no Zoom/Meet references anywhere in the parent
query or page code).

## Schedule sorting

Reuses `WEEKDAY_ORDER` and `WEEKDAY_LABELS` from
`src/lib/portal/weekday.ts` directly — this file is a generic
`public.weekday` enum display map with no student-specific logic in it,
so importing it from the parent portal does not cross the student/
parent decoupling boundary the way importing `StudentQueryResult` or
`StudentPortalIdentity` would. Rows sort by `WEEKDAY_ORDER.indexOf(...)`
then `start_time.localeCompare()`, never alphabetically.

## Timezone display

Same behavior as the student portal: each linked student's schedule
page computes the distinct set of timezones across its rows — one
timezone shows a single "Times shown in {tz}." note; more than one
shows `(timezone)` per row. No silent conversion to the visitor's
browser timezone.

## Parent query architecture

All parent-scoped reads live in `src/lib/queries/parent/` — `profile.ts`,
`students.ts`, `programs.ts`, `batches.ts`, `schedule.ts`, `dashboard.ts`,
plus `coaches.ts` for the coach RPC wrapper. Every module uses
`getServerSupabaseClient()` (authenticated, RLS-enforcing), never the
service-role client (confirmed via grep — zero references to
`getServiceRoleClient`/`supabase/admin` anywhere in `src/lib/queries/parent`,
`src/lib/parent`, or `src/app/parent`). `studentId` parameters only ever
originate from an already-authorized `getLinkedStudent()` call at the
page level; `parentId` parameters only ever originate from
`getCurrentParent()`.

## Parent query result architecture

`src/lib/parent/queryResult.ts` defines `ParentQueryResult<T>` —
`{ ok: true; data: T } | { ok: false; code: "DATABASE_UNAVAILABLE" |
"UNKNOWN" }` — its own independent type, not imported from
`src/lib/portal/queryResult.ts`'s `StudentQueryResult<T>` or Phase 10's
`AdminQueryResult<T>`. `PARENT_NOT_LINKED`/`ACCOUNT_RESTRICTED` are
resolved once, up front, by `getCurrentParent()`; `STUDENT_NOT_FOUND` is
resolved once, up front, by `getLinkedStudent()` (via `notFound()`) —
neither needs to be a state in every individual query's result type.

## Parent RLS migration

`supabase/migrations/0017_parent_portal_rls.sql` — the first migration
after `0016_student_portal_rls.sql`. Does not edit `0016` or any earlier
migration.

## Parent RLS policies

Seven SELECT-only policies for `authenticated`: `parents_select_own`,
`student_parents_select_own`, `students_select_for_linked_parent`,
`student_program_enrollments_select_for_linked_parent`,
`batch_enrollments_select_for_linked_parent`,
`batches_select_for_linked_parent`,
`class_schedules_select_for_linked_parent`,
`batch_coaches_select_for_linked_parent` (eight, counting both). Postgres
RLS policies on the same table for the same command are OR'd together,
so `students_select_for_linked_parent` sits alongside 0016's
`students_select_own` (STUDENT role) without conflict — a caller sees
the union of whichever policies apply to their role. No policy grants a
PARENT broad SELECT-all on `parents`, `students`, `student_parents`,
`coaches`, `batches`, or any enrollment table, and no INSERT/UPDATE/
DELETE policy exists for PARENT anywhere — Phase 12 is read-only end to
end. `programs`/`academy_locations` need no new policy: Phase 7's
`active = true` policy (reused as-is by Phase 11) is reused as-is here
too.

## auth.uid() parent ownership chain

Verified against the same `getCurrentProfile.ts` fact Phase 11
verified: `profiles.id === auth.uid()`. The parent's own record:
`parents.profile_id = auth.uid()`. The parent's authorization over a
student is a *second*, separate relationship:
`student_parents.parent_id = current_parent_id() AND
student_parents.student_id = <the student in question>`. Neither hop
uses `student_code`, email, or phone.

## Parent RLS helper functions

`current_parent_id()` — SQL, `SECURITY DEFINER`, `STABLE`,
`SET search_path = public`, mirrors 0016's `current_student_id()`
exactly. `parent_has_student(target_student_id uuid)` — same
attributes, returns `true` only if a `student_parents` row links the
current parent to that student; returns `false` (never `true`) for a
non-parent, an unlinked parent, or any student not explicitly linked.
Both `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`. Neither
is a generic bypass — both only ever resolve data tied to the caller's
own `auth.uid()`.

## student_parents security boundary

Every linked-student policy and the `get_parent_linked_student_batch_coaches()`
RPC ultimately reduce to one check: does a `student_parents` row exist
linking this `auth.uid()`-derived parent to this student? Neither
`is_primary` nor `can_manage_student` gates read access — see "Parent
Relationship Flag Decision" below for why. `profiles.role = 'PARENT'`
alone never authorizes access to any specific student; the role only
gets a profile past `requireRole()`, not past `parent_has_student()`.

## Coach privacy RPC decision

Same reasoning as the student portal's "Coach Privacy View/RPC
Decision": a table-level SELECT policy on `coaches` would expose
email/phone/whatsapp/bio to any parent who can see the row via a shared
batch, since RLS is row-level, not column-level. A parameterized RPC
(rather than a view) was chosen for the same auditability reason Phase
11 documented, and because the authorization check
(`parent_has_student(target_student_id)`) needs to run per-call against
an explicit argument, which fits naturally into a function body.

## Location privacy decision

Unchanged from Phase 11's reasoning: `academy_locations` has no field
more sensitive than a name/address, so Phase 7's existing
`active = true` public policy already covers what the portal needs. No
Phase 12 migration touches `academy_locations`.

## Database views created

None. The parameterized RPC above and Phase 7's existing policies cover
every case needed this phase.

## Parent error states

`src/components/portal/parent/ParentPortalState.tsx` — the one
component every parent error/empty state renders through:
`DATABASE_UNAVAILABLE`, `PARENT_NOT_LINKED`, `ACCOUNT_RESTRICTED`,
`NO_STUDENTS`, `NO_PROGRAMS`, `NO_BATCHES`, `NO_SCHEDULE`, `UNKNOWN`.
This is a deliberately separate component and code union from the
student portal's `StudentPortalState` — a parent's "not linked" message
says "parent record," never "student record," and the two portals'
copy must never be interchangeable.

## No linked students state

A valid Parent Portal account may have zero `student_parents` rows —
this is a different, more benign case than `PARENT_NOT_LINKED` (missing
`parents` business record entirely). It renders `NO_STUDENTS`: "No
students are currently linked to your parent account," plus contact
info if the parent believes this is wrong. No student is ever
fabricated or matched by parent email/phone as a silent fallback.

## Parent status presentation

`ParentStatusBadge` (`src/components/portal/parent/ParentStatusBadge.tsx`)
is structurally identical to the student portal's `StudentStatusBadge`
(same tone-based `{label, tone}` API) but is its own independent
component — not imported from `src/components/portal/student`. This
small duplication was a deliberate choice over refactoring the
already-shipped, validated student component into a shared primitive:
Phase 12's spec explicitly warns against "a risky large refactor of the
Student Portal solely for code elegance," and a ~30-line badge
component is cheap to duplicate correctly versus risky to extract
carelessly. Status is always rendered as text plus a tone color, never
color alone.

## Components created

`ParentPortalShell`, `ParentPortalSidebarNav`, `ParentPortalMobileNav`,
`ParentStatusBadge`, `ParentPortalState`, `StudentContextNav` (all under
`src/components/portal/parent/`). No component wraps a single `<div>`
with no added behavior; program/batch/schedule card layouts are
implemented inline in their respective pages (or as a small local
`BatchCard` function in the batches page), matching the student
portal's own precedent of not over-extracting single-call-site
components.

## Components reused

`Logo`, `Container`, `cn()`, the skip-link pattern, `WEEKDAY_ORDER`/
`WEEKDAY_LABELS`/`formatTimeOfDay` (from `src/lib/portal/weekday.ts`,
confirmed generic — see "Schedule Sorting" above), and the general
Phoenix visual language/focus utilities. The parent portal shell
structure (sticky header, desktop sidebar, mobile drawer, skip link) was
modeled closely on `StudentPortalShell` for visual/behavioral
consistency, but implemented as independent files — no shared import
between the two portal segments' shells or nav components.

## Private data caching decision

Every `/parent` page is an ordinary dynamic Server Component — none use
`force-static`, `revalidate`, or any public caching mechanism (confirmed
via grep: zero matches in `src/app/parent`). `getCurrentParent()`'s
`cache()` wrapper is React's per-request memoization only — scoped to
one request, cannot leak one parent's identity or data into another
parent's request.

## Client data exposure audit

Only three files are Client Components:
`ParentPortalMobileNav`, `ParentPortalSidebarNav`, and
`StudentContextNav` (confirmed via grep) — all three receive only
static nav config or a student's already-authorized `id`/`fullName` for
display in an aria-label, never a full parent or student record, never
DOB/email/phone. No `localStorage`/`sessionStorage` reference exists
anywhere in the parent portal tree (confirmed via grep). The `studentId`
route parameter is the only PII-adjacent value that appears in a URL,
by design (a UUID resource identifier) — no DOB/email/phone/student
code is ever placed in a query string.

## Parent Portal SEO

All seven `/parent/*` pages set `index: false` via `buildMetadata()`
(confirmed via grep across every page file).

## Sitemap audit

`src/app/sitemap.ts` already excludes `/parent` from its static route
list (unchanged from Phase 9) — no Phase 12 route was ever added to it.

## Robots audit

`src/app/robots.ts` already disallows `/parent` in its `disallow` array
(unchanged from Phase 9) — confirmed still present and correct for all
seven Phase 12 routes.

## Accessibility

Skip link (`#parent-portal-main-content`) in the shell; semantic
`<nav>`/`<ul>`/`<li>` for the sidebar, mobile drawer, and student
context nav; `aria-current` on every active nav link; the mobile drawer
matches the student portal's accessible drawer contract exactly
(`aria-expanded`/`aria-controls`, `role="dialog" aria-modal="true"`,
focus moves to the first link on open, Escape closes and restores focus
to the trigger, body scroll lock via a `useEffect` toggling
`document.body.style.overflow`). Status is always communicated as
visible text via `ParentStatusBadge`, never color alone. Real headings
and semantic lists throughout; no table is used since no page has
genuinely tabular multi-column data that needs one.

## Responsive QA

Layouts reuse the same Tailwind responsive grid utilities already
validated in the student portal (`sm:`/`lg:` breakpoints in the identity
summary, profile fields, and card lists) across the site's tested range
(375–1920px). No fixed-width elements were introduced that would
overflow at narrow viewports; long student/program/batch names sit in
flex-wrapping containers rather than fixed-width boxes.

## Performance decisions

`getCurrentParent()` is memoized per request via `cache()` despite being
called in the layout and independently again in every page.
`getParentDashboard()` and the linked-student overview page both run
their independent underlying queries with `Promise.all` rather than
sequentially. No page fetches data through a client-side `useEffect` —
all data fetching happens in Server Components before render.

## Database migrations created

- `supabase/migrations/0017_parent_portal_rls.sql` — the RLS policies,
  `current_parent_id()`, `parent_has_student()`, and
  `get_parent_linked_student_batch_coaches()` described above. No
  `0018` migration was needed — everything fit cleanly in one file,
  same as Phase 11's single-migration approach.

## Supabase type updates

`src/lib/supabase/types.ts` gained `ParentBatchCoachRow` (the RPC's
return row shape — structurally identical to `StudentBatchCoachRow` but
kept as its own named type per the student/parent decoupling
convention) and a `get_parent_linked_student_batch_coaches` entry in
`Database.public.Functions`. Both are hand-written, narrow additions in
the same style as every prior phase's additions to this file — not a
claim that types were generated from a live database.

## Parent PII rules

Phone/email/WhatsApp appear on the parent's own profile page only,
never in the global shell (which shows only the parent's display name).
No parent field is exposed in a URL, nav label, or log line beyond what
`requireRole`/`getCurrentProfile` already handle at the auth layer.

## Student PII rules in parent context

A linked student's DOB, full address, personal email, personal phone,
WhatsApp, and chess association ID are never exposed anywhere in the
parent portal — `ParentLinkedStudent` simply does not carry those
fields (see "Linked Student Privacy Boundary"). Coach contact fields are
never exposed either (see "Parent Coach Display Privacy"). Being linked
to a student authorizes seeing that student's programs/batches/schedule
and a narrow identity summary — not their full internal record.

## No-linked-students behavior

See "No Linked Students State" above — a parent with zero
`student_parents` rows sees an honest `NO_STUDENTS` message, never a
fabricated child.

## Database unavailable behavior

If Supabase isn't configured, or any query throws, the affected page
renders `ParentPortalState code="DATABASE_UNAVAILABLE"` — never a stack
trace, never a raw Supabase error string, and never a fabricated
zero/empty result presented as confirmed data. This is always kept
visually and textually distinct from `NO_STUDENTS`/`NO_PROGRAMS`/
`NO_BATCHES`/`NO_SCHEDULE` (an honest empty result) and from
`PARENT_NOT_LINKED`/`ACCOUNT_RESTRICTED` (an identity/authorization
state) — three different situations, three different messages.

## Future attendance/progress/assignment/certificate integration

Attendance was built in Phase 14, progress evaluations in Phase 15, and
assignments in Phase 16, exactly along the lines this section anticipated:
`src/lib/queries/parent/attendance.ts`,
`src/lib/queries/parent/progress.ts`, and
`src/lib/queries/parent/assignments.ts`, the existing
`ParentQueryResult<T>` type (unchanged), and RPCs
(`get_parent_student_attendance(target_student_id)`,
`get_parent_student_progress_evaluations(target_student_id)`,
`get_parent_student_assignments(target_student_id)`,
`get_parent_student_assignment(target_student_id, target_assignment_id)`)
with authorization enforced inside via `parent_has_student()` (no direct
table RLS SELECT policy was needed for any of them — see
`docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`,
`docs/STUDENT_PROGRESS_ARCHITECTURE.md`, and
`docs/ASSIGNMENTS_ARCHITECTURE.md`, "Read RPC Decision"/"Parent Progress
Privacy"/"Parent Assignment Privacy"), plus new context-nav items added
only once each route genuinely existed. Certificate and achievement
integration was built in Phase 17 following this exact pattern — see
"Phase 17 — Certificates + Achievements" below.

## Phase 17 — Certificates + Achievements

`/parent/students/[studentId]/certificates` and
`/parent/students/[studentId]/achievements` were added in Phase 17, using
`src/lib/queries/parent/certificates.ts`/`achievements.ts`, the existing
`ParentQueryResult<T>` type (unchanged), and RPCs
(`get_parent_student_certificates(target_student_id)`,
`get_parent_student_certificate(target_student_id, target_certificate_id)`,
`get_parent_student_achievements(target_student_id)`,
`get_parent_student_achievement(target_student_id, target_achievement_id)`)
with authorization enforced inside via `parent_has_student()` — no direct
table RLS SELECT policy was needed. Certificates are additionally filtered
to `status IN ('ISSUED', 'REVOKED')` and achievements to
`status IN ('PUBLISHED', 'ARCHIVED')`; `DRAFT` records of either kind
never reach the parent portal. New context-nav items ("Certificates",
"Achievements") were added to `getParentStudentContextNav()` only because
the routes genuinely exist. `NO_CERTIFICATES`/`NO_ACHIEVEMENTS` were added
to `ParentPortalStateCode`. Parent access is entirely read-only — see
`docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md` for the full domain
model and privacy rules.
