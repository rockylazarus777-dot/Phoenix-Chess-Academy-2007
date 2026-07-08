-- =============================================================================
-- 0023_assignments_submissions.sql
-- =============================================================================
-- Phase 16 — Assignments + Homework: schema only (enums, tables,
-- constraints, indexes). RLS policies and RPC functions are deliberately
-- split into 0024_assignments_rls.sql — the same two-file pattern used in
-- every prior phase since Phase 14 (0019/0020, 0021/0022). Does not edit
-- 0022 or any earlier migration.
--
-- CORE DOMAIN DISTINCTION (mandatory — do not blur this):
--   assignment  = coach-authored work ("Complete the following tactical
--                 positions before Friday.").
--   submission  = student-authored work for exactly one assignment.
-- Submission content (submission_text/submission_url) is never stored on
-- the assignment row, and coach feedback is never stored on the
-- assignment row — both live only on assignment_submissions. Progress
-- evaluations (Phase 15) and attendance (Phase 14) are never reinterpreted
-- as assignments or submissions, and no assignment is ever automatically
-- created from a class_session/class_schedule/progress evaluation/
-- program/tournament. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Assignment
-- vs Submission Distinction".
--
-- No fake/seed assignment or submission data is inserted anywhere here.

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- Assignment lifecycle only. Deliberately excludes ACTIVE/COMPLETED/
-- OVERDUE/SUBMITTED/GRADED: OVERDUE is a derived, student-contextual UI
-- state based on due_at vs "now" vs "does this student have a
-- submission" — it is never persisted here (see
-- docs/ASSIGNMENTS_ARCHITECTURE.md, "Derived Overdue State"). SUBMITTED/
-- GRADED are submission-status concepts (see assignment_submission_status
-- below), not assignment-lifecycle concepts.
create type public.assignment_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Audience architecture — exactly two values in Phase 16. Deliberately
-- excludes ACADEMY/PUBLIC/PROGRAM/LOCATION/CUSTOM_GROUP: Phase 16 does not
-- support academy-wide or program-wide assignments. See
-- docs/ASSIGNMENTS_ARCHITECTURE.md, "Assignment Audience Architecture".
create type public.assignment_audience_type as enum ('BATCH', 'STUDENT');

-- Submission lifecycle only. Deliberately excludes DRAFT/PENDING/APPROVED/
-- FAILED/PASSED/GRADED: Phase 16 implements no numeric/pass-fail grading —
-- coach review is qualitative only (REVIEWED or REVISION_REQUESTED plus a
-- free-text coach_feedback). NOT_SUBMITTED is never persisted — "no row"
-- already means "not submitted" (same convention as attendance's
-- NOT_MARKED, Phase 14).
create type public.assignment_submission_status as enum ('SUBMITTED', 'REVIEWED', 'REVISION_REQUESTED');

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS
-- ---------------------------------------------------------------------------
-- coach_id is the business coach record (public.coaches.id); created_by is
-- the authenticated profile (public.profiles.id) that created the row.
-- Neither is ever accepted from browser input — both are server/RPC-
-- derived from auth.uid() at creation time (see 0024, create_assignment).
-- program_id is always derived from the assigned batch's own program_id
-- (public.batches.program_id is NOT NULL in this schema — see
-- 0012_admin_operations_schema.sql — so program context is never
-- ambiguous). session_id is optional provenance only, exactly like
-- class_sessions.schedule_id (Phase 14) — an assignment is never required
-- to belong to a session, and no session completion ever auto-creates an
-- assignment.
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  instructions text,
  audience_type public.assignment_audience_type not null,
  batch_id uuid references public.batches (id),
  student_id uuid references public.students (id),
  program_id uuid references public.programs (id),
  session_id uuid references public.class_sessions (id) on delete set null,
  coach_id uuid not null references public.coaches (id),
  status public.assignment_status not null default 'DRAFT',
  due_at timestamptz,
  allow_late_submission boolean not null default false,
  created_by uuid not null references public.profiles (id),
  published_at timestamptz,
  published_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Title/description must carry real content — both are NOT NULL columns,
  -- but NOT NULL alone permits an empty string. Bounded per
  -- docs/ASSIGNMENTS_ARCHITECTURE.md, "Assignment Text Limits":
  -- title<=200, description<=3000, instructions<=5000.
  constraint assignments_title_length_check check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  constraint assignments_description_length_check check (char_length(trim(description)) > 0 and char_length(description) <= 3000),
  constraint assignments_instructions_length_check check (instructions is null or char_length(instructions) <= 5000),
  -- AUDIENCE CONSTRAINT (mandatory, see "Assignment Audience DB
  -- Constraint" in the architecture doc): BATCH requires batch_id and no
  -- student_id; STUDENT requires BOTH student_id AND batch_id — the
  -- batch_id on a direct STUDENT assignment represents the authorized
  -- coach/student/batch context a direct assignment can never exist
  -- without. A direct student assignment is never created without this
  -- authorization context.
  constraint assignments_audience_consistency_check check (
    (audience_type = 'BATCH' and batch_id is not null and student_id is null)
    or
    (audience_type = 'STUDENT' and batch_id is not null and student_id is not null)
  ),
  -- PUBLISHED_CONSISTENCY: published_at/published_by are both set
  -- together, only when status = PUBLISHED — same pattern as
  -- student_progress_evaluations (Phase 15) and class_sessions'
  -- cancelled_at/cancelled_by (Phase 14).
  constraint assignments_published_consistency_check check (
    (status = 'PUBLISHED' and published_at is not null and published_by is not null)
    or (status <> 'PUBLISHED' and published_at is null and published_by is null)
  )
);

