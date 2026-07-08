# Student Progress Architecture (Phase 15)

Phase 15 adds a coach-authored student development progress evaluation
system on top of the Coach Portal (Phase 13), Student Portal (Phase 11),
and Parent Portal (Phase 12). This document is the authoritative reference
for the domain model, security architecture, and privacy boundaries
introduced in this phase. It complements, and does not replace,
`docs/COACH_PORTAL_ARCHITECTURE.md`, `docs/STUDENT_PORTAL_ARCHITECTURE.md`,
`docs/PARENT_PORTAL_ARCHITECTURE.md`, and
`docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md` (Phase 14).

## Progress Evaluation Domain Distinction

A **progress evaluation** is a coach-authored developmental assessment of a
student's chess development over a defined period. It is explicitly
distinct from, and never derived from:

- **Attendance** (`attendance_records`, Phase 14) — a presence record, not
  a development assessment.
- **Tournament results** — competitive outcomes, not tracked here.
- **FIDE rating** (`students.fide_rating`) — an external federation rating.
- **Program enrollment** (`student_program_enrollments`) — administrative
  enrollment status.
- **Batch assignment** (`batch_enrollments`) — administrative membership.

No progress evaluation is ever automatically calculated from attendance
percentage, FIDE rating, tournament rank, session count, program level, or
student age. A coach must explicitly author every evaluation; none are
seeded, generated, or inferred.

## Development Area Architecture

`public.development_area` is a real Postgres enum — a controlled, closed
set of canonical chess development areas. It is never a free-text field
and the application never accepts an arbitrary area name from browser
input; the database and Zod (`src/lib/validation/studentProgress.ts`) both
enforce membership in the same fixed set.

Before finalizing the values, `src/content/training.ts` (Phoenix's
existing authoritative training-methodology content) was reviewed. That
content already uses closely related, non-branded terminology — tactical
development, opening/middlegame/endgame foundations, clock training
(time-management awareness for competitive players), and tournament
experience/preparation — with no confirmed academy-branded methodology
name ("Combo Training Formula," "Phoenix Competitive Development Approach")
anywhere in current project content. Phase 15 therefore uses the spec's
recommended canonical values directly rather than inventing new branded
terminology.

## Development Area Values

```
OPENING
MIDDLEGAME
ENDGAME
TACTICS
CALCULATION
POSITIONAL_PLAY
TIME_MANAGEMENT
CONCENTRATION
DECISION_MAKING
TOURNAMENT_PREPARATION
```

Display labels live in `src/lib/portal/developmentAreas.ts`
(`DEVELOPMENT_AREA_LABELS`), a shared, cross-portal, non-role-specific
constant — area names themselves are not privacy-sensitive.

## Rating Scale Architecture

Each rated area carries a `smallint` `rating` column
(`student_progress_area_ratings.rating`), constrained
`rating >= 1 AND rating <= 5` at the database level and validated 1–5 in
Zod. This is an internal structured development-assessment scale — never a
percentage, 0–100 score, Elo-like score, or FIDE-style rating.

## Rating Scale Semantics

Stable text labels (`src/lib/portal/developmentAreas.ts`,
`DEVELOPMENT_RATING_LABELS`):

```
1 = Needs Significant Development
2 = Developing
3 = Progressing
4 = Strong
5 = Advanced
```

Deliberately not "Poor"/"Bad"/"Weak Student"/"Failure"/"Expert"/"Master"/
"Grandmaster" — none of these imply a FIDE title or federation
qualification. The numeric value and its text label are always displayed
together (`DevelopmentAreaRating` component), never a bare number and
never color alone.

## Evaluation Status Enum

`public.progress_evaluation_status`: `DRAFT`, `PUBLISHED`, `ARCHIVED`.
Deliberately not `ACTIVE`/`COMPLETED`/`FINAL`/`APPROVED` — those imply a
stronger workflow this project has not confirmed.

## Draft Semantics

`DRAFT` is a coach working copy. It is visible only under the Coach
Historical Read Rule (see below) and never reaches the Student Portal, the
Parent Portal, either read RPC (`get_student_progress_evaluations()`,
`get_parent_student_progress_evaluations()`), any client payload destined
for Student/Parent, any public page, SEO metadata, JSON-LD, or the
sitemap. This is mandatory and enforced at three independent layers: no
direct RLS SELECT policy for STUDENT/PARENT on either progress table at
all, the two student/parent read RPCs filter `status = 'PUBLISHED'`
explicitly in their `WHERE` clause, and neither RPC's `RETURNS TABLE` shape
is ever consumed by a Coach-only page.

