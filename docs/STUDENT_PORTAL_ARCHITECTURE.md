# Student Portal Architecture

Phase 11 built the student-facing portal at `/portal` on top of the
Phase 9 auth foundation and the Phase 10 operational database. This
document covers the security model, data flow, and privacy decisions
specific to the student portal. See `docs/AUTH_ARCHITECTURE.md` for the
underlying login/session/role system and
`docs/ADMIN_OPERATIONS_ARCHITECTURE.md` for the operational schema the
portal reads from.

## Student portal routes

Phase 11 built five routes under `/portal`; Phase 14 added a sixth,
`/portal/attendance`; Phase 15 added a seventh, `/portal/progress`; Phase
16 added two more, `/portal/assignments` and
`/portal/assignments/[assignmentId]` (see
`docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`,
`docs/STUDENT_PROGRESS_ARCHITECTURE.md`, and
`docs/ASSIGNMENTS_ARCHITECTURE.md` for the full architecture). All nine
are defined in `src/config/studentPortalNavigation.ts` and rendered as the
entire student navigation:

- `/portal` — dashboard
- `/portal/profile` — read-only profile
- `/portal/programs` — My Programs
- `/portal/batches` — My Batches
- `/portal/schedule` — Class Schedule
- `/portal/attendance` — **(Phase 14)** class session + attendance history
- `/portal/progress` — **(Phase 15)** published development progress evaluations
- `/portal/assignments` — **(Phase 16)** assignments from the student's batch or assigned directly to them
- `/portal/assignments/[assignmentId]` — **(Phase 16)** assignment detail + submission/resubmission form

No other `/portal/*` route exists. There is no certificates, payments,
messaging, or tournament-portal route, and none of those appear as
disabled/"coming soon" nav items — the nav only lists what actually
exists today.

## Authentication boundary

`src/app/portal/layout.tsx` calls `getCurrentStudent()`, which calls
`requireRole(["STUDENT"])` as its first step (see
`src/lib/auth/requireRole.ts`). This preserves the exact Phase 9
redirect behavior: no session → `/login`; no profile row →
`/login?error=PROFILE_MISSING`; inactive profile →
`/login?error=ACCOUNT_UNAVAILABLE`; authenticated but wrong role →
that role's own home via `getRoleHome()`. Any future Server Action or
Route Handler placed under `/portal` must authorize independently —
the layout does not protect those.

## Student identity resolution

Role membership alone is not sufficient — a signed-in STUDENT profile
must resolve to exactly one business `students` row. The single
authoritative resolver is `src/lib/portal/getCurrentStudent.ts`:

1. `requireRole(["STUDENT"])` → `AuthProfile`.
2. Query `students where profile_id = <authenticated profile id>`,
   using the authenticated (anon-key, RLS-enforced) Supabase server
   client — never the service-role client.
3. Return a discriminated `StudentIdentityResult`:
   - `OK` — includes the profile, a narrow `StudentPortalIdentity`, and
     the computed `StudentPortalAccessLevel`.
   - `DATABASE_UNAVAILABLE` — Supabase isn't configured, or the query
     threw.
   - `NOT_LINKED` — profile exists, role is STUDENT, but no `students`
     row has a matching `profile_id`.
   - `UNKNOWN` — the query returned a Supabase error.

No code path ever accepts a student ID from the browser (query string,
form field, cookie, or otherwise). `getCurrentStudent()` is the only
place a student ID enters the request; every query module below
receives that ID as a plain function argument from server code, never
from client input.

`getCurrentStudent()` is wrapped in React's `cache()`, which memoizes
it per request (not globally), so calling it independently in the
layout and again in each page costs one query, not N.

## Profile-to-student link architecture

