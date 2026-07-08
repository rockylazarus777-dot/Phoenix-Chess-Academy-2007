# Assignments + Homework Architecture (Phase 16)

Phase 16 adds a coach-authored chess assignment and student-submission
system on top of the Coach Portal (Phase 13), Student Portal (Phase 11),
Parent Portal (Phase 12), Class Sessions/Attendance (Phase 14), and Student
Progress (Phase 15). This document is the authoritative reference for the
domain model, security architecture, and privacy boundaries introduced in
this phase. It complements, and does not replace,
`docs/COACH_PORTAL_ARCHITECTURE.md`, `docs/STUDENT_PORTAL_ARCHITECTURE.md`,
`docs/PARENT_PORTAL_ARCHITECTURE.md`,
`docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`, and
`docs/STUDENT_PROGRESS_ARCHITECTURE.md`.

## Assignment vs Submission Distinction

An **assignment** is coach-authored work ("Complete the following tactical
positions before Friday."). A **submission** is student-authored work for
exactly one assignment (a text explanation and/or a chess-study/reference
link). Submission content (`submission_text`/`submission_url`) is never
stored on the assignment row, and coach feedback (`coach_feedback`) is
never stored on the assignment row — both live only on
`assignment_submissions`. Progress evaluations (Phase 15) are never
reinterpreted as assignments; attendance (Phase 14) is never reinterpreted
as assignment completion. No assignment is ever automatically created from
a `class_session`, `class_schedule`, `student_progress_evaluation`,
`program`, or tournament — every assignment is explicitly authored by a
coach.

## Assignment Status Enum

`public.assignment_status`: `DRAFT`, `PUBLISHED`, `ARCHIVED`. Deliberately
excludes `ACTIVE`/`COMPLETED`/`OVERDUE`/`SUBMITTED`/`GRADED` — those are
either submission-status concepts (see below) or a derived UI state
(`OVERDUE`) that is never persisted here.

## Draft Assignment Semantics

`DRAFT` is a coach working copy. It is visible only under the Coach
Historical Read Rule and never reaches the Student Portal, the Parent
Portal, either read RPC (`get_student_assignments()`,
`get_parent_student_assignments()`), or any client payload destined for
Student/Parent. This is enforced at multiple layers: no direct RLS SELECT
policy for STUDENT/PARENT on any of the three assignment tables at all, and
both student/parent read RPCs filter `a.status in ('PUBLISHED', 'ARCHIVED')`
explicitly — DRAFT is never included in either `WHERE` clause.

## Published Assignment Semantics

`PUBLISHED` is visible to every student who is a recipient
(`assignment_recipients.student_id`) and to every parent linked to that
student via `student_parents`. Students may submit while the deadline rule
permits (see "Student Deadline Rule"). The authoring coach and any
currently-assigned coach may still view it under the Coach Historical Read
Rule.

## Archived Assignment Semantics

`ARCHIVED` is a historical, no-longer-active assignment. Existing
`assignment_recipients` and `assignment_submissions` rows are preserved
(no cascade delete, no data loss). Students and parents may continue to
view an archived assignment for which the student is a recipient — read
access is unaffected by archiving. New submissions and resubmissions are
blocked (`submit_assignment()` requires `status = 'PUBLISHED'`, so an
`ARCHIVED` assignment raises `ASSIGNMENT_NOT_PUBLISHED`).

## Assignment Audience Architecture

`public.assignment_audience_type`: `BATCH`, `STUDENT` only. Deliberately
excludes `ACADEMY`/`PUBLIC`/`PROGRAM`/`LOCATION`/`CUSTOM_GROUP` — Phase 16
does not support academy-wide or program-wide assignments. `BATCH`: the
assignment belongs to one batch; eligible students derive from legitimate
batch membership at publish time. `STUDENT`: the assignment belongs
directly to one student, authorized only through a batch the coach
currently manages.

## Assignment Audience Values

```
BATCH
STUDENT
```

## Assignment Audience DB Constraint

Enforced by `assignments_audience_consistency_check`:

```
(audience_type = 'BATCH'   and batch_id is not null and student_id is null)
or
(audience_type = 'STUDENT' and batch_id is not null and student_id is not null)
```

A `STUDENT` assignment requires **both** `student_id` and `batch_id` — the
`batch_id` on a direct student assignment represents the authorized
coach/student/batch context a direct assignment can never exist without. A
direct student assignment is never created without this authorization
context; this is mandatory and enforced at the database level, not just in
application code.

## Assignments Schema

(`supabase/migrations/0023_assignments_submissions.sql`)

```
id                     uuid primary key
title                  text not null           (<=200 chars, non-empty)
description            text not null           (<=3000 chars, non-empty)
instructions           text                    (<=5000 chars)
audience_type          assignment_audience_type not null
batch_id               uuid  references batches(id)
student_id             uuid  references students(id)
program_id             uuid  references programs(id)
session_id             uuid  references class_sessions(id) on delete set null
coach_id               uuid not null  references coaches(id)
status                 assignment_status not null default DRAFT
due_at                 timestamptz
allow_late_submission  boolean not null default false
created_by             uuid not null  references profiles(id)
published_at           timestamptz
published_by           uuid  references profiles(id)
created_at / updated_at timestamptz not null
```

`coach_id` is the business coach record; `created_by` is the authenticated
profile. Both are always server/RPC-derived from `auth.uid()` — never
accepted from browser input. A `assignments_published_consistency_check`
requires `published_at`/`published_by` to be both set exactly when
`status = 'PUBLISHED'`, mirroring the pattern used by
`student_progress_evaluations` (Phase 15) and `class_sessions`'
`cancelled_at`/`cancelled_by` (Phase 14).

## Assignment Text Limits

| Field | Limit |
|---|---|
| `title` | 200 |
| `description` | 3000 |
| `instructions` | 5000 |

Enforced at the database (`check` constraints), Zod
(`src/lib/validation/assignments.ts`), and RPC (`create_assignment`/
`update_assignment`) layers — three independent layers, not just one.

## Program Context Validation

`batches.program_id` is `NOT NULL` in this schema, so `program_id` on an
assignment is always derived from the assigned batch's own `program_id` —
never an independently selected, potentially unrelated program. Both
`create_assignment()` and `update_assignment()` validate any supplied
`target_program_id` against the batch's own `program_id` and raise
`VALIDATION_ERROR` on a mismatch, rather than silently coercing it — the
same "no partial/silent success" pattern established in Phase 14/15.

## Class Session Context Validation

`session_id` is optional provenance only, exactly like
`class_sessions.schedule_id`. If supplied, both `create_assignment()` and
`update_assignment()` verify the session belongs to the assignment's own
`batch_id` (`class_sessions.batch_id = target_batch_id`) before accepting
it — an arbitrary session UUID from another batch is never trusted. No
assignment is required to belong to a session, and no session completion
ever auto-creates an assignment.

## Due Date Architecture

`due_at` is optional and coach-chosen. It is never automatically
calculated from session date, batch schedule, program duration, or
publication date. When `due_at` is null, the UI displays "No deadline" —
never "Overdue" (`formatAssignmentDueDate()`,
`src/lib/portal/assignmentDates.ts`).

## Derived Overdue Decision

`OPEN`/`OVERDUE`/`CLOSED` are UI-only derived states
(`getAssignmentDerivedState()`, `src/lib/portal/assignmentDates.ts`) and
are never persisted as `assignment_status`. `OPEN`: `due_at` is null or
"now" is before/at `due_at`. `OVERDUE`: `due_at` has passed and the student
has no submission yet, but late submission is allowed. `CLOSED`: `due_at`
has passed, late submission is not allowed, and the student has no
submission — submission is blocked. These states are student-contextual:
the same `PUBLISHED` assignment can be `OPEN` for one student (already
submitted) and `OVERDUE` for another (no submission) — there is no global
overdue boolean on `assignments`.

## Assignment Recipient Architecture

A `PUBLISHED` assignment needs a stable student audience. Continuously
recalculating "who is currently in this batch" against a `PUBLISHED`
assignment would let a student who joins the batch next month inherit last
month's homework, and would make a student who has since left the batch
lose a legitimate historical assignment record. `assignment_recipients`
solves this by being written exactly once, atomically, at publish time,
and never recalculated afterward.

## Assignment_Recipients Schema

```
id             uuid primary key
assignment_id  uuid not null  references assignments(id) on delete cascade
student_id     uuid not null  references students(id)
assigned_at    timestamptz not null
created_at     timestamptz not null
```

Unique `(assignment_id, student_id)`.

## Audience Snapshot Decision

At publish time: for `BATCH` audience, `publish_assignment()` resolves the
current legitimate roster via the internal helper
`assignment_batch_roster_student_ids(target_batch_id)` (dual-path — a union
of `batch_enrollments` and `student_program_enrollments`, the bulk-list
counterpart to `student_in_batch_roster()` from Phase 15) and inserts one
recipient row per eligible student atomically (`insert ... select ... on
conflict do nothing`). For `STUDENT` audience, the direct student/batch
relationship is re-verified (it may have changed since DRAFT creation) and
exactly one recipient row is inserted.

## Audience Drift Prevention

Student and Parent assignment read authorization derives exclusively from
`assignment_recipients` — never from live `batch_enrollments`/
`student_program_enrollments` membership. This means a student who joins a
batch after an assignment was published never inherits it, and a student
who has since left the batch retains their legitimate historical
assignment record. This is the single most important security property of
this table and is why it exists as a separate table rather than a live
join.

## Assignment Recipient Privacy

Students never query all `assignment_recipients` for an assignment — no
RLS SELECT policy exists for STUDENT on this table at all; the only access
path is through the narrow read RPCs (`get_student_assignments()`,
`get_student_assignment()`), each of which is already scoped to
`current_student_id()`. Parents may only resolve their linked student's
recipient rows, via `get_parent_student_assignments()`/
`get_parent_student_assignment()`, both scoped by `parent_has_student()`.
Coaches may view recipient state only for assignments visible under the
Coach Historical Read Rule (`assignment_recipients_select_for_coach`, a
join-scoped policy back to `assignments`).

## Submission Status Enum

`public.assignment_submission_status`: `SUBMITTED`, `REVIEWED`,
`REVISION_REQUESTED`. Deliberately excludes `DRAFT`/`PENDING`/`APPROVED`/
`FAILED`/`PASSED`/`GRADED` — Phase 16 implements no numeric or pass/fail
grading; coach review is qualitative only.

## Submission Status Semantics

`SUBMITTED`: the student has submitted work and it awaits coach attention.
`REVIEWED`: the coach has reviewed the submission (qualitative feedback
only, no pass/fail implication). `REVISION_REQUESTED`: the coach has asked
the student to revise and resubmit; `coach_feedback` is required in this
case. `NOT_SUBMITTED` is a UI-only label — "no row" already means "not
submitted," exactly like Attendance's `NOT_MARKED` convention from Phase
14 — and is never persisted.

## Assignment_Submissions Schema

```
id              uuid primary key
assignment_id   uuid not null  references assignments(id) on delete cascade
student_id      uuid not null  references students(id)
status          assignment_submission_status not null default SUBMITTED
submission_text text            (<=5000 chars)
submission_url  text            (http(s) only)
submitted_at    timestamptz not null
reviewed_at     timestamptz
reviewed_by     uuid  references profiles(id)
coach_feedback  text            (<=3000 chars)
created_at / updated_at timestamptz not null
```

Unique `(assignment_id, student_id)`.

## One Current Submission Decision

Phase 16 stores exactly one current submission row per
`(assignment_id, student_id)`, enforced by the unique constraint above. No
submission versioning or revision history exists in Phase 16 — a
resubmission updates the same row rather than creating a new version row.
This is a documented, deliberate limitation, not an oversight.

## Submission Content Requirement

`assignment_submissions_content_required_check` requires at least one of
`submission_text`/`submission_url` to carry real (trimmed, non-empty)
content — an empty submission is never allowed. Also validated in Zod
(`submitAssignmentSchema`) and inside `submit_assignment()` before any
write.

## Submission Text Limits

| Field | Limit |
|---|---|
| `submission_text` | 5000 |
| `coach_feedback` | 3000 |

Enforced at the database and Zod layers, and re-checked inside
`submit_assignment()`/`review_assignment_submission()` respectively.

## Submission URL Architecture

`assignment_submissions_url_protocol_check` requires
`submission_url ~ '^https?://'` — only `http:`/`https:` are ever accepted;
`javascript:`, `data:`, `file:`, and `ftp:` are all rejected at the
database level, re-validated in Zod (`/^https?:\/\//i`), and re-checked
inside `submit_assignment()`. The application never fetches, scrapes, or
generates a preview of this URL server-side, and never trusts it as safe
HTML. It is never embedded in an iframe. Every rendered submission URL
uses `target="_blank" rel="noopener noreferrer nofollow ugc"` and shows
the URL itself as descriptive link text.

## Chess Platform URL Decision

Phase 16 does not require a submission URL to come from Chess.com or
Lichess, and does not hardcode either provider. Any valid http/https
chess-study/reference URL is accepted. UI helper text reads "You may
include a chess study, game, or reference link." — the application never
claims integration with any specific chess platform.

## Coach Assignment Authorization

A coach may create an assignment only when: the authenticated role
resolves to `COACH`; the coach business record resolves
(`coaches.profile_id = auth.uid()`); `coaches.status = 'ACTIVE'`; the coach
currently manages the target batch (`coach_has_batch(target_batch_id)`);
and, for `STUDENT` audience, the target student is a current member of
that batch's roster (`student_in_batch_roster()`, reused from Phase 15).
Never authorized by student UUID knowledge, student code, student name,
program, location, email, or phone.

## Coach Historical Read Decision

Identical shape to `student_progress_evaluations` (Phase 15), applied
uniformly across `assignments`' RLS SELECT policy and every
`get_coach_*` read RPC:

```
assignment.coach_id = current_coach_id()
OR
coach_has_batch(assignment.batch_id)
```

This lets a coach retain access to their own authored assignment history
after their own batch assignment ends, and lets any coach currently
assigned to a batch read every assignment tied to that batch — including
another coach's — supporting continuity across PRIMARY/ASSISTANT/GUEST
handoffs.

## Coach Mutation Authorization

Stricter than the read rule. A coach may update/publish/archive an
assignment only when:

```
assignment.coach_id = current_coach_id()
AND
coach_has_batch(assignment.batch_id)
```

(plus status-specific rules per RPC below). Another assigned coach may
read the assignment for continuity but can never modify it — enforced
inside `update_assignment()`, `publish_assignment()`, and
`archive_assignment()` themselves, not just by the UI.

## Assignment Write Architecture

No broad Coach INSERT/UPDATE/DELETE policy exists on `assignments`,
`assignment_recipients`, or `assignment_submissions`. All writes go
exclusively through six narrow RPCs: `create_assignment`,
`update_assignment`, `publish_assignment`, `archive_assignment`,
`submit_assignment`, `review_assignment_submission`.

## Create Assignment RPC

`create_assignment(target_title, target_description, target_instructions,
target_audience_type, target_batch_id, target_student_id,
target_program_id, target_session_id, target_due_at,
target_allow_late_submission)` — `SECURITY DEFINER`,
`SET search_path = public`. Resolves `auth.uid()` → `current_coach_id()`,
verifies `coaches.status = 'ACTIVE'`, verifies
`coach_has_batch(target_batch_id)`, validates audience consistency (BATCH
requires no `student_id`; STUDENT requires a `student_id` verified via
`student_in_batch_roster()`), validates text lengths, validates
`target_program_id` against the batch's own `program_id`, validates
`target_session_id` belongs to the target batch, inserts the assignment as
`DRAFT` with server-derived `coach_id`/`created_by`/`program_id`. Returns
the new assignment UUID. `REVOKE ALL FROM PUBLIC` /
`GRANT EXECUTE TO authenticated`.

## Update Assignment RPC

`update_assignment(target_assignment_id, target_title, target_description,
target_instructions, target_program_id, target_session_id, target_due_at,
target_allow_late_submission)` — requires `assignment.coach_id = current
coach`, `coach_has_batch(assignment.batch_id)`, and `status = 'DRAFT'`
(raises `ASSIGNMENT_NOT_EDITABLE` otherwise). Never accepts or changes
`audience_type`/`batch_id`/`student_id`/`coach_id`/`created_by`/`status`/
`published_at`/`published_by` — none of those are parameters. If a coach
chose the wrong audience, the documented path is to archive the draft and
create a new assignment — this keeps authorization integrity simple
rather than allowing an audience/batch/student rewrite mid-lifecycle.

## Publish Assignment RPC

`publish_assignment(target_assignment_id)` — verifies
`assignment.coach_id = current coach`, `coach_has_batch(assignment.batch_id)`,
`status = 'DRAFT'`, and non-empty title/description. For `BATCH` audience,
resolves the current legitimate roster and rejects publication with
`NO_RECIPIENTS` if that roster is empty. For `STUDENT` audience,
re-verifies the direct student/batch relationship. Atomically transitions
`DRAFT → PUBLISHED`, setting `published_at = now()` and
`published_by = auth.uid()` server-side. Never allows `PUBLISHED →
DRAFT`, `ARCHIVED → PUBLISHED`, or `PUBLISHED → PUBLISHED`.

## Publish Recipient Snapshot Transaction

The entire `publish_assignment()` function body runs inside Postgres'
implicit per-function transaction. Any raised exception (most notably
`NO_RECIPIENTS`) rolls back every write made during that invocation,
including any `assignment_recipients` rows already inserted earlier in the
same call. There is no partial publish — recipient snapshot creation and
the `DRAFT → PUBLISHED` status transition succeed together or not at all.
The final status `UPDATE` is additionally conditioned atomically on
`status = 'DRAFT'` in its own `WHERE` clause, preventing a concurrent
double-publish race.

## Archive Assignment RPC

`archive_assignment(target_assignment_id)` — unlike
`student_progress_evaluations` (Phase 15, DRAFT-only archive), assignments
may be archived from either `DRAFT` or `PUBLISHED`. Requires
`assignment.coach_id = current coach` and
`coach_has_batch(assignment.batch_id)`. Never allows `ARCHIVED →`
anything. When a `PUBLISHED` assignment is archived, existing
`assignment_recipients` and `assignment_submissions` rows are preserved —
no cascade delete, no data loss; only new submissions/resubmissions are
blocked going forward (enforced inside `submit_assignment()`).

## Assignment Delete Decision

No Coach assignment deletion exists anywhere in Phase 16 — no delete RPC,
no Coach DELETE policy on any of the three tables. Archive is the only
lifecycle exit, preserving recipient history, submission integrity, and
review history.

## Coach Routes Created

```
/coach/assignments
/coach/assignments/new
/coach/assignments/[assignmentId]
/coach/assignments/[assignmentId]/submissions
/coach/assignments/[assignmentId]/submissions/[submissionId]
/coach/batches/[batchId]/assignments
```

No `/coach/students/[studentId]` route and no academy-wide assignment
administration UI.

## Coach Navigation Update

`COACH_NAV_ITEMS` gains a 6th item, "Assignments" → `/coach/assignments`,
because the route now exists. `getCoachBatchContextNav()` gains a 6th
item, "Assignments" → `${base}/assignments`. No "Homework"/"Submissions"/
"Grading" item is added as a separate global link — submissions are
contextual to one assignment, never a global list.

## Batch Context Navigation Update

Batch context nav is now Overview / Students / Class Schedule / Class
Sessions / Student Progress / Assignments — each added only because its
route exists.

## Coach Assignment List

`/coach/assignments` groups every assignment visible under the Coach
Historical Read Rule into Draft / Published / Archived sections. Shows
title, audience type, batch, student name only for `STUDENT` audience,
program if present, due date, status, author display name, and — for
non-DRAFT assignments — an explicit submission summary ("12 submitted / 20
recipients"), never a fabricated completion percentage. No student email/
phone/WhatsApp/address/DOB, parent data, or payment information.

## New Assignment Page

`/coach/assignments/new` follows the same two-step, server-rendered flow
established by `/coach/progress/new` (Phase 15): without a valid
`?batchId=`, the page shows the coach's own assigned batches; once
`batchId` is supplied and re-authorized via `getAssignedBatch()`, the page
resolves only that batch's roster (`getCoachBatchRoster()`) and that
batch's real class sessions (`listCoachBatchSessions()`) in parallel, and
hands both — narrow, batch-scoped — to `AssignmentForm`. No academy-wide
student or session fetch ever occurs. `coachId` is never accepted as a
form field or parameter.

## Assignment Detail

`/coach/assignments/[assignmentId]` calls `get_coach_assignment()`, which
applies the Coach Historical Read Rule internally; invalid UUID,
nonexistent assignment, and an assignment outside the read rule all render
`notFound()` identically. Shows title, description, instructions,
audience, batch, student (if direct), program, session (if present), due
date, late-submission rule, status, recipient count, submission count, and
published date. `coach_can_manage`/`coach_can_archive` booleans (returned
by the RPC) gate the Edit form, "Publish Assignment," and "Archive
Assignment" actions — no coach/profile UUID is ever fetched into the page
to make that determination client-side.

## Assignment Edit Architecture

No `/coach/assignments/[assignmentId]/edit` route exists — the edit form
(`AssignmentEditForm`) renders inline on the detail page, only when
`coach_can_manage && status === 'DRAFT'`. Every Server Action
(`updateAssignment`, `publishAssignment`, `archiveAssignment`) repeats
authorization independently rather than trusting the page's own gating;
client-side hidden fields are never treated as authority.

## Coach Submissions Page

`/coach/assignments/[assignmentId]/submissions` authorizes the assignment
first via `getCoachAssignment()`, then lists every `assignment_recipients`
row for that assignment merged with narrow submission state (student name,
code, status, submitted date, reviewed date, or "Not Submitted"). Never
shows student contact PII, parent details, attendance, progress
evaluations, or payment information; never infers "Lazy," "Incomplete," or
"Failed."

## Coach Submission Detail

`/coach/assignments/[assignmentId]/submissions/[submissionId]` calls
`get_coach_assignment_submission(assignmentId, submissionId)`, which
requires `submission.assignment_id = target_assignment_id` (route
resources must match each other) and assignment visibility under the Coach
Historical Read Rule; any mismatch or unauthorized combination renders
`notFound()`. Shows student name/code, assignment title, submission text/
URL, submitted date, current status, and coach feedback. The review form
(`SubmissionReviewForm`) renders only when `submission.coach_can_review` is
true — a continuity-only coach sees a read-only page and can never
overwrite the author's feedback.

## Coach Submission Review Architecture

Coach review is qualitative only — status (`REVIEWED`/
`REVISION_REQUESTED`) plus free-text `coach_feedback`. No numeric grade,
score, percentage, or pass/fail exists anywhere in the review flow. Two
explicit buttons, "Mark Reviewed" and "Request Revision" — never a generic
status dropdown — so the coach's intent is always unambiguous.

## Review Assignment Submission RPC

`review_assignment_submission(target_submission_id, target_status,
target_feedback)` — requires the submission's own assignment to have
`coach_id = current coach` (author-only, stricter than the read rule —
see "Coach Mutation Authorization") and `coach_has_batch(assignment.batch_id)`.
Coach may set only `REVIEWED` or `REVISION_REQUESTED` — never `SUBMITTED`
(rejected as `VALIDATION_ERROR`). `REVISION_REQUESTED` requires non-empty
feedback (`REVISION_FEEDBACK_REQUIRED` otherwise); `REVIEWED` permits
optional feedback. Sets `reviewed_at = now()` and
`reviewed_by = auth.uid()` server-side — never accepted as parameters.

## Student Assignment Routes

```
/portal/assignments
/portal/assignments/[assignmentId]
```

`STUDENT_NAV_ITEMS` gains an 8th item, "Assignments," because the route
now exists.

## Student Assignment List

`/portal/assignments` (`get_student_assignments()`) is a zero-argument RPC
always scoped to `current_student_id()` internally — no `studentId`
parameter exists anywhere in the module. Groups assignments into Revision
Requested / Open / Submitted / Reviewed / Archived. Shows title, batch,
program, due date, assignment status, and the student's own submission
status. A null `submission_status` renders as the UI-only "Not Submitted"
label. No completion percentage is ever fabricated.

## Student Assignment Detail

`/portal/assignments/[assignmentId]` — "knowing assignmentId is not
enough": `get_student_assignment()` requires an `assignment_recipients` row
for the current student, joined with `ar.student_id = current_student_id()`
in the same query, not a separate check. Shows title, description,
instructions, batch, program, session context if present, due date,
late-submission rule, assignment lifecycle state, the student's own
submission status/text/URL, and coach feedback if present. Never shows
other recipients, other submissions, other student names, coach contact
details, parent data, or internal IDs.

## Student Submission Authorization

A student may submit only when: the authenticated role resolves to
`STUDENT`; the current student business record resolves; an
`assignment_recipients` row exists for this student and assignment (never
derived from live batch membership); `assignment.status = 'PUBLISHED'`;
and the deadline rule permits (see below). Read access, once granted via
`assignment_recipients` at publish time, is preserved even if the student's
live batch membership later changes — a documented, deliberate limitation
of the snapshot-based read model (see "Audience Drift Prevention").

## Student Deadline Rule

If `due_at` is null: submission is permitted. If "now" is at or before
`due_at`: submission is permitted. If "now" is after `due_at` and
`allow_late_submission = true`: submission is permitted. If "now" is after
`due_at` and `allow_late_submission = false`: submission is blocked
(`DEADLINE_PASSED`). An `ARCHIVED` assignment always blocks submission
regardless of the deadline rule (`ASSIGNMENT_NOT_PUBLISHED`, since
`status <> 'PUBLISHED'`). This rule is validated server-side inside
`submit_assignment()` — the client-side `isAssignmentSubmissionDeadlinePassed()`
helper (`src/lib/portal/assignmentDates.ts`) only controls whether the
submission form is rendered at all; it is never the authoritative check.

## Student Resubmission Rule

No existing submission row → the initial submission is inserted as
`SUBMITTED`. If the current status is `REVISION_REQUESTED`, the student may
resubmit — this updates the same row: `submission_text`/`submission_url`
are replaced, `status` resets to `SUBMITTED`, `submitted_at = now()`, and
`reviewed_at`/`reviewed_by`/`coach_feedback` are all reset to null (the
previous feedback is not preserved once overwritten — see "One Current
Submission Decision"). If the current status is `SUBMITTED` or `REVIEWED`,
the student cannot edit — `submit_assignment()` rejects the call as
`SUBMISSION_NOT_EDITABLE`, so a student can never arbitrarily overwrite
already-submitted or already-reviewed work.

## Submit Assignment RPC

`submit_assignment(target_assignment_id, target_submission_text,
target_submission_url)` — resolves `auth.uid()` → `current_student_id()`,
loads the assignment, verifies an `assignment_recipients` row exists for
this student, verifies `status = 'PUBLISHED'` (raises
`ASSIGNMENT_NOT_PUBLISHED` otherwise — this covers the `ARCHIVED` case;
`DRAFT` can never reach this branch since a `DRAFT` assignment has no
recipients yet), validates the deadline/late-submission rule, validates the
content requirement, text length, and URL protocol, then either inserts a
new `SUBMITTED` row or updates the existing row (only from
`REVISION_REQUESTED`). `student_id`/`status`/`submitted_at`/`reviewed_by`/
`reviewed_at` are never parameters — all server-derived.

## Student Submission Privacy

A student may view only their own `assignment_submissions` row, exclusively
through `get_student_assignments()`/`get_student_assignment()` — no direct
RLS SELECT policy exists for STUDENT on `assignment_submissions` at all,
and no STUDENT mutation policy exists either, since `submit_assignment()`
is the sole authoritative write path.

## Parent Assignment Routes

```
/parent/students/[studentId]/assignments
/parent/students/[studentId]/assignments/[assignmentId]
```

`getParentStudentContextNav()` gains a 7th item, "Assignments," because
the route now exists.

## Parent Assignment Privacy

Every request resolves the current parent, authorizes the student through
`getLinkedStudent()` (`student_parents`-based) at the page level, then
retrieves assignments through `getParentStudentAssignments()`/
`getParentStudentAssignment()`, which independently re-verify
`parent_has_student(target_student_id)` inside the RPC itself — defense in
depth, not a replacement for the page-level check. Parents may view title,
description, instructions, batch, program, due date, assignment status,
the student's submission status, submitted text/URL, and coach feedback.
Parents may never submit, resubmit, edit, review, archive, or publish — no
parent mutation RPC exists anywhere in Phase 16. Parents never see other
recipients, other students, coach contact details, student contact data,
or payment data.

## Coach Assignment Query Architecture

`src/lib/queries/coach/assignments.ts` — `listCoachAssignments()`,
`getCoachAssignment(assignmentId)`, `listCoachBatchAssignments(batchId)`.
No `coachId` is ever accepted from a Client Component; every function
resolves the coach identity server-side via the underlying RPC.

## Coach Submission Query Architecture

`src/lib/queries/coach/submissions.ts` —
`listAssignmentSubmissions(assignmentId)`,
`getAssignmentSubmission(assignmentId, submissionId)`. Both wrap the
corresponding `get_coach_assignment_submission*` RPCs directly — no
additional client-side authorization logic exists, since the RPC is
already the authority.

## Student Assignment Query Architecture

`src/lib/queries/student/assignments.ts` — `getStudentAssignments()`,
`getStudentAssignment(assignmentId)`, both wrapping zero-argument or
single-argument RPCs scoped to `current_student_id()` internally. No
`studentId` browser input anywhere in this module.

## Parent Assignment Query Architecture

`src/lib/queries/parent/assignments.ts` —
`listParentStudentAssignments(studentId)`,
`getParentStudentAssignment(studentId, assignmentId)`. The page authorizes
the linked student first via `getLinkedStudent()`; the RPC independently
re-verifies the relationship. No service-role client is used anywhere in
this module.

## Read RPC Decisions

Nine read RPCs, each returning role-specific narrow columns rather than a
shared generic shape: `get_coach_assignments()`, `get_coach_assignment(uuid)`,
`get_coach_batch_assignments(uuid)`, `get_coach_assignment_submissions(uuid)`,
`get_coach_assignment_submission(uuid, uuid)`, `get_student_assignments()`,
`get_student_assignment(uuid)`, `get_parent_student_assignments(uuid)`,
`get_parent_student_assignment(uuid, uuid)`. None of the Student/Parent RPCs
ever return other recipient rows, other submissions, coach email/phone/
WhatsApp, internal profile IDs, `created_by`, `published_by`, or
`reviewed_by`.

## Assignment RLS

`assignments`: COACH gets a single SELECT policy
(`assignments_select_for_coach`) implementing the Coach Historical Read
Rule. No INSERT/UPDATE/DELETE policy exists for COACH — all writes go
through the six RPCs. STUDENT and PARENT get no direct SELECT policy at
all; access is exclusively through the narrow read RPCs.

## Assignment Recipient RLS

`assignment_recipients`: COACH gets a join-scoped SELECT policy
(`assignment_recipients_select_for_coach`) that re-checks the same Coach
Historical Read Rule against the parent `assignments` row — this table
carries no independent PII beyond `student_id`, so a join-scoped read is
safe. STUDENT and PARENT get no direct SELECT policy — both read this
table's effect only indirectly, through the narrow read RPCs' `WHERE`
clauses.

## Assignment Submission RLS

`assignment_submissions`: COACH gets a join-scoped SELECT policy
(`assignment_submissions_select_for_coach`), same shape as
`assignment_recipients`'. No STUDENT or PARENT SELECT policy, and no
mutation policy for any role — the six write RPCs are the sole write path.

## RPC Security

Every Phase 16 `SECURITY DEFINER` function: `SET search_path = public`,
resolves `auth.uid()`, resolves the caller's business identity
(`current_coach_id()`/`current_student_id()`), verifies the relevant
business relationship (never assumes role alone is sufficient), validates
every input, returns only narrow data, and is `REVOKE ALL FROM PUBLIC` /
`GRANT EXECUTE TO authenticated` only. The one internal helper
(`assignment_batch_roster_student_ids()`) is granted to no role beyond its
own `SECURITY DEFINER` execution context — it is never callable directly
by `authenticated`.

## Auth.uid() Ownership Chains

Every RPC resolves `auth.uid()` → `profiles.id` → the caller's business
record (`coaches`/`students`) → the specific relationship
(`batch_coaches`/`assignment_recipients`/`student_parents`) before any read
or write — no step trusts a client-supplied identifier as the source of
authority.

## Action Result Architecture

Two deliberately separate action-result types: `CoachAssignmentActionResult`/
`CoachAssignmentActionCode` (`src/lib/coach/assignmentActionResult.ts`) for
coach mutations (`VALIDATION_ERROR`/`DATABASE_UNAVAILABLE`/
`NOT_AUTHORIZED`/`ASSIGNMENT_NOT_FOUND`/`ASSIGNMENT_NOT_EDITABLE`/
`INVALID_TRANSITION`/`NO_RECIPIENTS`/`SUBMISSION_NOT_FOUND`/
`REVISION_FEEDBACK_REQUIRED`/`UNKNOWN`), and
`StudentAssignmentActionResult`/`StudentAssignmentActionCode`
(`src/lib/student/assignmentActionResult.ts`) for the student's one
mutation (`submitAssignment`) (`VALIDATION_ERROR`/`DATABASE_UNAVAILABLE`/
`NOT_AUTHORIZED`/`ASSIGNMENT_NOT_FOUND`/`SUBMISSION_NOT_ALLOWED`/
`SUBMISSION_NOT_EDITABLE`/`DEADLINE_PASSED`/`UNKNOWN`). The RPC raises the
precise `ASSIGNMENT_NOT_PUBLISHED` exception; the student-facing action
layer renames this to the user-actionable `SUBMISSION_NOT_ALLOWED` code —
reconciling the two overlapping-sounding codes from the original spec
without merging the two role-specific result types into one shared union.
No raw Supabase/Postgres/SQLSTATE/RPC exception text ever reaches the UI.

## Assignment Status Presentation

`AssignmentStatusBadge` (`src/components/portal/`) — DRAFT/PUBLISHED/
ARCHIVED, each with a tone and explicit text label. Deliberately its own
component, never reusing `ProgressEvaluationStatusBadge` — the two status
domains have genuinely different semantics.

## Submission Status Presentation

`AssignmentSubmissionStatusBadge` (`src/components/portal/`) — SUBMITTED/
REVIEWED/REVISION_REQUESTED plus the UI-only `NOT_SUBMITTED`
(`SubmissionDisplayStatus` type). Never labels `REVIEWED` as "Passed,"
"Approved," or "Successful." Text is always shown alongside tone/color —
never color alone.

## No Numeric Grading Audit

No marks, score, percentage, grade, GPA, rating, rank, or pass/fail column
exists on `assignment_submissions`. Coach review is entirely qualitative:
`status` (`REVIEWED`/`REVISION_REQUESTED`) plus free-text
`coach_feedback`.

## No Automatic Performance Audit

No code path anywhere in Phase 16 computes a completion percentage,
submission rate, on-time rate, or comparative ranking across students.
`get_coach_assignments()`/`get_coach_assignment()` return only explicit
counts (`recipient_count`, `submission_count`) — never a derived
percentage or "60% completed" label.

## No AI Content Audit

No assignment title, description, instructions, student submission
summary, or coach feedback is generated by an LLM anywhere in Phase 16. No
AI SDK was installed. No "Generate with AI" affordance exists. Every field
is authored manually by a coach or student.

## No File Upload Audit

Phase 16 intentionally does not support files. No storage bucket, R2
integration, upload route, presigned URL, file metadata table, or PDF/
image/PGN handling exists anywhere in this phase. Students submit text
and/or a URL only — file/media assignment work is deferred to a future
R2/media phase.

## Coach Student PII Boundary

Coach-facing assignment/submission views show only student name, code,
submission status, submitted/reviewed dates, submission text/URL, and
coach feedback — never student email, phone, WhatsApp, address, DOB,
parent data, attendance, progress evaluations, or payment information.

## Student Assignment PII Boundary

The student sees only their own submission and only assignments for which
they are a legitimate recipient — never other recipients, other
submissions, other student names, coach contact details, or parent data.

## Parent Assignment PII Boundary

Same shape as the student boundary, scoped to one linked student per
request via `student_parents`. Never shows other recipients, other
students, coach contact details, student contact data, or payment data.

## Private Data Caching Decision

All assignment/submission data is private. No route in Phase 16 uses
`force-static` or public revalidation. No Coach A assignment is ever cached
for Coach B, no Student A submission for Student B, and no Parent A
linked-student assignment for Parent B — every page is a per-request
authenticated Server Component; `React.cache()` (where used, e.g.
`getCurrentCoach()`/`getCurrentStudent()`/`getCurrentParent()`) is
request-scoped memoization only.

## Client Data Exposure Audit

No assignment/submission data is ever stored in `localStorage`,
`sessionStorage`, `IndexedDB`, or a `window` global, and no global client
store exists for it. No student name, student code, assignment title,
description, instructions, submission text, submission URL, coach
feedback, or coach name ever appears in a URL query string — the only
resource identifiers used as route parameters are `assignmentId`,
`submissionId`, `batchId`, and `studentId` (the last only in the
already-established parent linked-student route pattern).

## SEO

All nine new routes (`/coach/assignments`, `/coach/assignments/new`,
`/coach/assignments/[assignmentId]`,
`/coach/assignments/[assignmentId]/submissions`,
`/coach/assignments/[assignmentId]/submissions/[submissionId]`,
`/coach/batches/[batchId]/assignments`, `/portal/assignments`,
`/portal/assignments/[assignmentId]`,
`/parent/students/[studentId]/assignments`,
`/parent/students/[studentId]/assignments/[assignmentId]`) use
`buildMetadata({ index: false })`. No Assignment/Course JSON-LD or
`AggregateRating` structured data is ever emitted for private homework.

## Sitemap Audit

`src/app/sitemap.ts` lists only static public marketing routes and never
includes any `/coach`/`/portal`/`/parent` route — unchanged by Phase 16.
Verified: none of the ten new routes appear in `staticRoutes` or any
dynamic loop.

## Robots Audit

`src/app/robots.ts` disallows the whole `/coach`, `/portal`, and `/parent`
segments, which automatically covers every new Phase 16 route with no
additional entries required. Verified.

## Accessibility

`AssignmentForm`/`AssignmentEditForm` use real labels, a `fieldset`/
`legend` for the audience-type radio selector, and keyboard-accessible
native controls throughout. `AssignmentStatusActions` and
`SubmissionReviewForm` use explicit, never icon-only, button text: "Create
Assignment," "Publish Assignment," "Archive Assignment," "Submit
Assignment," "Resubmit Assignment," "Mark Reviewed," "Request Revision."
External submission URLs render with the full URL as descriptive link
text. Visible focus states and touch-friendly controls are inherited from
the existing design-system input/button primitives.

## Responsive QA

Reviewed the coach assignment list, new-assignment form (audience
selector, batch/student/session pickers, due-date input), assignment
detail (read-only and inline-edit variants), coach submissions list, coach
submission detail with review form, student assignment list, student
assignment detail with submission/resubmission form, and parent assignment
list/detail against the standard breakpoint set (375–1920px), reusing the
same stacked-card list patterns already validated in Phases 11–15. No
forced-wide tables; long titles, descriptions, instructions, and
submission text wrap within existing card containers.

## Performance Decisions

Server Components by default; Server Actions for every mutation; the only
Client Components are the narrow islands (`AssignmentForm`,
`AssignmentEditForm`, `AssignmentStatusActions`, `SubmissionReviewForm`,
`AssignmentSubmissionForm`). No academy-wide student or session fetch
anywhere — the new-assignment flow resolves only one batch's roster and
sessions at a time, in parallel (`Promise.all`). No Redux, Zustand, React
Query, SWR, AI SDK, chart library, rich text editor, or calendar library
was installed.

## Empty States

Coach: "No assignments are currently available." Student: "No assignments
are currently available." Parent: "No assignments are currently available
for this student." Assignment with no submissions: "No student submissions
are currently available for this assignment." None of these ever say "All
work complete," "Perfect homework record," "No missed assignments,"
"Student is behind," or "Student is failing."

## Database Migrations Created

```
supabase/migrations/0023_assignments_submissions.sql
supabase/migrations/0024_assignments_rls.sql
```

Neither edits any earlier migration; no empty migration was created.

## Admin Deferral

No Admin Portal UI changes were made in Phase 16. The existing server-only/
service-role admin architecture remains authoritative for future
assignment-management operations. Admin assignment-management UI is
explicitly deferred to a future phase; no dead Admin navigation link was
added.

## Future R2/File Submission Integration

No file, image, PDF, or PGN upload exists anywhere in Phase 16. A future
phase may add Cloudflare R2-backed file submissions; Phase 16 deliberately
supports text and URL submissions only.

## Future PGN Integration

No PGN parsing or validation exists anywhere in Phase 16. The
`submission_url` field accepts a plain http(s) reference link only — it is
never parsed as a chess game or validated as a real Lichess/Chess.com
study.

## Future Engine Analysis Deferral

No Stockfish or chess-engine integration exists anywhere in Phase 16. No
submission or assignment is ever automatically analyzed, scored, or graded
by a chess engine.

## Future Notification/Reminder Integration

No email/WhatsApp/push notification is sent when an assignment is
published, a deadline approaches, or a submission is reviewed. Students,
parents, and coaches discover changes only by visiting their respective
portal pages. A future phase may add notifications; Phase 16 deliberately
does not.