comment on table public.assignments is
  'Coach-authored assignment — never automatically created from class_sessions/class_schedules/student_progress_evaluations/programs/tournaments. Submission content and coach feedback are never stored here (see assignment_submissions). See docs/ASSIGNMENTS_ARCHITECTURE.md.';
comment on column public.assignments.coach_id is
  'The business coach record (public.coaches.id) who authored this assignment. Server/RPC-derived only — never accepted from browser input.';
comment on column public.assignments.created_by is
  'The authenticated profile (public.profiles.id) that created this row. Server/RPC-derived only — never accepted from browser input.';
comment on column public.assignments.program_id is
  'Always the assigned batch''s own program_id (batches.program_id is NOT NULL) — never an independently selected, potentially unrelated program.';
comment on column public.assignments.session_id is
  'Optional provenance only, exactly like class_sessions.schedule_id. Null is a completely normal, expected value.';
comment on column public.assignments.due_at is
  'Optional, coach-chosen deadline — never automatically derived from session date, batch schedule, program duration, or publication date. Null means "No deadline," never "overdue."';

create index assignments_batch_idx on public.assignments (batch_id);
create index assignments_student_idx on public.assignments (student_id);
create index assignments_coach_idx on public.assignments (coach_id);
create index assignments_status_idx on public.assignments (status);
create index assignments_session_idx on public.assignments (session_id);

create trigger set_assignments_updated_at
  before update on public.assignments
  for each row
  execute function public.set_updated_at();

alter table public.assignments enable row level security;