## Published Semantics

`PUBLISHED` is visible to the student (their own evaluation only) and to
every parent linked to that student via `student_parents`. The
authoring coach may still view it (read-only — see "Published Evaluation
Immutability").

## Archived Semantics

`ARCHIVED` is a historical internal record. Not visible to Student or
Parent Portals. Coach read visibility follows the same Coach Historical
Read Rule as DRAFT/PUBLISHED (coach_id = current coach OR coach currently
manages the batch) — archiving does not itself change who among coaches
can see it, only that Student/Parent access remains blocked.

## student_progress_evaluations Schema

(`supabase/migrations/0021_student_progress_evaluations.sql`)

```
id                        uuid primary key
student_id                uuid not null  references students(id) on delete cascade
batch_id                  uuid not null  references batches(id)  on delete cascade
program_id                uuid           references programs(id)
coach_id                  uuid not null  references coaches(id)
evaluation_period_start   date not null
evaluation_period_end     date not null
status                    progress_evaluation_status not null default DRAFT
overall_summary           text  (<=2000 chars)
strengths                 text  (<=1500 chars)
development_focus         text  (<=1500 chars)
coach_recommendation      text  (<=1500 chars)
published_at              timestamptz
published_by              uuid  references profiles(id)
created_at / updated_at   timestamptz not null
created_by                uuid not null  references profiles(id)
```

`coach_id` is the business coach record; `created_by` is the authenticated
profile. Both are always server/RPC-derived from `auth.uid()` — never
accepted from browser input. No parent/student contact data, attendance
JSON, payment data, medical data, government IDs, passwords, private
credentials, or AI-content flags are stored (no AI feature exists in Phase
15). A `published_consistency` check constraint requires `published_at`/
`published_by` to be both set exactly when `status = PUBLISHED`, mirroring
the `class_sessions` cancelled-consistency check from Phase 14.

## student_progress_area_ratings Schema

```
id             uuid primary key
evaluation_id  uuid not null references student_progress_evaluations(id) on delete cascade
area           development_area not null
rating         smallint not null  (check 1-5)
comment        text  (<=500 chars)
created_at / updated_at  timestamptz not null
```

Unique `(evaluation_id, area)` — one rating per area per evaluation.

## Evaluation Period Validation

Enforced at the database level
(`student_progress_evaluations_period_check: evaluation_period_end >=
evaluation_period_start`) and again explicitly inside every write RPC
(`create_student_progress_evaluation`, `update_student_progress_evaluation`)
before any write, and in Zod (`src/lib/validation/studentProgress.ts`).
Dates are never silently swapped. The coach explicitly selects the
period — it is never inferred from batch start/end dates, program
enrollment, calendar month, or attendance history.

## Evaluation Uniqueness Decision

A unique index on
`(student_id, batch_id, coach_id, evaluation_period_start,
evaluation_period_end)` blocks only an exact duplicate — the same coach
creating a second evaluation for the same student/batch/period. It does
NOT use `UNIQUE(student_id)` or `UNIQUE(student_id, batch_id)`, either of
which would incorrectly prevent legitimate multiple evaluations across
different periods or different authorized coaches. `status` is
deliberately excluded from the key, so an `ARCHIVED` evaluation still
blocks an exact-duplicate-period re-creation attempt.

## Text Length Limits

| Field | Limit |
|---|---|
| `overall_summary` | 2000 |
| `strengths` | 1500 |
| `development_focus` | 1500 |
| `coach_recommendation` | 1500 |
| area rating `comment` | 500 |

Enforced at both the database (`check` constraints) and Zod layers, and
explicitly re-checked inside every write RPC before any write (not just
relying on the constraint to fail).

## Area Comment Privacy

Area comments are short, coach-authored, chess-development comments only —
never medical diagnoses, mental-health details, family/financial
information, government identifiers, passwords, or private credentials.
UI helper text on every comment field reads "use a short chess-development
comment only." Unlike Phase 14's attendance notes (coach-only), area
comments on a **published** evaluation ARE shown to the student and linked
parents, per spec — this is a deliberate difference in privacy boundary
between the two data types, documented here to avoid confusion. Draft
comments never reach Student/Parent regardless (see "Draft Semantics").

## Coach Evaluation Authorization

A coach may create an evaluation only when all of the following hold:

1. The authenticated role resolves to COACH.
2. The coach business record resolves via `coaches.profile_id = auth.uid()`.
3. `coaches.status = 'ACTIVE'` (Coach Portal access is FULL).
4. The coach currently has a `batch_coaches` row for the target batch
   (`ended_at is null`).
5. The target student is legitimately connected to that batch (see
   "Student/Batch Eligibility").

Never authorized by student UUID knowledge, student code, student name,
program, location, current level, FIDE ID/rating, email, or phone.

## Coach Historical Read Decision

A coach may need to read an evaluation they authored even after their own
batch assignment ends. The uniform read rule, applied identically across
every coach-facing read path (direct RLS SELECT and all `get_coach_*`
RPCs):

```
evaluation.coach_id = current_coach_id()
OR
coach_has_batch(evaluation.batch_id)
```

This lets a coach retain access to their own authored evaluation history
without granting academy-wide access to unrelated evaluations, AND lets
any coach *currently* assigned to a batch read every evaluation tied to
that batch — including another coach's — supporting continuity across
PRIMARY/ASSISTANT/GUEST handoffs. This is strictly a Coach↔Coach visibility
question; it never extends DRAFT/ARCHIVED visibility to Student or Parent.

## Coach Update Authorization

Stricter than the read rule. A coach may update only when:

```
evaluation.coach_id = current_coach_id()
AND
evaluation.status = 'DRAFT'
AND
coach_has_batch(evaluation.batch_id)
```

An ended batch assignment never continues to grant new update rights —
`coach_has_batch()` already excludes ended (`ended_at is not null`)
assignments.

## Student/Batch Eligibility

For evaluation **creation**, eligibility uses **current** (not historical/
date-aware) batch membership — the spec calls for "current batch
assignment," a deliberately simpler rule than Phase 14's session-date-aware
`session_eligible_student_ids()`, since an evaluation is not tied to one
dated occurrence. `student_in_batch_roster(student_id, batch_id)`
(`supabase/migrations/0022_student_progress_rls.sql`) is the dual-path
current-membership check.

## Dual-Path Roster Decision

`student_in_batch_roster()` matches the exact dual-path pattern established
by `get_coach_batch_roster()` (Phase 13): a student counts as a batch
member if EITHER a `batch_enrollments` row OR a `student_program_enrollments`
row links them to the batch — no additional status/date filter. The
application-layer helper `getAuthorizedBatchStudent()`
(`src/lib/coach/progressAuthorization.ts`) reuses `get_coach_batch_roster()`
directly rather than introducing a second roster query, per "reuse
`get_coach_batch_roster()` for current roster selection."

## Program Context Validation

`batches.program_id` is `NOT NULL` in this schema — every batch has
exactly one program. Program context for an evaluation is therefore always
derived from the assigned batch's own `program_id`, never an independently
selected, potentially unrelated program; the coach never picks a program
from a separate dropdown. Both write RPCs validate
`target_program_id = batches.program_id` for the target batch and raise
`VALIDATION_ERROR` on any mismatch — a deliberate, explicit rejection
rather than silently coercing an invalid value to `null`, consistent with
this project's established "no partial/silent success" pattern (Phase
14's attendance RPC).

## Evaluation Write Architecture

No broad Coach INSERT/UPDATE exists on either `student_progress_evaluations`
or `student_progress_area_ratings`. RLS is row-level, not column-level — a
broad UPDATE policy would let a coach mutate `student_id`/`batch_id`/
`coach_id`/`created_by`/`published_at`/`published_by`/`status`, not just the
intended editable fields. All writes go exclusively through four narrow
RPCs:

- `create_student_progress_evaluation(...)`
- `update_student_progress_evaluation(...)`
- `publish_student_progress_evaluation(...)`
- `archive_student_progress_evaluation(...)`

Archiving is scoped to Coach-owned DRAFTs only — a coach can never archive
a PUBLISHED evaluation through the Coach Portal (see "Published Evaluation
Immutability"); that correction workflow is deferred to a future Admin
architecture.

## Create Evaluation RPC

`create_student_progress_evaluation(target_student_id, target_batch_id,
target_program_id, period_start, period_end, summary, strengths_text,
development_focus_text, recommendation_text, area_ratings jsonb)` — `SECURITY
DEFINER`, `SET search_path = public`. Resolves `auth.uid()` →
`current_coach_id()`, verifies `coaches.status = 'ACTIVE'`, verifies
`coach_has_batch(target_batch_id)`, verifies
`student_in_batch_roster(target_student_id, target_batch_id)`, validates
the evaluation period, all text lengths, and the `area_ratings` JSON array
(array type, 1–20 entries, no duplicate areas, every area a valid enum
value, rating 1–5, comment ≤500 chars) — all BEFORE any write. Validates
`target_program_id` against the batch's own `program_id`. Inserts the
evaluation as `DRAFT` with server-derived `coach_id`/`created_by`, then
inserts every area rating in the same function invocation. Returns the new
evaluation UUID. `REVOKE ALL FROM PUBLIC` / `GRANT EXECUTE TO
authenticated`.

## Update Evaluation RPC

`update_student_progress_evaluation(target_evaluation_id, period_start,
period_end, summary, strengths_text, development_focus_text,
recommendation_text, area_ratings jsonb)` — verifies
`evaluation.coach_id = current coach`, `status = DRAFT`, and
`coach_has_batch(evaluation.batch_id)`. Never accepts or changes
`student_id`/`batch_id`/`program_id`/`coach_id`/`created_by`/`status`/
`published_at`/`published_by` — none of those are parameters. Validates the
full payload exactly like create, then atomically replaces area ratings
(delete-all-then-insert-validated-set) inside the same function call — if
one area is invalid, the entire update is rejected before any row is
touched.

## Publish Evaluation RPC

`publish_student_progress_evaluation(target_evaluation_id)` — verifies
ownership + current batch assignment + `status = DRAFT`, requires at least
one area rating AND a non-empty `overall_summary` (raises
`EMPTY_EVALUATION` otherwise — an evaluation with zero content is never
publishable), then atomically transitions `DRAFT → PUBLISHED` conditioned
on `status = 'DRAFT'` in the `UPDATE ... WHERE` clause (same
race-prevention pattern as `transition_class_session_status()`, Phase 14).
Sets `published_at = now()` and `published_by = auth.uid()` server-side —
never accepted from the caller.

## Archive Draft RPC

`archive_student_progress_evaluation(target_evaluation_id)` — allows only
`DRAFT → ARCHIVED`, requiring ownership and current batch assignment. Never
allows archiving a PUBLISHED evaluation and never allows `ARCHIVED →
DRAFT`. Admin correction workflow is deferred.

## Atomic Area Rating Validation

Both `create_` and `update_student_progress_evaluation()` validate the
entire `area_ratings` JSON array — shape, enum membership, duplicate-area
rejection, rating range, comment length — in a full pass before any row is
written. `update_student_progress_evaluation()` additionally performs its
area-rating replacement (delete existing, insert new) only after that full
validation pass succeeds, so no partial/mixed rating set is ever
persisted.

## Published Immutability

Once PUBLISHED, an evaluation is read-only in the Coach Portal: no update,
no unpublish, no archive, no delete. This is enforced by
`update_student_progress_evaluation()`/`archive_student_progress_evaluation()`
themselves requiring `status = DRAFT`, and by the Coach Portal UI only ever
rendering the edit form / status actions when `coach_can_manage` (returned
by `get_coach_progress_evaluation()`) is true, which itself requires
`status = DRAFT`. Future Admin correction architecture (for the rare case
a published evaluation contains an error) is explicitly deferred — this is
an intentional data-integrity decision, not an oversight.

## Delete Decision

No evaluation deletion exists anywhere in Phase 15. For an unwanted DRAFT,
"Archive Draft" is sufficient. A PUBLISHED evaluation is immutable to the
Coach Portal and has no DELETE policy or RPC of any kind.

## Coach Routes Created

```
/coach/progress
/coach/progress/new
/coach/progress/[evaluationId]
/coach/batches/[batchId]/progress
/coach/batches/[batchId]/students/[studentId]/progress
```

No generic `/coach/students/[studentId]` profile route exists — student
progress history is always contextual to one assigned batch, and
`/coach/batches/[batchId]/students/[studentId]/progress` independently
verifies both the batch assignment and the student's membership in that
specific batch before rendering anything.

## Coach Navigation Update

`COACH_NAV_ITEMS` gains a 5th item, "Student Progress" →
`/coach/progress`, because the route now exists.
`getCoachBatchContextNav()` gains a 5th item, "Student Progress" →
`${base}/progress`. No "Evaluations"/"Reports"/"Certificates"/
"Assignments" item is added.

## Batch Context Navigation Update

Batch context nav is now Overview / Students / Class Schedule / Class
Sessions / Student Progress — each added only because its route exists.

## Coach Progress List

`/coach/progress` groups every evaluation visible under the Coach
Historical Read Rule into Draft / Published / Archived Evaluations
sections. Shows student name/code, batch, program if present, evaluation
period, status, and updated date. Never shows student email/phone/
WhatsApp/address/DOB, parent details, or payment information. No
progress/improvement percentage, performance score, or "overall rating" is
ever fabricated by averaging area ratings — none of that is stored, so
none of it is displayed.

## New Evaluation Page

`/coach/progress/new` is a two-step, server-rendered flow rather than a
client-side batch/roster switcher (chosen for simplicity and to avoid ever
sending a multi-batch roster payload to the client): without a valid
`?batchId=`, the page shows a plain server-rendered list of the coach's own
assigned batches; once `batchId` is supplied and re-authorized via
`getAssignedBatch()`, the page resolves ONLY that batch's roster
(`getCoachBatchRoster()`) and hands it — narrow, batch-scoped — to
`ProgressEvaluationForm`. An optional `?studentId=` is validated against
that same roster before being used as a prefill (linked from the Coach
Student Progress History page's "New Evaluation" action). Program is fixed
display context (the batch's own program), never a separate field the
coach fills in.

## Development Area Form

`DevelopmentAreaRatingsEditor` (`src/components/portal/coach/`) shows all
ten canonical areas as togglable fieldsets — no area is preselected, and
toggling an area on does not pre-fill a default rating of 3; the coach must
explicitly choose both. At least one area rating is required even for
DRAFT creation (a deliberate choice to avoid ever persisting a completely
empty evaluation shell) — both the client form and
`create_student_progress_evaluation()` enforce this minimum.

## Coach Evaluation Detail

`/coach/progress/[evaluationId]` calls `get_coach_progress_evaluation()`
on every request, which applies the Coach Historical Read Rule internally;
invalid UUID, nonexistent evaluation, and an evaluation outside the read
rule all render `notFound()` identically (Evaluation Enumeration
Protection — the coach cannot distinguish "doesn't exist" from "isn't
visible to me"). Shows student identity summary, batch, program,
evaluation period, status, overall summary, strengths, development focus,
coach recommendation, area ratings + comments, author display name,
created date, and published date if present. Internal `profile_id`/
`created_by`/`published_by`/`coach_id` UUIDs are never fetched into this
page — `get_coach_progress_evaluation()`'s `coach_can_manage` boolean
answers the only authorization question the UI needs.

## Edit Architecture

No `/coach/progress/[evaluationId]/edit` route exists. The edit form
(`ProgressEvaluationEditForm`) renders inline on the detail page, only when
`coach_can_manage && status === 'DRAFT'` — the cleanest architecture given
the spec's explicit permission to avoid a separate route "unless it
materially improves architecture." No PII enters any query parameter under
this design.

## Coach Batch Progress Page

`/coach/batches/[batchId]/progress` requires `coach_has_batch(batchId)` and
then shows every evaluation for that batch regardless of authoring coach —
the documented continuity decision (a batch may have PRIMARY/ASSISTANT/
GUEST coaches, and any of them currently assigned should see the batch's
full evaluation history). Author is shown as a display name only
(`coaches.full_name`) — never coach email/phone/WhatsApp.

## Coach Student Progress History

`/coach/batches/[batchId]/students/[studentId]/progress` independently
verifies both the batch assignment (`getAssignedBatch()`) and the
student's membership in that specific batch's roster
(`getAuthorizedBatchStudent()`, which reuses `get_coach_batch_roster()`) —
"knowing studentId is never enough." The underlying RPC
(`get_coach_student_progress()`) shows PUBLISHED/ARCHIVED evaluations under
the batch continuity rule, but a DRAFT row is included only when authored
by the current coach — draft privacy is preserved even within this
batch-scoped history view. Never shows attendance records, parent data, or
student contact information; not a generic full student profile.

## Student Progress Route

`/portal/progress` added; `STUDENT_NAV_ITEMS` gains a 7th item,
"Progress," because the route now exists. The student may view only their
own PUBLISHED evaluations — never DRAFT, never ARCHIVED.

## Student Progress Privacy

`get_student_progress_evaluations()` is a zero-argument RPC, always scoped
to `current_student_id()` internally — no `studentId` parameter exists
anywhere in the module or the page. No direct RLS SELECT policy exists for
STUDENT on either progress table; the RPC is the only access path,
avoiding the need to express "PUBLISHED-only, own-student-only" as a
row-level `USING` clause reused elsewhere.

## Parent Progress Route

`/parent/students/[studentId]/progress` added;
`getParentStudentContextNav()` gains a 6th item, "Progress," because the
route now exists. Every request resolves the current parent, authorizes
the student through `getLinkedStudent()` (student_parents-based), then
retrieves only PUBLISHED evaluations for that linked student.

## Parent Progress Privacy

`get_parent_student_progress_evaluations(target_student_id)` independently
re-verifies `parent_has_student(target_student_id)` inside the function
body — defense in depth on top of the page-level `getLinkedStudent()`
check, not a replacement for it. Never authorized by email/phone/surname
match or the `is_primary`/`can_manage_student` flags — relationship
existence via `student_parents` remains the sole read boundary, consistent
with Phase 12.

## Coach Progress Query Architecture

`src/lib/queries/coach/progress.ts` — `listCoachProgressEvaluations()`,
`getCoachProgressEvaluation(evaluationId)`, `listCoachBatchProgress(batchId)`,
`getCoachStudentProgressHistory(batchId, studentId)`.
`src/lib/coach/progressAuthorization.ts` — `getAuthorizedBatchStudent()`.
No `coachId` is ever accepted from a Client Component; every query module
function is `server-only` and derives the coach identity server-side.

## Student Progress Query Architecture

`src/lib/queries/student/progress.ts` — `getStudentProgressEvaluations()`,
wrapping the zero-argument RPC. No `studentId` browser input anywhere.

## Parent Progress Query Architecture

`src/lib/queries/parent/progress.ts` —
`getParentStudentProgressEvaluations(studentId)`. The page authorizes the
linked student first; the RPC independently re-verifies the relationship.
No service-role client is used anywhere in this module.

## Progress Action Result Architecture

`src/lib/coach/progressActionResult.ts` introduces `CoachProgressActionResult<T>`
as its own narrow type — deliberately NOT folded into Phase 14's
`CoachActionResult` — with codes `SUCCESS`/`VALIDATION_ERROR`/
`DATABASE_UNAVAILABLE`/`NOT_AUTHORIZED`/`EVALUATION_NOT_FOUND`/
`EVALUATION_NOT_EDITABLE`/`INVALID_TRANSITION`/`EMPTY_EVALUATION`/`UNKNOWN`.
The progress domain introduces codes that don't apply to session/attendance
mutations; overloading one shared union would force every caller's switch
statement to handle cases that can never occur for it. RPC exception
messages are mapped to these codes via substring matching (same pattern as
Phase 14) — no raw Supabase/Postgres/RPC error ever reaches the UI.

## Progress RLS

`student_progress_evaluations` / `student_progress_area_ratings`: COACH
gets SELECT only, gated by the Coach Historical Read Rule (see above). No
INSERT/UPDATE/DELETE policy exists for COACH on either table — all writes
go through the four RPCs. STUDENT and PARENT get NO direct RLS policy at
all on either table — both access exclusively through the two narrow read
RPCs (`get_student_progress_evaluations()`,
`get_parent_student_progress_evaluations()`).

## RPC Security

Every Phase 15 `SECURITY DEFINER` function: `SET search_path = public`,
resolves `auth.uid()`, resolves the caller's business identity
(`current_coach_id()`/`current_student_id()`/`current_parent_id()`),
verifies the relevant business relationship (never assumes role alone is
sufficient), validates every input, returns only narrow data, and is
`REVOKE ALL FROM PUBLIC` / `GRANT EXECUTE TO authenticated` only.

## Coach Read RPCs

`get_coach_progress_evaluations()`, `get_coach_progress_evaluation(uuid)`,
`get_coach_batch_progress(uuid)`, `get_coach_student_progress(uuid, uuid)` —
all apply the Coach Historical Read Rule (or the batch-continuity variant
for the batch-scoped list) and never return `created_by`/`published_by`/
`profile_id` or student/coach/parent contact data.

## Student Read RPC

`get_student_progress_evaluations()` — zero-argument, PUBLISHED-only,
scoped to `current_student_id()`.

## Parent Read RPC

`get_parent_student_progress_evaluations(uuid)` — PUBLISHED-only, scoped
via `parent_has_student()`.

## Auth.uid() Ownership Chains

Every RPC resolves `auth.uid()` → `profiles.id` → the caller's business
record (`coaches`/`students`/`parents`) → the specific relationship
(`batch_coaches`/`batch_enrollments`+`student_program_enrollments`/
`student_parents`) before any read or write — no step trusts a
client-supplied identifier as the source of authority.

## Coach Student PII Boundary

Coach-facing progress views show only student name, code, current level
(where already resolved via existing roster queries), evaluation content,
and area ratings/comments — never DOB, address, email, phone, WhatsApp,
FIDE rating, or payment information.

## Student Progress PII Boundary

The student sees only their own PUBLISHED evaluations, including coach
display name — never coach email/phone/WhatsApp/profile ID, never other
students' data, never internal evaluation-authoring UUIDs beyond the
`evaluationId` resource identifier implicit in the page's own data (not
exposed as a separate field in the UI beyond what the route itself needs).

## Parent Progress PII Boundary

Same shape as the student boundary, scoped to one linked student per
request via `student_parents`. Never shows attendance data, payment data,
or other students.

## Attendance Indexes

(See "Attendance Indexes" in `docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`
for the Phase 14 set — unchanged by Phase 15.) Phase 15 adds:
`student_progress_evaluations(student_id)`,
`student_progress_evaluations(batch_id)`,
`student_progress_evaluations(coach_id)`,
`student_progress_evaluations(status)`, unique
`student_progress_evaluations(student_id, batch_id, coach_id,
evaluation_period_start, evaluation_period_end)`, unique
`student_progress_area_ratings(evaluation_id, area)`, and
`student_progress_area_ratings(evaluation_id)`. No speculative indexes
unrelated to Phase 15 queries were added.

## Admin Architecture Decision

No Admin Portal UI changes were made in Phase 15. The existing server-only/
service-role admin architecture remains authoritative for future full
progress-evaluation operations (e.g. correcting a published evaluation).
Admin progress-management UI is explicitly deferred to a future phase; no
dead Admin navigation link was added.

## No Automatic Overall Score Audit

No code path anywhere in Phase 15 computes an average rating, overall
rating, percentage, progress score, improvement score, or performance
score from the individual area ratings. The system displays each area
rating independently; it never turns the 1–5 scale into a public
leaderboard or ranks students against each other.

## No Automatic Comparisons Audit

No code path generates "Improved 20%," "Declined 10%," "Best student,"
"Top performer," "Below average," or "Above average" language. Phase 15
displays authored evaluation history; it does not generate comparative
analytics — that is explicitly deferred to a future, separately-defined
analytics architecture.

## No AI Content Audit

No coach summary, strengths text, development focus text, recommendation,
or area comment is generated by an LLM anywhere in Phase 15. No AI SDK was
installed. No "Generate with AI" affordance exists. Every evaluation field
is authored manually by the coach.

## Progress Status Presentation

`ProgressEvaluationStatusBadge` (`src/components/portal/`) — DRAFT/
PUBLISHED/ARCHIVED, each with a tone and explicit text label. Deliberately
its own component, never reused for `AttendanceStatusBadge` or
`SessionStatusBadge` — the three status domains have genuinely different
semantics.

## Development Rating Presentation

`DevelopmentAreaRating` (`src/components/portal/`) shows the area label,
the numeric rating, its text development label, and the comment if
visible — e.g. "Tactics — 4 / 5 — Strong." No star icons (implies generic
review/rating semantics this project doesn't intend) and no trophy/crown
icons (implies an official chess title or achievement this scale does not
claim).

## Date Display

Evaluation periods and published dates use deterministic server-rendered
ISO date strings (`YYYY-MM-DD`, sliced directly from the database value) —
no browser-only locale formatting that risks a hydration mismatch, and no
silent timezone conversion (evaluation periods are plain `date` values with
no time-of-day component to convert).

## Private Data Caching Decision

All progress/evaluation data is private. No route in Phase 15 uses
`force-static` or public revalidation. No Coach A evaluation is ever
cached for Coach B, no Student A evaluation for Student B, and no Parent A
linked-student evaluation for Parent B — every page is a per-request
authenticated Server Component; `React.cache()` (where used, e.g.
`getCurrentCoach()`) is request-scoped memoization only.

## Client Data Exposure Audit

No progress/evaluation data is ever stored in `localStorage`,
`sessionStorage`, `IndexedDB`, or a `window` global, and no global client
store exists for it. No student name, student code, evaluation summary,
strengths, development focus, recommendation, area comment, rating, or
coach name appears in any URL query string — the only resource identifiers
ever used as route/query parameters are `evaluationId`, `batchId`, and
`studentId` (the last only in the already-established parent
linked-student route pattern).

## SEO

All seven new routes (`/coach/progress`, `/coach/progress/new`,
`/coach/progress/[evaluationId]`, `/coach/batches/[batchId]/progress`,
`/coach/batches/[batchId]/students/[studentId]/progress`,
`/portal/progress`, `/parent/students/[studentId]/progress`) use
`buildMetadata({ index: false })`. No progress-related JSON-LD or
`AggregateRating` structured data is ever emitted.

## Sitemap / Robots

`src/app/sitemap.ts` lists only static public marketing routes and never
included any `/coach`/`/portal`/`/parent` route — unchanged by Phase 15.
`src/app/robots.ts` disallows the whole `/coach`, `/portal`, and `/parent`
segments, which automatically covers every new Phase 15 route with no
additional entries required. Verified.

## Accessibility

`DevelopmentAreaRatingsEditor` uses a real checkbox to toggle each area,
`fieldset`/`legend` per area, `sr-only` radio inputs styled as visible
number chips for the 1–5 rating (always paired with the text development
label alongside), and a labelled, length-limited comment textarea.
`EvaluationStatusActions` labels its two buttons explicitly ("Publish
Evaluation," "Archive Draft") — never icon-only. Server Action errors
render as `role="alert"` text associated with the form. Visible focus
states are inherited from the existing design-system input/button
primitives.

## Responsive QA

Reviewed the coach progress list, new-evaluation form (batch picker +
student select + period fields + development-area editor), evaluation
detail (read-only and inline-edit variants), coach batch progress list,
coach student progress history, student progress view, and parent
progress view against the standard breakpoint set (375–1920px), reusing
the same stacked-card list patterns already validated in Phases 11–14. No
forced-wide tables; long student/batch names and long summary text wrap
within existing card containers.

## Performance Decisions

Server Components by default; Server Actions for all four mutations; the
only Client Components are the narrow islands
(`ProgressEvaluationForm`, `ProgressEvaluationEditForm`,
`DevelopmentAreaRatingsEditor`, `EvaluationStatusActions`). No
academy-wide student fetch anywhere — the new-evaluation flow resolves
only one batch's roster at a time. No calendar library, state-management
library, AI SDK, or chart library was installed.

## Empty States

Coach: "No student progress evaluations are currently available." Student:
"No published progress evaluations are currently available." Parent: "No
published progress evaluations are currently available for this student."
None of these ever say "No progress," "Student is not improving," "Perfect
performance," "No weaknesses," or "No development needed."

## Future Tournament Integration

Not built in Phase 15. A future phase may correlate published evaluation
periods with tournament participation, but no such integration, join, or
combined view exists yet.

## Future PGN/Engine Analysis Deferral

No PGN import, chess-engine integration, or Stockfish-derived content
exists anywhere in Phase 15, and none is planned to feed evaluation content
automatically — every evaluation field remains coach-authored.

## Future Notifications Deferral

No email/WhatsApp/push notification is sent when an evaluation is
published. Students and parents discover new published evaluations only by
visiting their respective Progress page. A future phase may add
notifications; Phase 15 deliberately does not.