`students.profile_id` is a nullable foreign key to `profiles.id`. A
student's authenticated identity always flows
`auth.uid() → profiles.id → students.profile_id` — this is the only
ownership chain used anywhere in Phase 11 (see "auth.uid() ownership
chain" below). Email address and `student_code` are never used for
authorization or as a lookup fallback.

## Missing student link behavior

If a `students` row with a matching `profile_id` doesn't exist, every
portal page renders the `NOT_LINKED` state
(`StudentPortalState code="NOT_LINKED"`):

> "Your Phoenix student account is signed in, but the student record is
> not currently linked. Please contact Phoenix Chess Academy for
> assistance."

followed by `siteConfig.contact.email`/`phone`. This message never
mentions `profile_id`, the `students` table, a UUID, or any internal
reconciliation detail. There is no silent fallback to another student
record and no email-based matching.

## Student status access matrix

`src/lib/portal/access.ts` centralizes status → access level so no
page has to duplicate the logic:

| `student_status` | Access level |
| --- | --- |
| `ACTIVE` | `FULL` |
| `ON_HOLD` | `READ_ONLY` |
| `ALUMNI` | `READ_ONLY` |
| `INACTIVE` | `DENIED` |
| `ARCHIVED` | `DENIED` |

`READ_ONLY` still renders normal page content plus a neutral banner
("Your portal is currently in a read-only state..."); `DENIED` renders
`StudentPortalState code="ACCOUNT_RESTRICTED"` instead of page content.
Neither state exposes the underlying admin note or reason for the
status.

## Student portal identity type

`StudentPortalIdentity` (in `getCurrentStudent.ts`) is intentionally
narrow: `id, studentCode, fullName, email, phone, currentLevel, status,
joinedOn, fideId, fideRating`. It excludes `notes`, `address`,
`profile_id`, `created_at`/`updated_at`, and any other admin-only
field — this is the type every portal page and the shell receive, so
there is no code path that can accidentally leak an internal field
through it.

## Student dashboard architecture

`/portal` (`src/app/portal/page.tsx`) is a Server Component. After
resolving identity and access, it calls one function —
`getStudentDashboard(studentId)` — and renders: a welcome line with
the student's first name; the identity card (student code, status
badge, level/joined/FIDE fields only if configured); an Active
Programs preview; a Current Batches preview; a "Your Weekly Schedule"
preview (never "Upcoming Classes" — there are no dated
`class_sessions` yet); and a short, generic Phoenix training-philosophy
line with no fabricated student-specific progress claim.

## Student dashboard query

`src/lib/queries/student/dashboard.ts` exports `getStudentDashboard`,
which runs `Promise.all([listStudentPrograms, listStudentBatches,
getStudentSchedule])` — three independent queries in parallel, not
sequential round trips or four client-side `useEffect` fetches. Each
result is sliced to a small preview count
(`DASHBOARD_PREVIEW_LIMIT = 3` programs and current batches, 7
schedule rows) and the function always returns `ok: true` with
whatever sections succeeded — one section's `DATABASE_UNAVAILABLE`
doesn't blank the entire dashboard (tracked via `anySectionUnavailable`
for observability, not currently surfaced to the UI beyond falling
back gracefully per-section on the full pages).

## Student identity card

Rendered directly in `/portal/page.tsx`: student code, a status badge,
and current level / joined date / FIDE ID / FIDE rating — each field
rendered only `if` present; no empty label, no placeholder "0" rating,
no "N/A" text.

## Student profile page

