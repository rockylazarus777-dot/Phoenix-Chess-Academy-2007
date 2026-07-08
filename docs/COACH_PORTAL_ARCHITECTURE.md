# Coach Portal Architecture

Phase 13 built the coach-facing portal at `/coach` on top of the Phase 9
auth foundation, the Phase 10 operational database, and the security
patterns established by the Phase 11 student portal and Phase 12 parent
portal. This document covers the security model, data flow, and privacy
decisions specific to the coach portal. See `docs/AUTH_ARCHITECTURE.md`
for login/session/role fundamentals, `docs/ADMIN_OPERATIONS_ARCHITECTURE.md`
for the operational schema, and `docs/STUDENT_PORTAL_ARCHITECTURE.md` /
`docs/PARENT_PORTAL_ARCHITECTURE.md` for the sibling systems this one
deliberately parallels without importing from.

## Coach Portal routes

Phase 13 built six routes under `/coach`; Phase 14 added five more for
class sessions and attendance; Phase 15 added five more for student
progress evaluations; Phase 16 added six more for assignments and homework
(see `docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`,
`docs/STUDENT_PROGRESS_ARCHITECTURE.md`, and
`docs/ASSIGNMENTS_ARCHITECTURE.md` for the full architecture — this
section only lists the routes):

- `/coach` — dashboard
- `/coach/profile` — read-only profile
- `/coach/batches` — My Batches (every assigned batch)
- `/coach/batches/[batchId]` — one assigned batch's overview
- `/coach/batches/[batchId]/students` — that batch's student roster
- `/coach/batches/[batchId]/schedule` — that batch's recurring schedule
- `/coach/batches/[batchId]/sessions` — **(Phase 14)** that batch's class sessions
- `/coach/batches/[batchId]/progress` — **(Phase 15)** that batch's progress evaluations
- `/coach/batches/[batchId]/students/[studentId]/progress` — **(Phase 15)** one student's evaluation history within that batch
- `/coach/batches/[batchId]/assignments` — **(Phase 16)** that batch's assignments
- `/coach/sessions` — **(Phase 14)** every session on an assigned batch, grouped by status
- `/coach/sessions/new` — **(Phase 14)** create a session for an assigned batch
- `/coach/sessions/[sessionId]` — **(Phase 14)** session detail + status actions
- `/coach/sessions/[sessionId]/attendance` — **(Phase 14)** mark/update attendance
- `/coach/progress` — **(Phase 15)** every evaluation visible under the coach historical read rule, grouped by status
- `/coach/progress/new` — **(Phase 15)** create an evaluation for an assigned batch
- `/coach/progress/[evaluationId]` — **(Phase 15)** evaluation detail + inline edit + publish/archive actions
- `/coach/assignments` — **(Phase 16)** every assignment visible under the coach historical read rule, grouped by status
- `/coach/assignments/new` — **(Phase 16)** create an assignment for an assigned batch
- `/coach/assignments/[assignmentId]` — **(Phase 16)** assignment detail + inline edit + publish/archive actions
- `/coach/assignments/[assignmentId]/submissions` — **(Phase 16)** recipient roster + narrow submission state for that assignment
- `/coach/assignments/[assignmentId]/submissions/[submissionId]` — **(Phase 16)** single submission detail + review form

No other `/coach/*` route exists. There is no certificate, payment,
messaging, or tournament-registration route, and none of those appear as
disabled/"coming soon" nav items. There is deliberately no
`/coach/students/[studentId]` route — a coach only ever views a student
inside the context of one assigned batch's roster.

## Coach portal shell architecture

`src/components/portal/coach/CoachPortalShell.tsx` replaces the Phase 9
`ProtectedShell` placeholder for `/coach` only — the Student, Parent, and
Admin shells are untouched. Sticky header (mobile drawer trigger, Logo,
"Coach Portal" label, the coach's display name, a "Website" link back to
the public site, a logout form inherited unchanged from Phase 9); desktop
sidebar (`CoachPortalSidebarNav`) plus a `<main>` content region with a
skip link (`#coach-portal-main-content`). The shell always renders
regardless of whether coach-identity resolution reached `OK` — a
database-unavailable or not-linked coach still needs to navigate or log
out; each page independently decides whether to render its normal content
or a `CoachPortalState`.

## Coach mobile navigation

`CoachPortalMobileNav` is a small Client Component island: `aria-expanded`/
`aria-controls` on the trigger button, `role="dialog" aria-modal="true"` on
the drawer, focus moves to the first nav link on open, `Escape` closes the
drawer and restores focus to the trigger, and body scroll is locked via a
`useEffect` toggling `document.body.style.overflow`. Duplicated from (not
imported from) the Student/Parent Portal drawers, matching the established
"avoid a risky shared-primitive refactor" precedent from Phase 12.

## Coach global navigation items

`COACH_NAV_ITEMS` (`src/config/coachPortalNavigation.ts`) contains exactly
three items: Dashboard (`/coach`), My Profile (`/coach/profile`), My
Batches (`/coach/batches`). No disabled/"coming soon" item exists.

## Batch context navigation