-- ---------------------------------------------------------------------------
-- ASSIGNMENT_RECIPIENTS — the stable, published-time audience snapshot
-- ---------------------------------------------------------------------------
-- WHY THIS TABLE EXISTS (see docs/ASSIGNMENTS_ARCHITECTURE.md, "Audience
-- Snapshot Decision" and "Audience Drift Prevention"): a PUBLISHED batch
-- assignment needs a STABLE student audience. Continuously recalculating
-- "who is currently in this batch" against a PUBLISHED assignment would
-- let a student who joins the batch next month suddenly inherit last
-- month's homework, and would make a student who has since left the batch
-- lose a legitimate historical assignment record. This table is written
-- exactly once, atomically, at publish time (see 0024,
-- publish_assignment) and never recalculated afterward. Student/Parent
-- assignment read authorization derives from this table, never from
-- live batch_enrollments/student_program_enrollments membership.
create table public.assignment_recipients (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.students (id),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint assignment_recipients_assignment_student_key unique (assignment_id, student_id)
);

comment on table public.assignment_recipients is
  'Stable, published-time audience snapshot — written once at publish, never recalculated from current batch membership afterward. This is the ONLY authorization source for Student/Parent assignment read access. A student never queries this table directly for the full roster — see docs/ASSIGNMENTS_ARCHITECTURE.md, "Assignment Recipient Privacy".';

create index assignment_recipients_student_idx on public.assignment_recipients (student_id);

alter table public.assignment_recipients enable row level security;

-- ---------------------------------------------------------------------------
-- ASSIGNMENT_SUBMISSIONS — one CURRENT submission row per (assignment, student)
-- ---------------------------------------------------------------------------
-- ONE-CURRENT-SUBMISSION DECISION (see docs/ASSIGNMENTS_ARCHITECTURE.md,
-- "One Current Submission Decision" and "Resubmission Decision"):
-- Phase 16 stores exactly one current submission row per (assignment_id,
-- student_id) — enforced by the unique constraint below. A resubmission
-- (only permitted while status = REVISION_REQUESTED) updates this same
-- row rather than creating a new version; the previous coach_feedback is
-- not preserved once overwritten. Full revision/version history is a
-- documented, deliberate limitation deferred to a future phase.
create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.students (id),
  status public.assignment_submission_status not null default 'SUBMITTED',
  submission_text text,
  submission_url text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  coach_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_submissions_assignment_student_key unique (assignment_id, student_id),
  -- SUBMISSION CONTENT REQUIREMENT: at least one of submission_text /
  -- submission_url must carry real content — an empty submission is
  -- never allowed (also validated in Zod and the submit_assignment RPC).
  constraint assignment_submissions_content_required_check check (
    (submission_text is not null and char_length(trim(submission_text)) > 0)
    or (submission_url is not null and char_length(trim(submission_url)) > 0)
  ),
  constraint assignment_submissions_text_length_check check (submission_text is null or char_length(submission_text) <= 5000),
  constraint assignment_submissions_feedback_length_check check (coach_feedback is null or char_length(coach_feedback) <= 3000),
  -- SUBMISSION URL SECURITY: only http:/https: are ever accepted at the
  -- database level — javascript:/data:/file:/ftp: are rejected outright.
  -- The application never fetches, scrapes, or generates a preview of
  -- this URL server-side, and never trusts it as safe HTML. See
  -- docs/ASSIGNMENTS_ARCHITECTURE.md, "Submission URL Security".
  constraint assignment_submissions_url_protocol_check check (submission_url is null or submission_url ~ '^https?://'),
  -- REVISION_REQUESTED requires non-empty coach_feedback (a student must
  -- be told what to revise); REVIEWED permits optional feedback.
  constraint assignment_submissions_revision_feedback_check check (
    status <> 'REVISION_REQUESTED' or (coach_feedback is not null and char_length(trim(coach_feedback)) > 0)
  ),
  -- REVIEWED_CONSISTENCY: reviewed_at/reviewed_by are set together only
  -- once a coach has actually reviewed the submission (status <>
  -- SUBMITTED); a freshly (re)submitted row always has both null.
  constraint assignment_submissions_reviewed_consistency_check check (
    (status = 'SUBMITTED' and reviewed_at is null and reviewed_by is null)
    or (status in ('REVIEWED', 'REVISION_REQUESTED') and reviewed_at is not null and reviewed_by is not null)
  )
);

comment on table public.assignment_submissions is
  'One CURRENT submission row per (assignment, student) — enforced by assignment_submissions_assignment_student_key. Resubmission (only while status=REVISION_REQUESTED) updates this same row; revision/version history is deferred to a future phase. No numeric grade/score/percentage/pass-fail column exists — Phase 16 review is qualitative only (status + coach_feedback). See docs/ASSIGNMENTS_ARCHITECTURE.md.';
comment on column public.assignment_submissions.submission_url is
  'Optional chess-study/reference URL, http(s) only. Never fetched, scraped, or rendered as an iframe/trusted HTML by the application. Not tied to any specific chess platform (no Chess.com/Lichess requirement or claimed integration).';
comment on column public.assignment_submissions.reviewed_by is
  'The authenticated profile (public.profiles.id) of the reviewing coach. Server/RPC-derived only — never accepted from browser input.';

create index assignment_submissions_student_idx on public.assignment_submissions (student_id);
create index assignment_submissions_assignment_idx on public.assignment_submissions (assignment_id);

create trigger set_assignment_submissions_updated_at
  before update on public.assignment_submissions
  for each row
  execute function public.set_updated_at();

alter table public.assignment_submissions enable row level security;

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No RLS policy or RPC function is created in this migration — see
-- 0024_assignments_rls.sql. No file upload, image upload, PDF upload, PGN
-- upload, Cloudflare R2, Google Drive/Sheets, AI-generation, automated
-- chess analysis, Stockfish/engine integration, PGN parsing/validation,
-- Lichess/Chess.com/FIDE API integration, certificate, payment,
-- messaging, notification, live-class, or tournament-assignment table or
-- column is added anywhere in Phase 16. Numeric grading (marks/score/
-- percentage/grade/GPA/rating/rank/pass-fail) is intentionally absent
-- from assignment_submissions.
