# Class Sessions + Attendance Architecture

Phase 14 introduces the first real dated class-event architecture:
`class_sessions` (dated occurrences) and `attendance_records` (one row
per session/student). It builds on the Phase 9 auth foundation, the
Phase 10 operational database, and the Coach/Student/Parent Portal
security patterns from Phases 11–13. This document covers the schema,
authorization, and privacy decisions specific to sessions and
attendance. See `docs/ADMIN_OPERATIONS_ARCHITECTURE.md` for the
underlying `batches`/`batch_coaches`/`batch_enrollments`/
`student_program_enrollments`/`class_schedules` tables this phase reuses
as-is, and `docs/COACH_PORTAL_ARCHITECTURE.md` /
`docs/STUDENT_PORTAL_ARCHITECTURE.md` / `docs/PARENT_PORTAL_ARCHITECTURE.md`
for the sibling systems this one extends.

## Recurring schedule vs. dated session distinction

This distinction is mandatory and enforced throughout the schema and
code:

- `class_schedules` (0012) — a recurring WEEKLY DEFINITION ("every
  Tuesday, 5:00–6:30 PM, Batch A"). Unchanged by Phase 14.
- `class_sessions` (0019, this phase) — a real, DATED OCCURRENCE
  ("2026-07-07, 5:00–6:30 PM, Batch A").

Attendance attaches only to `class_sessions`, never to
`class_schedules`. No existing `class_schedules` row is reinterpreted as
a historical record, and no batch job/cron auto-materializes
`class_schedules` rows into `class_sessions` — every session in Phase 14
is created one at a time by an explicit coach action.

## class_sessions schema

`supabase/migrations/0019_class_sessions_attendance.sql`: `id`,
`batch_id` (FK `batches`, cascade), `schedule_id` (FK `class_schedules`,
nullable, `set null` on delete — optional provenance only), `session_date`,
`start_time`, `end_time`, `timezone` (default `Asia/Kolkata`, same
convention as `class_schedules`), `status` (`session_status` enum),
`training_mode` (nullable per-session override of the batch's own mode),
`location_id` (nullable FK `academy_locations`), `topic` (nullable,
≤200 chars), `coach_notes` (nullable — column exists, no Phase 14 UI
writes to it, see "Coach Attendance Privacy Boundary"), `created_by`
(nullable FK `profiles`), `created_at`/`updated_at`, `cancelled_at`/
`cancelled_by` (both null unless `status = 'CANCELLED'`, enforced by a
check constraint). No student attendance summary JSON, no parent/coach
contact fields, no payment data, no meeting passwords/credentials exist
on this table.

## Session status enum

`public.session_status`: `SCHEDULED`, `COMPLETED`, `CANCELLED` — real
database enum values, `SCREAMING_CASE` matching every other Phase 10
enum. Deliberately excludes `LIVE`/`ONGOING`/`MISSED`/`ABSENT`/`PRESENT`
— the first two aren't tracked at all in Phase 14, and the last two are
attendance concepts, not session concepts. `COMPLETED` is never inferred
from `session_date`/`end_time` passing — it is set only by an explicit
"Mark Session Completed" coach action.

## Session time validation

`class_sessions_time_range_check` (`end_time > start_time`) enforced at
the database level, identically to `class_schedules`'s own constraint.
`createClassSessionSchema` (`src/lib/validation/classSession.ts`) also
Zod-validates `endTime > startTime` server-side before the insert is
ever attempted — belt-and-suspenders, not a substitute for the DB
constraint. No zero-duration session is possible at either layer, and
neither layer silently swaps start/end times if submitted backwards —
both simply reject.

## Session uniqueness rule

`class_sessions_uniqueness_idx`, a unique index on
`(batch_id, session_date, start_time, end_time)`. This blocks an exact
duplicate session (same batch, same date, same start AND end time) but
deliberately does NOT use `topic` as part of the uniqueness key, and
deliberately allows more than one session for the same batch on the same
date as long as their times differ (e.g. a normal slot plus a separate
makeup slot later that day) — matching the spec's explicit instruction
not to block legitimate multiple same-day sessions.

## attendance_records schema

One row per `(session_id, student_id)`, enforced by the
`attendance_records_session_student_key` unique constraint: `id`,
`session_id` (FK `class_sessions`, cascade), `student_id` (FK `students`,
cascade), `status` (`attendance_status` enum), `marked_by` (FK
`profiles`, never null — always the marking coach's own profile id),
`marked_at`, `notes` (nullable, ≤500 chars, enforced by a check
constraint), `created_at`/`updated_at`. No JSON summary blob, no
parent/coach contact fields, no payment fields, no meeting
passwords/credentials.

## Attendance status enum

`public.attendance_status`: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED` — the
only four persisted values. No ambiguous values were added since none
are required by any confirmed Phoenix data.

## NOT_MARKED decision

`NOT_MARKED` is never a database value — it does not appear in the
`attendance_status` enum at all. A missing `attendance_records` row for
an eligible student means "Not Marked," full stop. `NOT_MARKED` exists
only as a UI-only display label (`AttendanceDisplayStatus` in
`src/components/portal/AttendanceStatusBadge.tsx`) computed by the
absence of a row — it is never written to the database, and no code path
anywhere fabricates an `attendance_records` row just to represent "not
marked."

## Attendance eligibility

A coach may mark attendance only for a student legitimately connected to
the session's batch — via `batch_enrollments` OR
`student_program_enrollments.batch_id`, the same dual-path relationship
`get_coach_batch_roster()` (Phase 13) already established, now made
session-date-aware (see next section). Authorization never derives from
student code, student name, program alone, location, or current level —
only from the student actually being connected to the batch on the
session's date.

## Historical roster decision

`session_eligible_student_ids(target_batch_id, target_session_date)`
(`supabase/migrations/0020_attendance_rls.sql`) implements the
time-aware eligibility rule:

- `batch_enrollments`: eligible if `assigned_at::date <= session_date`
  AND (`ended_at is null` OR `ended_at::date >= session_date`).
- `student_program_enrollments` (with `batch_id`): eligible if `status
  NOT IN ('WITHDRAWN', 'CANCELLED')` AND `enrolled_on <= session_date`
  AND (`completed_on is null` OR `completed_on >= session_date`).

`WITHDRAWN`/`CANCELLED` program enrollments are excluded outright rather
than date-checked against some inferred "ended on" date — neither status
has a precise ending-date column in the Phase 10 schema, and this
project does not fabricate one. This is a documented, deliberate,
conservative limitation: a student withdrawn from a program enrollment
on the very day of a session may be treated as ineligible for that
session even if they attended earlier that day; Phase 14 has no data to
distinguish that case, and the spec explicitly calls for the
conservative choice over fabricating historical membership.

## Dual-path roster decision

Both `session_eligible_student_ids()` and every RPC that uses it
(`get_coach_session_attendance()`, `mark_session_attendance()`,
`get_student_attendance()`, `get_parent_student_attendance()`)
`UNION` the two eligibility paths above, which naturally deduplicates by
`student_id` — a student connected via both paths is never counted or
returned twice.

## Coach session authorization

A coach may manage a `class_sessions` row only when: the authenticated
user resolves to `COACH` (via `getCurrentCoach()`), the coach's business
record exists and its status permits portal access, AND `batch_coaches`
contains a current (`ended_at is null`) assignment for that coach and the
session's `batch_id`. Never authorized by `session.created_by`, by
knowing the session UUID, by knowing the batch UUID, or by
program/location. See `src/lib/coach/sessionAuthorization.ts` and
`supabase/migrations/0020_attendance_rls.sql`'s
`class_sessions_select_for_assigned_coach` policy — the same
`coach_has_batch()` boundary Phase 13 established, reused as-is.

## Session enumeration protection

`getAssignedSession(sessionId)` issues an ordinary authenticated SELECT
and lets the `class_sessions_select_for_assigned_coach` RLS policy decide
what comes back — invalid UUID, nonexistent session, and a real session
on a batch the coach is not (or is no longer) assigned to all collapse
into the same empty result, and every caller renders `notFound()`
identically for all three. There is no "access denied for session
{date}" message and no code path that reveals a session's batch/date/
time/status before authorization succeeds.

## Coach session routes created

`/coach/sessions` (list), `/coach/sessions/new` (create), `/coach/sessions/[sessionId]`
(detail + status actions), `/coach/sessions/[sessionId]/attendance`
(marking), and the contextual `/coach/batches/[batchId]/sessions`. No
`/coach/sessions/[sessionId]/edit` route exists — the only mutations
available on the detail page are the two narrowly-scoped status actions
(Server Actions), never a generic edit form.

## Coach navigation update

`COACH_NAV_ITEMS` (`src/config/coachPortalNavigation.ts`) gained "Class
Sessions" (`/coach/sessions`) as its fourth and final global item.
Attendance is NOT a global nav item — it is reached only from a specific
session's detail page, since it is contextual to one session, not a
batch or the portal generally.

## Batch context navigation update

`getCoachBatchContextNav(batchId)` gained a fourth item, "Class
Sessions" (`/coach/batches/{batchId}/sessions`), alongside
Overview/Students/Class Schedule. No Attendance entry was added here
either, for the same contextual reason.

## Coach session list

`/coach/sessions` groups every session on an assigned batch by real
`status` — "Scheduled Sessions" / "Completed Sessions" / "Cancelled
Sessions" — rather than any date-derived "Upcoming"/"Next" heading.
Although real dated `session_date` values now exist and would make
date-aware labels technically possible, Phase 14 deliberately keeps
status-based headings only, per the spec's explicit preference not to
overbuild calendar intelligence this phase. Each card shows date,
start/end time, timezone, batch, program, training mode, location (if
configured), and status — never another coach's unassigned sessions,
never student/parent PII, never internal profile IDs.

## New session page

`/coach/sessions/new` renders `ClassSessionForm`, whose batch `<select>`
is populated only from `listCoachBatches()` (itself `batch_coaches`-
scoped). Fields: Assigned Batch, Session Date, Start Time, End Time,
Timezone, Training Mode (optional override), Topic (optional). No
`coach_notes` field exists on this form (see "Coach Attendance Privacy
Boundary" — deliberately not implemented this phase). No `coachId`/
`createdBy` field exists; the Server Action always derives both
server-side. An optional `?batchId=` query param only preselects the
`<select>` default when it matches one of the coach's own resolved
batches — it is never trusted as authorization.

## Session creation validation

`src/lib/validation/classSession.ts`'s `createClassSessionSchema`
validates `batchId` (UUID), `sessionDate` (date shape), `startTime`/
`endTime` (non-empty, `endTime > startTime`), `timezone` (non-empty,
≤64 chars), `trainingMode` (real enum or empty), `locationId` (UUID or
empty), and `topic` (≤200 chars). After validation passes,
`createClassSession()` (`src/lib/actions/coach/sessions.ts`)
re-authorizes the submitted `batchId` through `getAssignedBatch()` —
exactly as required — before ever calling `.insert()`. No hidden field
is trusted; a malicious `batchId` the coach's own `<select>` never
offered is still rejected server-side (both by this re-authorization
step and, as a backstop, by the `class_sessions_insert_for_assigned_coach`
RLS `WITH CHECK`).

## Session creation write security

The RLS `INSERT` policy (`class_sessions_insert_for_assigned_coach`)
requires both `coach_has_batch(batch_id)` and `created_by = auth.uid()`
in its `WITH CHECK` clause. The authenticated (anon-key, RLS-enforced)
Supabase server client is used for this insert — never the service-role
client. `status` is never part of the insert payload (always defaults to
`SCHEDULED` at the database level), and `cancelled_at`/`cancelled_by` are
never part of it either.

## Recurring schedule prefill decision

Deferred entirely in Phase 14. The spec explicitly permits deferring
schedule-based prefill "if this adds unnecessary complexity" and
documenting the decision — given the size of this phase and the risk of
subtly mis-validating a `scheduleId` that must itself be re-checked
against `batch_coaches`, Phase 14 does not implement a `scheduleId` query
param or any recurring-schedule-derived defaults. A coach creating a
session fills in every field directly. This can be added in a future
phase without a migration — `class_sessions.schedule_id` already exists
as an optional provenance column for exactly this purpose.

## Class session detail

`/coach/sessions/[sessionId]` re-authorizes via `getAssignedSession()` on
every request, then shows: session date, start/end time, timezone,
status, batch, program, training mode, location, topic (if configured),
an attendance summary derived from `get_coach_session_attendance()`
(Eligible/Marked/Present/Absent/Late/Excused/Not Marked counts — see
"Attendance Summary Architecture" below), and a link to Mark/Update
Attendance. `coach_notes` is never rendered on this page (see "Coach
Attendance Privacy Boundary" — not implemented this phase at all, for
any viewer).

## Session status transitions

The only two allowed transitions are `SCHEDULED → COMPLETED` and
`SCHEDULED → CANCELLED`, both implemented as narrowly-scoped Server
Actions (`completeClassSession()`/`cancelClassSession()` in
`src/lib/actions/coach/sessions.ts`) calling the
`transition_class_session_status()` RPC. No arbitrary status dropdown
exists anywhere in the Coach Portal. `COMPLETED → SCHEDULED`,
`CANCELLED → SCHEDULED`, `COMPLETED → CANCELLED`, and
`CANCELLED → COMPLETED` are all rejected as `INVALID_TRANSITION` — there
is no admin correction path for these in Phase 14. The RPC conditions
its `UPDATE` atomically on `status = 'SCHEDULED'` in the same statement's
`WHERE` clause (not just an earlier `IF` check), so two concurrent
transition attempts cannot both succeed — the browser-submitted "current
status" is never trusted; the RPC always re-reads it itself.

## Cancelled session behaviour

A `CANCELLED` session cannot receive new attendance records and cannot
have its existing attendance records updated through the Coach Portal —
`mark_session_attendance()` explicitly rejects any call against a
cancelled session (`SESSION_CANCELLED`). The Coach Portal's own
attendance-marking page (`/coach/sessions/[sessionId]/attendance`)
refuses to render the marking form at all for a cancelled session,
showing `CoachPortalState code="SESSION_CANCELLED"` instead. Student and
Parent Portal attendance views show "Session Cancelled" for such a
session and never interpret the (necessarily) missing attendance row as
an absence.

## Completed session behaviour

Marking a session `COMPLETED` never automatically marks any missing
student `ABSENT`. No trigger, RPC side-effect, or application code
anywhere creates an `attendance_records` row as a side effect of a status
transition. A coach must explicitly mark each student — "no row" simply
continues to mean "Not Marked" after completion, exactly as before it.

## Attendance marking page

`/coach/sessions/[sessionId]/attendance` authorizes the session first via
`getAssignedSession()`, refuses to render for a `CANCELLED` session (see
above), and otherwise renders one row per session-date-eligible student
from `get_coach_session_attendance()` — never an academy-wide student
list, never another batch's students. Shown fields: student name, code,
current level (if configured), existing attendance status, existing note
(if present). Never shown: DOB, address, email, phone, WhatsApp, parent
details, FIDE rating, or payment information.

## Attendance form architecture

`AttendanceMarkingForm` (`src/components/portal/coach/
AttendanceMarkingForm.tsx`) is a single Client Component form covering
every eligible student in one submission — not one Server Action call
per student, and not a client-side state-management library (plain
`useState`/`useTransition`). Only students the coach explicitly sets a
status for are included in the submitted payload; a student left
untouched is simply omitted (their existing status, if any, is
unaffected). Each student's controls are wrapped in a `<fieldset>`/
`<legend>` with labelled radio-style buttons (visually styled `<label>`+
`sr-only <input type="radio">` pairs, never color-only communication)
plus an optional, length-limited note field.

## Attendance upsert decision

The submission always goes through `mark_session_attendance()`
(`supabase/migrations/0020_attendance_rls.sql`), which upserts via
`INSERT ... ON CONFLICT (session_id, student_id) DO UPDATE`, preserving
the one-row-per-session-per-student invariant. Before any write happens,
the RPC: verifies the coach/session/batch relationship, verifies the
session is not `CANCELLED`, validates every submitted entry's shape/UUID/
enum/note-length and rejects duplicate student IDs within the same
payload, and verifies every submitted student is session-date-eligible
for the session's batch. The server never trusts the submitted student
list at face value — eligibility is always re-derived from
`session_eligible_student_ids()`, never merely checked against whatever
the client happened to send.

## Bulk attendance RPC

`mark_session_attendance(target_session_id, attendance_payload)` —
`SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL FROM PUBLIC`,
`GRANT EXECUTE TO authenticated` only. Resolves the caller's coach
identity via `current_coach_id()`, verifies `coach_has_batch()`, rejects
a payload against a `CANCELLED` session, validates the JSON array shape
(non-empty, ≤500 entries), validates every entry, verifies eligibility,
and only then upserts atomically. `marked_by` is always `auth.uid()`;
`marked_at`/`updated_at` are always `now()` — neither is ever accepted
from the payload, and neither is `coach_id`, `parent_id`, or `batch_id`
(the batch is derived from the session, never passed in directly).
Returns only the number of rows upserted — no student PII in the
response.

## Atomic rejection behaviour

Validation and eligibility checks happen in two full passes over the
payload BEFORE any `INSERT`/`UPDATE` statement runs. If validation fails,
or even one submitted student is outside the session-date-eligible
roster, the function raises an exception and the entire call is rolled
back — nothing is written. There is no code path that marks the
authorized students in a mixed authorized/unauthorized submission while
silently dropping the rest; the whole submission either succeeds
completely or fails completely.

## Attendance notes privacy

Notes are operational data, length-limited to 500 characters at both the
database (`attendance_records_notes_length_check`) and Zod
(`attendanceEntrySchema`) layers. The UI's helper text says "Use a short
attendance-related note only" and does not encourage collecting medical
diagnoses, government IDs, payment details, or credentials. Student and
Parent Portal attendance views never render `attendance_records.notes` —
neither `get_student_attendance()` nor `get_parent_student_attendance()`
selects that column at all. Only the Coach Portal's own attendance
views (`get_coach_session_attendance()`) return it, since a coach needs
to see the note they themselves use operationally.

## Coach attendance privacy boundary

Beyond the notes boundary above: `class_sessions.coach_notes` exists as a
column (for a future coach-notes feature) but has no Phase 14 UI editor
at all — no page reads or writes it, for any role. This is a deliberate
scope decision (the spec explicitly prefers not implementing coach notes
UI this phase) rather than an oversight.

## Attendance summary architecture

Computed entirely in the coach session-detail page from
`get_coach_session_attendance()`'s already-resolved rows: `Eligible`
(row count), `Marked` (rows with a non-null `attendance_status`),
`Present`/`Absent`/`Late`/`Excused` (counts per status), and `Not Marked`
(`Eligible - Marked`, never a separate query). No percentage is ever
computed — the spec notes Phase 14 does not need attendance percentages,
and this project does not fabricate a denominator-ambiguous stat that
wasn't asked for.

## Student attendance route

`/portal/attendance` — added to `STUDENT_NAV_ITEMS` as "Attendance." Uses
`getCurrentStudent()` for identity and `getStudentAttendance()` (wrapping
the zero-argument `get_student_attendance()` RPC) for data — no
`studentId` is ever accepted from the browser. Sessions are grouped by
status ("Scheduled Sessions"/"Recent Sessions"/"Cancelled Sessions"),
each showing date, batch, start/end time, timezone, session status, and
attendance status (or "Not Marked"/"Session Cancelled" as appropriate).
Never shown: attendance notes, other students, coach contact details,
parent data.

## Student attendance privacy boundary

`get_student_attendance()` is a zero-argument `SECURITY DEFINER` function
always scoped to `current_student_id()` internally — there is no
`student_id` parameter anywhere in this path for a client to manipulate.
No direct RLS `SELECT` policy exists on `class_sessions` or
`attendance_records` for `STUDENT` at all (see "Read RPC Decision"
below) — the RPC is the only read path, and it never selects
`attendance_records.notes`.

## Parent attendance route

`/parent/students/[studentId]/attendance` — added to
`getParentStudentContextNav()` as "Attendance." Every request first calls
`getLinkedStudent()` (the same enumeration-protection contract every
other linked-student route uses — `notFound()` for invalid/nonexistent/
unlinked student IDs), then queries `getParentStudentAttendance()`.
Shows date, batch, start/end time, timezone, session status, attendance
status — never notes, coach notes, other students, coach contact
details, or internal IDs.

## Parent attendance privacy boundary

Authorization derives exclusively from `student_parents` via
`parent_has_student()` — never from email/phone/surname matching, and
never from `is_primary`/`can_manage_student` (a non-primary guardian sees
their linked student's attendance exactly like a primary guardian does,
matching the Phase 12 "Parent Relationship Flag Decision"). No direct
RLS `SELECT` policy exists on `class_sessions`/`attendance_records` for
`PARENT` either — `get_parent_student_attendance()` is the only path,
authorization enforced inside the function body, not by the caller.

## Coach session query architecture

`src/lib/queries/coach/sessions.ts` (`listCoachSessions()`,
`listCoachBatchSessions(batchId)`) and `src/lib/queries/coach/
attendance.ts` (`getCoachSessionAttendance(sessionId)`), plus
`src/lib/coach/sessionAuthorization.ts` (`getAssignedSession(sessionId)`).
All use the authenticated Supabase server client, never the service-role
client, and never accept a coach identity from a Client Component.
`listCoachSessions()` relies entirely on the
`class_sessions_select_for_assigned_coach` RLS policy (no `coach_id`
column exists on `class_sessions` to filter by directly) — the same
reliance-on-RLS pattern Phase 13 already used for
`batches_select_for_assigned_coach`.

## Coach attendance query architecture

See "Coach Session Query Architecture" above —
`getCoachSessionAttendance()` wraps the `get_coach_session_attendance()`
RPC and is the only place Coach Portal code ever needs student PII for
an attendance-marking context.

## Student attendance query architecture

`src/lib/queries/student/attendance.ts` — `getStudentAttendance()` wraps
the zero-argument `get_student_attendance()` RPC via `getCurrentStudent()`
for identity. No `studentId` parameter exists in this module at all.
Returns `StudentQueryResult<StudentAttendanceRow[]>`, never a full
session or attendance row.

## Parent attendance query architecture

`src/lib/queries/parent/attendance.ts` — `getParentStudentAttendance(studentId)`
wraps `get_parent_student_attendance(target_student_id)`. The calling
page always authorizes via `getLinkedStudent()` first; this query module
is the second, independent authorization layer (enforced inside the RPC
via `parent_has_student()`), not the only one. No service-role client is
used.

## Query/action result architecture

Reuses each portal's existing per-query result type
(`CoachQueryResult<T>`/`StudentQueryResult<T>`/`ParentQueryResult<T>`)
unchanged for reads. For Coach Portal MUTATIONS (new in Phase 14), a
separate `CoachActionResult<T>` (`src/lib/coach/actionResult.ts`) was
added with its own code union: `VALIDATION_ERROR`,
`DATABASE_UNAVAILABLE`, `NOT_AUTHORIZED`, `SESSION_NOT_FOUND`,
`SESSION_CANCELLED`, `INVALID_TRANSITION`, `UNKNOWN`. GET-style
enumeration-sensitive routes continue to use `notFound()`; POST-style
Server Action failures return this safe, coded result — never a raw
Supabase/Postgres error string.

## Session RLS

`class_sessions_select_for_assigned_coach` (SELECT, `coach_has_batch(batch_id)`)
and `class_sessions_insert_for_assigned_coach` (INSERT, `coach_has_batch(batch_id)
AND created_by = auth.uid()`). No UPDATE or DELETE policy exists for
`class_sessions` for any role — status transitions go exclusively
through `transition_class_session_status()` (see "Direct Table Write
Decision" below). No STUDENT or PARENT policy exists on `class_sessions`
at all (see "Read RPC Decision").

## Attendance RLS

`attendance_records_select_for_assigned_coach` (SELECT, scoped through a
join back to `class_sessions` + `coach_has_batch()`). No INSERT/UPDATE/
DELETE policy exists for `attendance_records` for any role — every write
goes exclusively through `mark_session_attendance()`. No STUDENT or
PARENT policy exists on `attendance_records` at all.

## Session status RPC

`transition_class_session_status(target_session_id, target_status)` —
see "Session Status Transitions" above for the full behavioral
contract. `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL
FROM PUBLIC`, `GRANT EXECUTE TO authenticated` only.

## Attendance RPC

`mark_session_attendance(target_session_id, attendance_payload)` — see
"Bulk Attendance RPC" above.

## Read RPC decisions

Four narrow, `SECURITY DEFINER` read RPCs replace what would otherwise
require complex, hard-to-share row-level policies:

- `session_eligible_student_ids(batch_id, session_date)` — internal-only
  (NOT granted to `authenticated`), since it returns real student UUIDs
  for an arbitrary batch and would otherwise let any authenticated user
  enumerate a batch's membership.
- `get_coach_session_attendance(session_id)` — the coach's
  roster+attendance merge, granted to `authenticated`, authorization
  enforced via `coach_has_batch()` inside the function.
- `get_student_attendance()` — zero-argument, scoped to
  `current_student_id()`.
- `get_parent_student_attendance(student_id)` — scoped via
  `parent_has_student()` inside the function.

This mirrors Phase 13's own reasoning for `get_coach_batch_roster()`:
RLS is row-level, not column-level, so a direct `SELECT` policy on
`students`/`attendance_records` would expose every column on a
qualifying row regardless of what the UI selects. Narrow RPCs let each
role see exactly the columns their privacy boundary allows — most
importantly, that `attendance_records.notes` never reaches a Student or
Parent Portal RPC at all.

## auth.uid() ownership chains

Unchanged, reused chains: `profiles.id = auth.uid()` →
`coaches.profile_id = auth.uid()` → `coaches.id` (`current_coach_id()`,
0018); `profiles.id = auth.uid()` → `students.profile_id = auth.uid()` →
`students.id` (`current_student_id()`, 0016); `profiles.id = auth.uid()`
→ `parents.profile_id = auth.uid()` → `parents.id`
(`current_parent_id()`, 0017). Phase 14 adds no new ownership chain — it
only adds a second-hop relationship check (`coach_has_batch()`) reused
from 0018, and reuses `parent_has_student()` from 0017.

## Coach student PII boundary

`get_coach_session_attendance()` returns only `student_id`,
`student_code`, `full_name`, `current_level`, `attendance_status`,
`notes`, `marked_at` — never DOB, address, email, phone, WhatsApp, or
parent data, exactly matching Phase 13's `get_coach_batch_roster()`
boundary.

## Student attendance PII boundary

`get_student_attendance()` never selects `attendance_records.notes`
(coach-only), never another student's rows (scoped to
`current_student_id()` alone), and never a raw `class_sessions`/
`attendance_records` row shape — only the seven display columns needed.

## Parent attendance PII boundary

`get_parent_student_attendance()` never selects
`attendance_records.notes` either, and never any student besides the
one explicitly authorized via `parent_has_student()`.

## Attendance indexes

`class_sessions_batch_date_idx (batch_id, session_date)`,
`class_sessions_status_date_idx (status, session_date)`,
`attendance_records_student_idx (student_id)`. The unique index on
`(session_id, student_id)` already serves session_id-prefixed lookups,
so no separate `attendance_records(session_id)` index was added. No
speculative index unrelated to a real Phase 14 query path was created.

## Private data caching decision

Every new `/coach/sessions*`, `/portal/attendance`, and
`/parent/students/[studentId]/attendance` page is an ordinary dynamic
Server Component — none use `force-static`, `revalidate`, or any public
caching mechanism. `getCurrentCoach()`/`getCurrentStudent()`/
`getCurrentParent()`'s existing `cache()` wrappers remain
request-scoped-only, so Coach A's session data can never be served under
a cache key reusable by Coach B (and likewise for students/parents).

## PII rules

No coach email/phone/WhatsApp/specializations appear on any session or
attendance page. No student DOB/address/email/phone/WhatsApp/parent
names/parent contact/chess association ID/payment info appear on any
Coach, Student, or Parent Portal attendance surface. Attendance notes are
coach-only, everywhere, always.

## No automatic attendance

No code path anywhere marks `PRESENT`/`ABSENT`/`LATE`/`EXCUSED`
automatically based on session time, login, portal visit, schedule
existence, student enrollment alone, or a coach merely opening the
attendance page. A missing `attendance_records` row always means "Not
Marked" — this is enforced structurally (there is no trigger, no
default-attendance insert anywhere in either migration) rather than just
by convention.

## Admin architecture

No Admin Portal UI for sessions/attendance is built in Phase 14. The
existing Phase 10 admin server-only/service-role architecture remains
authoritative and continues to bypass RLS entirely for any future
full-operations UI; no dead Admin navigation link was added pointing at
a nonexistent sessions/attendance admin page.

## Future progress integration

Progress reports and evaluations remain entirely out of scope. A future
phase building them should extend this same pattern: a narrow query
module, its own result type, RLS/RPC scoped through the same
`coach_has_batch()`/`parent_has_student()`/`current_student_id()`
boundaries, and a new nav item only once its route genuinely exists.

## Future notifications integration

No push notifications, automated WhatsApp messages, or automated email
attendance alerts exist or are triggered by any Phase 14 code path. A
future phase adding these must not treat `batch_coaches`/roster access as
implicit authorization to contact a family — an explicit, separate
consent/authorization model will be needed, exactly as documented in
Phase 13's own deferred-risks list.