`getCoachBatchContextNav(batchId)` (same file) generates three
batch-scoped items — Overview / Students / Class Schedule — rendered by
`BatchContextNav` only while viewing one assigned batch. These never
appear in the global sidebar or mobile drawer; they are computed per-batch
since every href embeds that batch's UUID.

## Coach authorization boundary

A `COACH`-role profile may view only:

1. Their own `coaches` row (`coaches.profile_id = auth.uid()`).
2. Batches connected to them via a **current** (`ended_at is null`)
   `batch_coaches` row.
3. Students connected to those batches via `batch_enrollments` or
   `student_program_enrollments.batch_id` (dual-path, deduplicated).

No code path authorizes a coach against a batch or student by UUID, code,
name, program, location, or training-mode knowledge alone — every check
traces back to an explicit `batch_coaches` relationship row.

## Coach identity resolution

`src/lib/coach/getCurrentCoach.ts` is the sole resolver:

1. `requireRole(["COACH"])` → `AuthProfile`.
2. Query `coaches where profile_id = <authenticated profile id>`, using
   the authenticated (anon-key, RLS-enforced) Supabase server client —
   never the service-role client.
3. Return a discriminated `CoachIdentityResult`: `OK` (profile + narrow
   `CoachPortalIdentity` + computed access level), `DATABASE_UNAVAILABLE`,
   `NOT_LINKED`, or `UNKNOWN`.

No code path accepts a coach ID from the browser (query string, form
field, cookie). `getCurrentCoach()` is the only place a coach ID enters a
request; every downstream query function receives it as a plain argument
from server code. Wrapped in React's `cache()` for per-request (not
global) memoization — the same safe pattern documented for
`getCurrentStudent()`/`getCurrentParent()`.

## Profile-to-coach link architecture

`coaches.profile_id` is a nullable FK to `profiles.id`. A coach's
authenticated identity flows `auth.uid() → profiles.id →
coaches.profile_id` — the only chain used anywhere in Phase 13. Email and
phone are never used as a lookup fallback.

## Missing coach link behavior

If no `coaches` row has a matching `profile_id`, every page renders
`CoachPortalState code="COACH_NOT_LINKED"`:

> "Your Phoenix coach account is signed in, but the coach record is not
> currently linked. Please contact Phoenix Chess Academy for assistance."

followed by `siteConfig.contact.email`/`phone`. This never mentions the
`coaches` table, `profile_id`, a UUID, or provisioning details, and never
falls back to matching by email or phone. The wording is deliberately
distinct from the Student/Parent Portal's equivalent message ("coach
record," never "student record" or "parent record").

## Coach status access matrix

`src/lib/coach/access.ts` centralizes status → access level.
`public.coach_status` (0012_admin_operations_schema.sql) has only three
values — confirmed the same shape as `parent_status`, with no
ON_HOLD/ALUMNI-equivalent:

| `coach_status` | Access level |
| --- | --- |
| `ACTIVE` | `FULL` |
| `INACTIVE` | `DENIED` |
| `ARCHIVED` | `DENIED` |

The three-way `CoachPortalAccessLevel` type is kept even though
`READ_ONLY` is currently unreachable — not an invented status value, just
an unused branch of an already-generic result type, matching Phase 12's
same documented reasoning.

## Coach Portal identity type

`CoachPortalIdentity`: `id, coachCode, fullName, email, phone, whatsapp,
bio, specializations, status`. Excludes `profile_id`, `created_at`/
`updated_at`, and any admin-only metadata.

## Coach-to-batch authorization

`src/lib/coach/authorization.ts` exports `getAssignedBatch(coachId,
batchId)` — the one authoritative check for every
`/coach/batches/[batchId]*` route. It does not query `batches` first and
then decide whether to show it: the query IS the join against
`batch_coaches` (`.eq("coach_id", coachId).eq("batch_id",
batchId).is("ended_at", null)` with `batches!inner(...)`) — there is no
code path where a batch row is fetched before the relationship is
confirmed. `coachId` comes only from `getCurrentCoach()`; `batchId` is a
route parameter treated purely as a resource identifier, validated as a
UUID and then checked against the relationship, never trusted as
authorization by itself. Every dynamic page calls this independently —
none relies on "the dashboard already linked here correctly."

## Batch route identifier decision