`/portal/profile` is read-only in Phase 11 — there is no edit form.
Four sections: Student Information (code, full name, DOB, gender,
level, joined date), Chess Information (FIDE ID, FIDE rating, chess
association ID — with a neutral "no chess federation details are on
file yet" message if all three are absent), Contact Information
(email, phone, WhatsApp), and Location (country, state, city). A
closing line invites the student to contact the academy
(`siteConfig.contact.email`/`phone`) for changes instead of an edit
button.

## Student profile privacy

Internal fields (`notes`, `profile_id`, raw UUIDs, `created_at`,
`updated_at`, any admin-only column) are never selected by
`getStudentProfile()` (`src/lib/queries/student/profile.ts`) in the
first place — the query's `select()` list is the enforcement
mechanism, not UI-level hiding. Date of birth is queried and displayed
on this page only; it is never included in a URL, a nav label, the
dashboard, or the global shell.

## My Programs architecture

`src/lib/queries/student/programs.ts` → `listStudentPrograms(studentId)`
queries `student_program_enrollments` for the given student, joined
with `programs(slug, name)` and `batches(name)`. It shows program name,
status, enrolled date, completed date (if set), and a batch-assignment
summary if available. It never shows payment status, fees, attendance,
or a completion percentage — none of that data exists in Phase 10's
schema.

## Program database/public content linking

For each enrollment row, `listStudentPrograms` calls
`getProgramBySlug(dbProgram.slug)` (the existing public content lookup
in `src/content/programs.ts`) to check whether the DB program's slug
maps to a real, authored public program page. Only if that lookup
succeeds does the card link to `/programs/[slug]`; otherwise the
program name renders as plain text. This means a DB program row can
never produce a broken link, at the cost of occasionally not linking a
program that exists in the database but has no public content page
yet — a deliberate, documented trade-off.

## Program empty state

If `student_program_enrollments` has no rows for the student,
`/portal/programs` renders `StudentPortalState code="NO_PROGRAMS"`
("No program enrollment is currently linked to your student record.",
plus contact info) followed by a separate "Explore Phoenix Programs"
link to the public `/programs` listing. The two are visually and
textually distinct — the empty state is never confused with, or
padded out using, public marketing program cards.

## My Batches architecture

`src/lib/queries/student/batches.ts` → `listStudentBatches(studentId)`
queries `batch_enrollments` for the student, joined with
`batches(..., programs(name), academy_locations(name))`, then merges
in coach display data (see "Coach display privacy" below). Displayed
fields: batch name, batch code, program, training mode, level,
location, assignment status, assigned date, ended date (if historical),
and primary coach name (if a relationship exists). Batch capacity,
other students, student counts, internal batch notes, and any
admin-action affordance are never included.

## Active/historical batch display

`listStudentBatches` returns `{ current, historical }` —
`current` is every row where `assignmentStatus === "ACTIVE"`, and
`historical` is everything else (`ENDED`/`TRANSFERRED`). The portal
supports an arbitrary number of simultaneous current batch assignments;
Phase 10 explicitly left "one active batch" as an unenforced business
rule, so the UI does not assume single-batch and renders a list either
way. `/portal/batches` renders "Current Batches" always, and "Previous
Batches" only when `historical.length > 0`.

## Coach display privacy

`coaches` rows can contain email/phone/whatsapp/bio — fields row-level
RLS cannot hide selectively. Rather than grant students a table-level
SELECT policy on `coaches` (which would expose those fields to any
student who can see the row via a shared batch), Phase 11 adds a
narrow SECURITY DEFINER RPC, `get_student_batch_coaches()`
(migration `0016_student_portal_rls.sql`), returning only
`batch_id, coach_id, full_name, role`. It takes zero arguments — it is
always self-scoped to `auth.uid()` internally, so it cannot be used to
probe another student's coach assignments. `coaches` itself has no
student-facing SELECT policy at all. Multiple PRIMARY assignments (if
they ever occur) are handled by returning an array of coach display
rows per batch rather than assuming exactly one; the UI does not
invent a "Head Coach" title and uses the DB's own `role` value
(PRIMARY/ASSISTANT/GUEST) directly.

## Class schedule architecture

`/portal/schedule` uses `getStudentSchedule(studentId)`
(`src/lib/queries/student/schedule.ts`), which collects the set of
batch IDs the student is linked to via *either* `batch_enrollments`
(status ACTIVE) *or* `student_program_enrollments.batch_id` (Phase 10
left both paths possible), then queries `class_schedules` for those
batch IDs where `active = true`, joined with `batches(batch_code,
name)`. This is a recurring weekly schedule definition, not a calendar
of dated events — there is no calendar library, no "Join Class"
button, and no computed "next class" claim, because no
`class_sessions` table exists yet.

## Schedule sorting

Rows are sorted in TypeScript by day of week (via the shared
`WEEKDAY_ORDER` array in `src/lib/portal/weekday.ts`, declared
Monday→Sunday) and then by `start_time.localeCompare()` within a day.
Sorting does not rely on the Postgres enum's declaration order being
respected by an implicit query `ORDER BY` — it is computed explicitly
so correctness never depends on unstated database behavior. There is
exactly one weekday-order/label map in the codebase; both the schedule
page and the dashboard preview import it.

## Timezone display

`class_schedules.timezone` is stored per-row (Phoenix's Chennai
schedules use `Asia/Kolkata`). `/portal/schedule` computes the set of
distinct timezones across the student's rows: if there's exactly one,
it shows a single "Times shown in {tz}." note and omits the per-row
suffix; if more than one, each row shows `(timezone)` inline. There is
no silent conversion to the visitor's browser timezone, and no
hardcoded "IST" label — the row's own configured timezone string is
always what's shown.

## Student query architecture

All student-scoped reads live in `src/lib/queries/student/` —
`profile.ts`, `programs.ts`, `batches.ts`, `schedule.ts`, `dashboard.ts`,
plus `coaches.ts` for the coach RPC. Every module: uses
`getServerSupabaseClient()` (authenticated, cookie-scoped, RLS-
enforcing) rather than the service-role/admin client; accepts a
`studentId` parameter that only ever originates from
`getCurrentStudent()`; selects only the columns the page needs; and
returns a `StudentQueryResult<T>` rather than throwing a raw Supabase
error into a Server Component.

## Student query result architecture

`src/lib/portal/queryResult.ts` defines `StudentQueryResult<T>` —
`{ ok: true; data: T } | { ok: false; code: "DATABASE_UNAVAILABLE" |
"UNKNOWN" }` — plus `studentQueryOk`/`studentQueryUnavailable`/
`studentQueryUnknownError` constructors. It's a separate, narrower type
from Phase 10's `AdminQueryResult<T>` and deliberately doesn't import
from `src/lib/admin` — the student portal and the admin operations
console are kept decoupled so a future change to one's result shape
can't silently affect the other.

## Student RLS migration

`supabase/migrations/0016_student_portal_rls.sql` is the first
migration after Phase 10's `0015_admin_indexes.sql` and the first
relationship-scoped (not deny-by-default) RLS in the project. It does
not edit any previously applied migration.

## Student RLS policies

Policies added (all `authenticated`, all `SELECT`-only):

- `students_select_own` on `students` — `profile_id = auth.uid()`.
- `student_program_enrollments_select_own` — `student_id =
  current_student_id()`.
- `batch_enrollments_select_own` — `student_id = current_student_id()`.
- `batches_select_for_own_student` — an `EXISTS` check against both
  `batch_enrollments` and `student_program_enrollments` linkage paths.
- `class_schedules_select_for_own_batches` — same dual-path `EXISTS`
  pattern, scoped through `batch_id`.
- `batch_coaches_select_for_own_batches` — same dual-path pattern;
  justified because `batch_coaches` itself only holds
  `batch_id/coach_id/role/assigned_at/ended_at`, no contact fields.

No policy grants a STUDENT broad SELECT-all on `students`, `parents`,
`coaches`, `batches`, or any enrollment table, and no INSERT/UPDATE/
DELETE policy exists for STUDENT anywhere — Phase 11's portal is
read-only end to end. `programs` and `academy_locations` need no new
policy: Phase 7's migration `0010_rls_policies.sql` already grants
`anon, authenticated` a `active = true` SELECT policy on both, which
Phase 11 reuses as-is (documented here as the reconciliation the spec
asked for).

## auth.uid() ownership chain

Verified directly from `src/lib/auth/getCurrentProfile.ts`, which
queries `profiles` via `.eq("id", user.id)` where `user.id` is
`auth.uid()` — i.e., `profiles.id === auth.uid()` by construction, not
by convention. Every Phase 11 RLS policy and the `current_student_id()`
helper build on this single verified hop plus the second hop,
`students.profile_id = auth.uid()`. Nothing in Phase 11 uses
`student_code` or email for row ownership.

## RLS helper functions

`current_student_id()` — `SECURITY DEFINER`, `STABLE`, SQL, with
`SET search_path = public` (explicit, to prevent search-path
hijacking) — returns the calling user's own `students.id` or `NULL`.
`REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`
follows the same pattern as Phase 10's `record_admin_audit()`. Neither
helper function is a generic bypass — each only ever resolves data
tied to `auth.uid()`, never an arbitrary ID passed in as an argument.

## Coach privacy view/RPC decision

A SECURITY DEFINER RPC (`get_student_batch_coaches()`) was chosen over
a database view. A view over `coaches` joined to the ownership check
would still need `security_invoker` handling to avoid bypassing RLS,
and would still require excluding contact columns explicitly in its
`SELECT` list — at that point a narrow RPC is simpler to audit and
matches the existing `*_with_audit()` RPC pattern already used
elsewhere in the schema. See "Coach display privacy" above for the
exact returned shape.

## Location privacy decision

`academy_locations` contains no field more sensitive than address/name
(no personal contact data), so no separate view is needed — Phase 7's
existing `active = true` public policy already covers the read the
portal needs (a batch's location name/city). No Phase 11 migration
touches `academy_locations`.

## Database views created

None. Phase 11 uses the `get_student_batch_coaches()` RPC (see above)
rather than a view, and reuses Phase 7's `programs`/`academy_locations`
policies rather than introducing a `portal_dashboard_view` or similar
— this avoids the risk of a view accidentally being defined with
`security_invoker = false` (or the Postgres-version-dependent default)
and bypassing RLS.

## Student error states

`src/components/portal/student/StudentPortalState.tsx` is the single
component every portal error/empty state renders through. It supports:
`DATABASE_UNAVAILABLE`, `NOT_LINKED`, `ACCOUNT_RESTRICTED`, `UNKNOWN`,
`NO_PROGRAMS`, `NO_BATCHES`, `NO_SCHEDULE`. Each maps to a calm,
Phoenix-styled `{title, body}` pair; `NOT_LINKED`/`ACCOUNT_RESTRICTED`/
`NO_PROGRAMS`/`NO_BATCHES` interpolate `siteConfig.contact.email`/
`phone`. No copy mentions a table name, UUID, stack trace, or raw
Supabase error message anywhere.

## Student status presentation

`StudentStatusBadge` (`src/components/portal/student/
StudentStatusBadge.tsx`) is a new, generic tone-based badge — it does
not reuse the existing public `StatusBadge`, which is explicitly typed
against `TournamentStatus` and would mix unrelated semantics if forced
onto student/enrollment status. `studentStatusTone()` and
`enrollmentStatusTone()` map each status string to a tone
(positive/warning/neutral/negative); the badge always renders the
status text, never color alone.

## Components created

`StudentPortalShell`, `StudentPortalSidebarNav`,
`StudentPortalMobileNav`, `StudentStatusBadge`, `StudentPortalState` —
all under `src/components/portal/student/`. No component wraps a
single `<div>` with no added behavior; card-style layouts for programs/
batches/schedule are implemented inline in their respective pages
rather than as separate components, since each has only one call site
and no shared logic to extract yet.

## Components reused

`Logo`, `Container`, `cn()`, the skip-link pattern, and the general
Phoenix visual language (near-black/navy/gold/white, existing focus
ring utilities) are reused as-is from the public site and Phase 10's
admin shell. The portal does not duplicate the public `Navbar`/
`MobileNav` components — its navigation is entirely separate,
role-specific chrome.

## Private data caching decision

Student portal pages are ordinary dynamic Server Components — none
use `force-static`, `revalidate`, or any public caching mechanism.
`getCurrentStudent()`'s `cache()` wrapper is React's per-request
memoization: it exists only for the lifetime of one server request and
cannot leak one user's identity into another user's request. No
student data is cached across requests or users.

## Client data exposure audit

Only `StudentPortalMobileNav` is a Client Component (it needs
`useState`/keyboard handlers for the drawer); it receives only the
static nav item list, never student records. `StudentPortalSidebarNav`
is also a Client Component (for `usePathname()`-based active-link
styling) with the same narrow nav-only props. No student database row,
DOB, FIDE data, or contact field is ever passed to a Client Component,
placed in `localStorage`/`sessionStorage`, or included in a URL.

## Student portal SEO

Every `/portal/*` page sets `index: false` via `buildMetadata()`. This
was already true structurally from Phase 9 and is preserved.

## Sitemap audit

`src/app/sitemap.ts` was already confirmed (originally in Phase 9) to
exclude `/portal` from its static route list; no change was needed for
Phase 11's five new routes since none were ever added to the sitemap.

## Robots audit

`src/app/robots.ts` already disallows `/portal` in its `disallow`
array (from Phase 9); confirmed unchanged and still correct for all
five Phase 11 routes.

## Accessibility

Skip link (`#student-portal-main-content`) in the shell; semantic
`<nav>`/`<ul>`/`<li>` for both sidebar and mobile drawer; `aria-current`
on the active nav link; the mobile drawer uses `aria-expanded`,
`aria-controls`, `role="dialog"`, `aria-modal="true"`, moves focus to
the first link on open, restores focus to the trigger on close, closes
on Escape, and locks body scroll for the duration it's open (via a
`useEffect` toggling `document.body.style.overflow`). Status is always
communicated as visible text (via `StudentStatusBadge`'s label), never
color alone. All portal content uses real headings and semantic lists;
tables are not used since no page currently has genuinely tabular
multi-column data that needs one.

## Responsive QA

Layouts use existing Tailwind responsive utilities
(`sm:`/`lg:` grid breakpoints already present in the identity card and
profile field grids) consistent with the rest of the site's tested
breakpoints (375–1920px). No horizontal-overflow-prone fixed widths
were introduced; long values (FIDE IDs, batch codes) sit in flex/grid
cells that wrap rather than fixed-width boxes.

## Performance decisions

`getCurrentStudent()` is called once per request path (memoized via
`cache()`) despite being invoked in the layout and independently again
in every page. `getStudentDashboard()` runs its three underlying
queries with `Promise.all` rather than sequentially. No page fetches
data through a client-side `useEffect` — all data fetching happens in
Server Components before render.

## Database migrations created

- `supabase/migrations/0016_student_portal_rls.sql` — the RLS
  policies, `current_student_id()`, and `get_student_batch_coaches()`
  described above. No `0017` migration was needed — the one narrow RPC
  fit cleanly alongside the RLS policies in a single file.

## Supabase type updates

`src/lib/supabase/types.ts` gained `StudentBatchCoachRow` (the RPC's
return row shape) and a `get_student_batch_coaches` entry in
`Database.public.Functions`. Both are hand-written, narrow additions
in the same style as the rest of the file — not a claim that types
were generated from a live database. The file's header comment still
points to the future `npx supabase gen types typescript ...` command
as the eventual replacement path.

## Student PII exposure rules

Date of birth: profile page only, never in a URL, nav label,
analytics event, log line, or the dashboard. Email/phone/WhatsApp:
profile page's Contact Information section only, never in the global
shell (which shows only display name and student code). Coach contact
fields: never exposed anywhere in the student portal — only
`full_name` and `role` via the narrow RPC. No internal admin field
(`notes`, `profile_id`, timestamps) is selected by any student query
module in the first place.

## Portal unavailable behavior

If Supabase isn't configured, or a query throws, the affected page
renders `StudentPortalState code="DATABASE_UNAVAILABLE"` — a calm,
honest "not available right now" message with contact info, never a
stack trace or raw error string, and never a fabricated zero/empty
result presented as confirmed data.

## Phase 17 — Certificates + Achievements

`/portal/certificates` and `/portal/achievements` were added in Phase 17.
`get_student_certificates()`/`get_student_certificate()` are always scoped
to `current_student_id()` and additionally filter to
`status IN ('ISSUED', 'REVOKED')` — `DRAFT` certificates never reach this
portal. `get_student_achievements()`/`get_student_achievement()` filter to
`status IN ('PUBLISHED', 'ARCHIVED')`. Both new nav items were added to
`STUDENT_NAV_ITEMS` only because the routes genuinely exist. `NO_CERTIFICATES`/
`NO_ACHIEVEMENTS` were added to `StudentPortalStateCode`. See
`docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md` for the full certificate/
achievement domain model, RPC security, and privacy rules — this portal
never shows a Download/View PDF/QR/Verify control, since none of those
systems exist yet.

## Future attendance/progress/assignment/certificate integration

Attendance was built in Phase 14, progress evaluations in Phase 15, and
assignments in Phase 16, exactly along the lines this section anticipated:
`src/lib/queries/student/attendance.ts`,
`src/lib/queries/student/progress.ts`, and
`src/lib/queries/student/assignments.ts`, the existing
`StudentQueryResult<T>` type (unchanged), zero-argument or
single-argument RPCs (`get_student_attendance()`,
`get_student_progress_evaluations()`, `get_student_assignments()`,
`get_student_assignment(uuid)`) scoped through `current_student_id()`
(no direct table RLS SELECT policy was needed for any of them — see
`docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`,
`docs/STUDENT_PROGRESS_ARCHITECTURE.md`, and
`docs/ASSIGNMENTS_ARCHITECTURE.md`, "Read RPC Decision"/"Student Progress
Privacy"/"Student Assignment Privacy"), and new nav items added only once
each route genuinely existed. Certificate integration remains undesigned
and should follow the same pattern when eventually built.