`batchId` appears in the URL only as a resource identifier, exactly as the
spec requires. Invalid UUID, a UUID with no matching batch, and a
real-but-unassigned batch's UUID all return the same `NOT_FOUND` reason
from `getAssignedBatch()`, and every page responds identically:
`notFound()` (Next.js's standard 404).

## Batch enumeration protection

The only two possible outcomes for a `[batchId]` route are (a) real
content, once `getAssignedBatch()` succeeds, or (b) a plain 404 via
`notFound()`. There is no "access denied for batch {name}" message and no
code path that reveals a batch's name, code, program, status, or location
before authorization succeeds. `DATABASE_UNAVAILABLE` is handled
separately (an honest "portal unavailable" state, not a 404) so a real
outage is never disguised as "that batch doesn't exist."

## Coach dashboard architecture

`/coach` renders: (1) a welcome line using the coach's real first name —
no fabricated quote; (2) an identity summary (name, status badge, coach
code if configured, specializations if configured); (3) an Assigned
Batches preview (name, program, training mode, level, location, assigned
role, a per-batch "assigned batch roster entries" count, link to `/coach/
batches`); (4) a "unique students across assigned batches" count,
deduplicated — a student appearing on two assigned batches is counted
once; (5) a "Weekly Schedule" preview across all assigned batches, sorted
by weekday then start time. No academy-wide totals, no "class tomorrow" /
"starts soon" / "missed" / "completed" claims anywhere.

## Coach dashboard query strategy

`src/lib/queries/coach/dashboard.ts` → `getCoachDashboard(coachId)` calls
`listCoachBatches(coachId)` first, then runs three `IN`-filtered queries
in parallel via `Promise.all` — `batch_enrollments`, `student_program_
enrollments`, and `class_schedules`, all keyed by the resulting assigned
`batchIds` — rather than looping per batch (no N+1). Deduplication uses a
`Map<string, Set<string>>` (per-batch roster membership) and a global
`Set<string>` (unique students overall), built entirely in application
code from two non-PII linkage tables — the roster-display RPC (which
returns names/PII) is never called for the dashboard's counts.

## Coach identity summary

Rendered inline on `/coach` and mirrored on `/coach/profile`: full name,
`CoachStatusBadge`, coach code (only if present), specializations (only if
non-empty). No empty label/value pair is ever rendered.

## Coach profile page

`/coach/profile` — read-only. Three sections: Coach Information (coach
code, full name, status), Professional Information (bio, specializations —
only rendered if at least one is configured), Contact Information (email,
phone, WhatsApp — only rendered if at least one is configured). No Edit
Profile action exists; the page closes with a line directing the coach to
contact Phoenix Chess Academy for corrections.

## Coach profile privacy

`CoachProfileDetail` (`src/lib/queries/coach/profile.ts`): `coachCode,
fullName, status, bio, specializations, email, phone, whatsapp`. Excludes
`profile_id`, `created_at`/`updated_at`, and `joined_on` (admin-only, no
equivalent field exists to add — `coaches` has nothing more sensitive than
what's already listed).

## My Batches architecture

`/coach/batches` lists every **current** (`ended_at is null`)
`batch_coaches` relationship for the authenticated coach — one coach may
have many batches, and one batch may have many coaches. Fields: batch
name, code, program, training mode, level, location, batch status, the
coach's own assignment role, link to the batch overview. No unassigned
batch, no academy-wide batch count, no other coach's assignment, no
internal notes.

## Coach assignment role decision

`assignmentRole` is the real `batch_coaches.role` enum value (`PRIMARY` /
`ASSISTANT` / `GUEST`) rendered as-is — no invented "Head Coach" / "Lead
Trainer" / "Senior Coach" label exists anywhere. Authorization is based on
the relationship existing at all, never on being `PRIMARY`: an `ASSISTANT`
or `GUEST` coach sees their assigned batch in exactly the same read-only
detail as a `PRIMARY` coach in Phase 13.

## Assigned batch overview

`/coach/batches/[batchId]` — every request independently calls
`getAssignedBatch()`. Sections: Batch Identity (name, code, status,
program, training mode, level, location), Coach Assignment (the coach's
own role, assigned-since date if configured), a Student Roster Preview
(first 5 entries, link to the full roster), a Recurring Schedule Preview
(first 5 entries, link to the full schedule), and `BatchContextNav`. No
internal notes, no capacity figure, no other coach's contact data, no
student or parent contact detail, no payment/attendance/progress data.

## Assigned batch privacy boundary

`CoachAssignedBatch` never carries a full `batches` row or internal
notes — see "Coach assigned batch type" below for the exact field list.

## Coach assigned batch type

`CoachAssignedBatch` (`src/lib/coach/authorization.ts`): `id, batchCode,
name, status, trainingMode, level, programId, programName, programSlug,
locationId, locationName, assignmentRole, assignedAt`.

## Assigned batch student roster

`/coach/batches/[batchId]/students` — after `getAssignedBatch()`
authorization, the roster comes exclusively from the `get_coach_batch_
roster()` RPC (never a direct `.from("students").select()`). Fields:
student name, code, current level, status, FIDE ID/rating (only if
configured), and batch assignment status (only if resolvable — see
"Roster dual-path decision" below). Never DOB, address, email, phone,
WhatsApp, parent names, parent contact, internal notes, chess association
ID, or payment information.

## Roster dual-path decision

A student is included in the roster if **either** a `batch_enrollments`
row **or** a `student_program_enrollments.batch_id` row connects them to
the batch — both linkage paths Phase 10 left open (see
`docs/ADMIN_OPERATIONS_ARCHITECTURE.md`, "Batch Membership Decision"). The
roster RPC resolves `assignment_status` via a `LEFT JOIN LATERAL`
subquery that picks the single most relevant `batch_enrollments` row per
student (an `ACTIVE` row preferred, otherwise the most recently assigned
row). If a student has no `batch_enrollments` row at all — connected only
via `student_program_enrollments.batch_id` — `assignment_status` is
`NULL`. This is a deliberate, documented choice: `NULL` means "connected
via program enrollment only," never a fabricated `ACTIVE` status.

## Roster deduplication

Both the roster RPC (via its two `EXISTS` clauses in one `WHERE`) and the
dashboard's application-level `Map`/`Set` logic guarantee a student
appears at most once per batch and at most once in the dashboard's
academy-wide unique-student count, even when connected through both
linkage paths simultaneously.

## Student privacy in coach context

Deliberately NOT `StudentPortalIdentity` or `ParentLinkedStudent` — those
are different privacy boundaries (the student's own portal identity and a
parent's linked-student view respectively, both wider than what a coach
should see). `CoachRosterStudent` never carries a full `students` row.
There is no `/coach/students/[studentId]` route in Phase 13, deliberately
— a coach only ever sees a student inside one assigned batch's roster,
preventing a broad student-resource expansion before progress/attendance
is designed.

## Coach roster student type

`CoachRosterStudentRow` (`src/lib/supabase/types.ts`, mirrors the RPC's
return shape exactly): `student_id, student_code, full_name,
current_level, status, fide_id, fide_rating, assignment_status`.

## Roster empty state

An empty roster renders `CoachPortalState code="NO_STUDENTS"`: "No
students are currently linked to this batch." Never an academy-wide
student list, never a fabricated roster, never treated as an outage.

## Assigned batch class schedule

`/coach/batches/[batchId]/schedule` — after authorization, queries active
`class_schedules` rows for that batch. Recurring weekly definitions only.
Shows day of week, start/end time, training mode, location (if
configured), and timezone. No calendar library, no dated events, no
attendance controls, no "Start Class"/"Join Class" button, no meeting
link, no next-class calculation, no "upcoming class" claim.

## Schedule sorting

Reuses `WEEKDAY_ORDER`/`WEEKDAY_LABELS` from `src/lib/portal/weekday.ts`
directly — a generic `public.weekday` enum display map with no
student/parent-specific logic, so importing it from the coach portal does
not cross the portal-decoupling boundary the way importing a
student/parent-specific type would. Rows sort by
`WEEKDAY_ORDER.indexOf(...)` then `start_time.localeCompare()`, never
alphabetically.

## Timezone display

The batch schedule page computes the distinct set of timezones across its
rows — one timezone shows a single "Times shown in {tz}." note; more than
one shows `(timezone)` per row. No silent conversion to the visitor's
browser timezone.

## Coach query architecture

All coach-scoped reads live in `src/lib/queries/coach/` — `profile.ts`,
`batches.ts`, `roster.ts`, `schedule.ts`, `dashboard.ts`. Every module uses
`getServerSupabaseClient()` (authenticated, RLS-enforcing), never the
service-role client (confirmed via grep — zero references to a
service-role client anywhere in `src/lib/queries/coach`, `src/lib/coach`,
or `src/app/coach`). `batchId` parameters only ever originate from an
already-authorized `getAssignedBatch()` call at the page level; `coachId`
parameters only ever originate from `getCurrentCoach()`.

## Coach query result architecture

`src/lib/coach/queryResult.ts` defines `CoachQueryResult<T>` —
`{ ok: true; data: T } | { ok: false; code: "DATABASE_UNAVAILABLE" |
"UNKNOWN" }` — its own independent type, not imported from the Student or
Parent Portal's query-result types. `COACH_NOT_LINKED`/`ACCOUNT_RESTRICTED`
are resolved once, up front, by `getCurrentCoach()`; `NOT_FOUND` (batch
authorization) is resolved once, up front, by `getAssignedBatch()` (via
`notFound()`) — neither needs to be a state in every individual query's
result type.

## Coach RLS migration

`supabase/migrations/0018_coach_portal_rls.sql` — the first migration
after `0017_parent_portal_rls.sql`. Does not edit `0017` or any earlier
migration; everything needed fit in one coherent file, matching Phase 11
and Phase 12's single-migration precedent.

## Coach RLS policies

Five SELECT-only policies for `authenticated`: `coaches_select_own`,
`batch_coaches_select_own`, `batches_select_for_assigned_coach`,
`batch_enrollments_select_for_assigned_coach`,
`student_program_enrollments_select_for_assigned_coach`,
`class_schedules_select_for_assigned_coach` (six, counting all). Postgres
RLS policies on the same table for the same command are OR'd together, so
e.g. `batches_select_for_assigned_coach` sits alongside 0016's and 0017's
own `batches_select_for_*` policies without conflict. No policy grants a
COACH broad SELECT-all on `coaches`, `students`, `parents`,
`student_parents`, `batches`, or any enrollment table, and no INSERT/
UPDATE/DELETE policy exists for COACH anywhere — Phase 13 is read-only end
to end. `programs`/`academy_locations` need no new policy: Phase 7's
`active = true` policy (reused as-is by Phases 11 and 12) is reused as-is
here too.

## auth.uid() coach ownership chain

Verified against the same `getCurrentProfile.ts` fact Phases 11 and 12
verified: `profiles.id === auth.uid()`. The coach's own record:
`coaches.profile_id = auth.uid()`. The coach's authorization over a batch
is a *second*, separate relationship: `batch_coaches.coach_id =
current_coach_id() AND batch_coaches.batch_id = <the batch in question>
AND batch_coaches.ended_at IS NULL`. Neither hop uses `coach_code`, email,
or phone.

## Coach RLS helper functions

`current_coach_id()` — SQL, `SECURITY DEFINER`, `STABLE`, `SET search_path
= public`, mirrors 0016's `current_student_id()`/0017's
`current_parent_id()` exactly. `coach_has_batch(target_batch_id uuid)` —
same attributes, additionally requires `ended_at is null`, returns `true`
only if a current `batch_coaches` row links the calling coach to that
batch; returns `false` (never `true`) for a non-coach, an unlinked coach,
an ended assignment, or any batch not explicitly assigned. Both `REVOKE
ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`. Neither is a generic
bypass — both only ever resolve data tied to the caller's own `auth.uid()`.

## batch_coaches security boundary

Every assigned-batch policy and the `get_coach_batch_roster()` RPC
ultimately reduce to one check: does a current `batch_coaches` row exist
linking this `auth.uid()`-derived coach to this batch? `profiles.role =
'COACH'` alone never authorizes access to any specific batch; the role
only gets a profile past `requireRole()`, not past `coach_has_batch()`.

## Roster privacy RPC decision

`students` holds `date_of_birth`/`address`/`email`/`phone`/`whatsapp`/
`notes`/`chess_association_id` — RLS is row-level, not column-level, so a
policy of the shape "coach can see students on assigned batches" would
still let a coach `SELECT` the full row (every PII column) for any student
on their batch, regardless of what the UI code selects. Instead, narrow
roster display data is exposed through `get_coach_batch_roster()`, a
`SECURITY DEFINER` function that internally re-derives the caller's own
assigned batch via `coach_has_batch()` and returns only the seven safe
columns. No `students_select_for_assigned_coach` policy exists anywhere.

## Students table privacy decision

See "Roster privacy RPC decision" immediately above — `students` remains
deny-by-default for `authenticated` coaches, exactly as it already is for
everyone except the row's own linked profile (0016) and that student's
linked parents (0017).

## Program RLS decision

Unchanged from Phases 11 and 12's reasoning: `programs` has no field more
sensitive than what's already public, so Phase 7's existing `active =
true` public policy already covers what the coach portal needs. No Phase
13 migration touches `programs`.

## Location RLS decision

Same reasoning: `academy_locations` has no field more sensitive than a
name/address, already covered by Phase 7's `active = true` public policy.
No Phase 13 migration touches `academy_locations`.

## Database views created

None. The parameterized RPC above and Phase 7's existing policies cover
every case needed this phase.

## Coach error states

`src/components/portal/coach/CoachPortalState.tsx` — the one component
every coach error/empty state renders through: `DATABASE_UNAVAILABLE`,
`COACH_NOT_LINKED`, `ACCOUNT_RESTRICTED`, `NO_BATCHES`, `NO_STUDENTS`,
`NO_SCHEDULE`, `UNKNOWN`. This is a deliberately separate component and
code union from the Student/Parent Portal's state components — a coach's
"not linked" message says "coach record," never "student record" or
"parent record."

## No assigned batches state

A valid Coach Portal account may have zero `batch_coaches` rows — a
different, more benign case than `COACH_NOT_LINKED` (missing `coaches`
business record entirely). It renders `NO_BATCHES`: "No batches are
currently assigned to your coach account," plus contact info if the coach
believes this is wrong. No batch is ever fabricated or matched by coach
email/phone as a silent fallback.

## Coach status presentation

`CoachStatusBadge` (`src/components/portal/coach/CoachStatusBadge.tsx`) is
structurally identical to the Student/Parent Portal's status badges
(same tone-based `{label, tone}` API) but is its own independent
component — not imported from `src/components/portal/student` or
`src/components/portal/parent`. The same file also exposes
`coachStatusTone()`, `rosterStudentStatusTone()`, and `batchStatusTone()`
as small generic tone-mapping helpers. Status is always rendered as text
plus a tone color, never color alone.

## Components created

`CoachPortalShell`, `CoachPortalSidebarNav`, `CoachPortalMobileNav`,
`CoachStatusBadge`, `CoachPortalState`, `BatchContextNav` (all under
`src/components/portal/coach/`). No component wraps a single `<div>` with
no added behavior; batch/roster/schedule card layouts are implemented
inline in their respective pages, matching the Student and Parent
Portals' own precedent of not over-extracting single-call-site
components.

## Components reused

`Logo`, `cn()`, the skip-link pattern, `WEEKDAY_ORDER`/`WEEKDAY_LABELS`/
`formatTimeOfDay` (from `src/lib/portal/weekday.ts`, confirmed generic —
see "Schedule sorting" above), `isUuid` (from `src/lib/admin/uuid.ts`),
and the general Phoenix visual language/focus utilities. The coach portal
shell structure (sticky header, desktop sidebar, mobile drawer, skip link)
was modeled closely on `StudentPortalShell`/`ParentPortalShell` for
visual/behavioral consistency, but implemented as independent files — no
shared import between any two portal segments' shells or nav components.

## Private data caching decision

Every `/coach` page is an ordinary dynamic Server Component — none use
`force-static`, `revalidate`, or any public caching mechanism (confirmed
via grep: zero matches in `src/app/coach`). `getCurrentCoach()`'s
`cache()` wrapper is React's per-request memoization only — scoped to one
request, cannot leak one coach's identity or data into another coach's
request.

## Client data exposure audit

Only three files are Client Components: `CoachPortalMobileNav`,
`CoachPortalSidebarNav`, and `BatchContextNav` (confirmed via grep) — all
three receive only static nav config or an already-authorized batch's
`id`/`name` for display in a link/aria-label, never a full coach/batch/
student record, never DOB/email/phone. No `localStorage`/`sessionStorage`/
`indexedDB` reference exists anywhere in the coach portal tree (confirmed
via grep). The `batchId` route parameter is the only PII-adjacent value
that appears in a URL, by design (a UUID resource identifier) — no
student code/name/email/phone or coach email/phone is ever placed in a
query string.

## Coach Portal SEO

All six `/coach/*` pages set `index: false` via `buildMetadata()`
(confirmed via grep across every page file).

## Sitemap audit

`src/app/sitemap.ts` already excludes `/coach` from its static route list
(unchanged from Phase 9) — no Phase 13 route was ever added to it.

## Robots audit

`src/app/robots.ts` already disallows `/coach` in its `disallow` array
(unchanged from Phase 9) — confirmed still present and correct for all
six Phase 13 routes.

## Accessibility

Skip link (`#coach-portal-main-content`) in the shell; semantic `<nav>`/
`<ul>`/`<li>` for the sidebar, mobile drawer, and batch context nav;
`aria-current` on every active nav link; the mobile drawer matches the
Student/Parent Portal's accessible drawer contract exactly
(`aria-expanded`/`aria-controls`, `role="dialog" aria-modal="true"`, focus
moves to the first link on open, Escape closes and restores focus to the
trigger, body scroll lock via a `useEffect` toggling
`document.body.style.overflow`). Status is always communicated as visible
text via `CoachStatusBadge`, never color alone. Real headings and
semantic lists throughout; no table is used since no page has genuinely
tabular multi-column data that needs one.

## Responsive QA

Layouts reuse the same Tailwind responsive grid utilities already
validated in the Student and Parent Portals (`sm:`/`lg:` breakpoints in
the identity summary, profile fields, and card lists) across the site's
tested range (375–1920px). No fixed-width elements were introduced that
would overflow at narrow viewports; long batch/student names sit in
flex-wrapping containers rather than fixed-width boxes.

## Performance decisions

`getCurrentCoach()` is memoized per request via `cache()` despite being
called in the layout and independently again in every page.
`getCoachDashboard()` and the assigned-batch overview page both run their
independent underlying queries with `Promise.all` rather than
sequentially. No page fetches data through a client-side `useEffect` — all
data fetching happens in Server Components before render.

## Database migrations created

- `supabase/migrations/0018_coach_portal_rls.sql` — the RLS policies,
  `current_coach_id()`, `coach_has_batch()`, and
  `get_coach_batch_roster()` described above. No `0019` migration was
  needed — everything fit cleanly in one file, same as Phase 11 and
  Phase 12's single-migration approach.

## Supabase type updates

`src/lib/supabase/types.ts` gained `CoachRosterStudentRow` (the RPC's
return row shape) and a `get_coach_batch_roster` entry in
`Database.public.Functions`. Both are hand-written, narrow additions in
the same style as every prior phase's additions to this file — not a
claim that types were generated from a live database.

## COACH_PORTAL_ARCHITECTURE.md status

This document — created in Phase 13, covering every topic the phase spec
requires.

## README update

`README.md` updated to list the Coach Portal alongside the Student and
Parent Portals (routes, identity resolver, RLS migration file).

## Files created

- `src/lib/coach/access.ts`
- `src/lib/coach/getCurrentCoach.ts`
- `src/lib/coach/queryResult.ts`
- `src/lib/coach/authorization.ts`
- `src/lib/queries/coach/profile.ts`
- `src/lib/queries/coach/batches.ts`
- `src/lib/queries/coach/roster.ts`
- `src/lib/queries/coach/schedule.ts`
- `src/lib/queries/coach/dashboard.ts`
- `src/config/coachPortalNavigation.ts`
- `src/components/portal/coach/CoachPortalShell.tsx`
- `src/components/portal/coach/CoachPortalSidebarNav.tsx`
- `src/components/portal/coach/CoachPortalMobileNav.tsx`
- `src/components/portal/coach/CoachStatusBadge.tsx`
- `src/components/portal/coach/CoachPortalState.tsx`
- `src/components/portal/coach/BatchContextNav.tsx`
- `src/app/coach/profile/page.tsx`
- `src/app/coach/batches/page.tsx`
- `src/app/coach/batches/[batchId]/page.tsx`
- `src/app/coach/batches/[batchId]/students/page.tsx`
- `src/app/coach/batches/[batchId]/schedule/page.tsx`
- `supabase/migrations/0018_coach_portal_rls.sql`
- `docs/COACH_PORTAL_ARCHITECTURE.md`

## Files modified

- `src/app/coach/layout.tsx` — replaced the Phase 9 `ProtectedShell`
  placeholder with `CoachPortalShell`.
- `src/app/coach/page.tsx` — replaced the Phase 9 placeholder with the
  real coach dashboard.
- `src/lib/supabase/types.ts` — added `CoachRosterStudentRow` and the
  `get_coach_batch_roster` function entry.
- `README.md` — Coach Portal section added.

## Packages installed and why

None. Phase 13 used only packages already installed in prior phases
(`@supabase/ssr`, `@supabase/supabase-js`, Next.js, React).

## tsc result

`npx tsc --noEmit` — clean, exit code 0, no errors.

## eslint result

`npx eslint .` (and targeted runs against every new/modified coach file) —
clean, exit code 0, no errors or warnings.

## build result

`npm run build` could not run to completion in this sandbox session — the
sandbox's native `@next/swc-linux-x64-gnu` binary is a corrupt/stub file
(confirmed ~39KB, missing real section headers, not a genuine tens-of-MB
binary), producing `Bus error (core dumped)`, and there is no network
route available in this sandbox to fetch a replacement
(`registry.npmjs.org` resolves via `EAI_AGAIN`). This is the same
environmental condition documented in the Phase 11 and Phase 12
completion reports — `tsc --noEmit` and `eslint .` remain the two reliable
validation gates in this sandbox. No production code was modified to work
around this, and no SWC/font stub was committed.

## Known limitations

- `npm run build` is unverifiable in this sandbox (see "Build result").
- Live Supabase testing is deferred — no project credentials exist yet in
  this environment; all RLS/RPC logic is reviewed by inspection only.
- The coach dashboard's "unique students across assigned batches" count
  and each batch's roster-entry count are computed from `batch_
  enrollments`/`student_program_enrollments` directly (non-PII linkage
  tables), not from the roster RPC — this is by design (see "Coach
  dashboard query strategy"), not a limitation, but is noted here since
  it means the dashboard never displays a student's name.

## Exact live Supabase coach tests needed later

1. Create a `profiles` row with `role = 'COACH'` and no matching `coaches`
   row → confirm `/coach` renders `COACH_NOT_LINKED`, not a crash.
2. Link a `coaches` row via `profile_id` → confirm `/coach` renders the
   dashboard with the coach's real name and status.
3. Set that coach's `status` to `INACTIVE` → confirm every `/coach/*`
   route renders `ACCOUNT_RESTRICTED`.
4. Create two batches; assign the coach to only one via `batch_coaches`
   (`ended_at is null`) → confirm `/coach/batches` lists only the
   assigned batch, and `/coach/batches/{unassigned-batch-id}` 404s.
5. End the coach's assignment (`ended_at` set) → confirm that batch
   disappears from `/coach/batches` and its detail route 404s.
6. Assign a second coach to the same batch with `role = 'ASSISTANT'` →
   confirm that coach can view the batch overview/roster/schedule
   identically to a `PRIMARY` coach.
7. Enroll a student via `batch_enrollments` only, another via
   `student_program_enrollments.batch_id` only, and a third via both →
   confirm the roster shows exactly three students (no duplicate), and
   that the program-only student's `assignment_status` is blank/null
   while the other two show a real status.
8. As a different, unrelated coach, attempt `/coach/batches/{batchId}`,
   `/students`, and `/schedule` for a batch they are not assigned to →
   confirm all three 404 identically to a nonexistent UUID.
9. Directly query `students`/`parents`/`student_parents`/`coaches` via the
   anon/authenticated client while signed in as a coach → confirm RLS
   returns zero rows except the coach's own `coaches` row.
10. Call `get_coach_batch_roster()` with a `target_batch_id` the coach is
    not assigned to → confirm it returns zero rows, not an error.

## Exact coach RLS test plan

1. As COACH A, `select * from coaches` → only A's own row returns.
2. As COACH A, `select * from batch_coaches` → only A's own assignment
   rows return (never COACH B's).
3. As COACH A, `select * from batches` → only batches A is currently
   assigned to return.
4. As COACH A, `select * from batch_enrollments` → only rows for A's
   assigned batches return.
5. As COACH A, `select * from student_program_enrollments` → only rows
   with a `batch_id` A is assigned to return (rows with `batch_id is
   null` never return).
6. As COACH A, `select * from class_schedules` → only rows for A's
   assigned batches return.
7. As COACH A, `select * from students` → zero rows (no direct policy
   exists).
8. As COACH A, `select * from parents` and `student_parents` → zero rows.
9. As COACH A, `select public.current_coach_id()` → returns A's own
   `coaches.id`.
10. As COACH A, `select public.coach_has_batch('<batch B is assigned
    to>')` → returns `false`.
11. As COACH A, `select * from public.get_coach_batch_roster('<A's own
    batch>')` → returns the expected deduplicated roster with only the
    seven safe columns.
12. As COACH A, `select * from public.get_coach_batch_roster('<a batch A
    is not assigned to>')` → returns zero rows.
13. Attempt an `insert`/`update`/`delete` as COACH A against any table
    above → confirm every one is rejected (no COACH mutation policy
    exists anywhere).

## Exact coach portal test plan

1. Sign in as a profile with `role != 'COACH'` and visit `/coach` →
   redirected per Phase 9's `requireRole()` contract, never shown coach
   content.
2. Sign in as COACH with no `coaches` row → `COACH_NOT_LINKED` state on
   every `/coach/*` route.
3. Sign in as COACH with `status = 'INACTIVE'`/`'ARCHIVED'` →
   `ACCOUNT_RESTRICTED` state on every route.
4. Sign in as an `ACTIVE` COACH with zero `batch_coaches` rows → `/coach`
   and `/coach/batches` both show `NO_BATCHES`, never a crash or a
   fabricated batch.
5. Sign in as an `ACTIVE` COACH with one or more assigned batches →
   dashboard, My Batches, batch overview, roster, and schedule all render
   real data with correct counts and no duplication.
6. Manually edit the URL to a `batchId` for a batch the coach is not
   assigned to → `notFound()` on overview/students/schedule, no data
   leak.
7. Manually edit the URL to a non-UUID `batchId` → `notFound()`,
   identical response to an unassigned real batch.
8. View a batch with zero roster entries → `NO_STUDENTS` state, never an
   academy-wide list.
9. View a batch with zero schedule rows → `NO_SCHEDULE` state.
10. Resize/inspect every `/coach/*` page at 375/430/768/1024/1280/1440/
    1920px → no horizontal overflow, sidebar/mobile drawer both function
    correctly.
11. Keyboard-only pass: Tab through the sidebar and batch context nav,
    open/close the mobile drawer with keyboard only, confirm focus
    containment and restoration.
12. View page source / dev tools network tab for every `/coach/*` route →
    confirm no DOB/address/email/phone/WhatsApp/parent data appears
    anywhere in the HTML or JSON payload for roster students.

## Security risks deferred to future phases

- Attendance tracking, class sessions, and any "was this class held"
  record do not exist yet — a future phase must design its own RLS
  boundary rather than assuming `batch_coaches` access implies attendance
  write access.
- Progress reports, evaluations, and any coach-authored assessment of a
  student are fully deferred; no schema or route exists for them yet.
- Assignments/homework, certificates, and payments/invoices/subscriptions
  remain entirely out of scope for the coach role.
- Coach-to-parent or coach-to-student messaging/notifications do not
  exist; when built, they must not reuse the roster RPC's broad batch
  membership as implicit authorization for contacting a family — an
  explicit, separate consent/authorization model will be needed.
- Coach profile editing, student profile editing, batch editing, and
  student-enrollment editing by a coach are all deferred — Phase 13 is
  read-only end to end, and any future write capability needs its own
  Server Action, its own authorization check independent of this
  migration's SELECT-only policies, and its own audit trail (mirroring
  the Phase 10 admin audit log pattern).
- Tournament management/registration history integration with coach
  accounts has not been designed.
- Media uploads, Cloudflare R2, and Google Sheets integration remain out
  of scope for the coach role entirely.

## Phase 14 addendum

Phase 14 added class sessions and attendance on top of this
architecture — `coach_has_batch()` and `getAssignedBatch()` from this
document are reused as-is for session authorization
(`getAssignedSession()`), and `get_coach_batch_roster()`'s privacy
reasoning is extended by `get_coach_session_attendance()`. See
`docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md` for the complete
session/attendance schema, RLS, RPC, and privacy architecture — this
document's Phase 13 content above is otherwise unchanged.

## Phase 15 addendum

Phase 15 added student development progress evaluations on top of this
architecture — `coach_has_batch()`, `current_coach_id()`, and
`get_coach_batch_roster()` (via the new `getAuthorizedBatchStudent()`
helper) are reused as-is; the "Coach-to-Batch Authorization" and "Batch
Enumeration Protection" patterns from this document are mirrored exactly
by the new Coach Historical Read Rule and Evaluation Enumeration
Protection. See `docs/STUDENT_PROGRESS_ARCHITECTURE.md` for the complete
evaluation schema, RLS, RPC, and privacy architecture — this document's
Phase 13 content above is otherwise unchanged.

## Phase 16 addendum

Phase 16 added assignments and homework on top of this architecture —
`coach_has_batch()`, `current_coach_id()`, and `get_coach_batch_roster()`
(via the reused `getAuthorizedBatchStudent()` helper from Phase 15) are
reused as-is; the Coach Historical Read Rule and stricter mutation rule
established in Phase 15 are mirrored exactly for assignments and
submission review. See `docs/ASSIGNMENTS_ARCHITECTURE.md` for the complete
assignment/submission schema, RLS, RPC, and privacy architecture — this
document's Phase 13 content above is otherwise unchanged.
