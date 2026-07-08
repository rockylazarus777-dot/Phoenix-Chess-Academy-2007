-- =============================================================================
-- 0021_student_progress_evaluations.sql
-- =============================================================================
-- Phase 15 — student development progress evaluation schema. Does not edit
-- any earlier migration. Introduces two new tables
-- (student_progress_evaluations, student_progress_area_ratings) and two new
-- enums (progress_evaluation_status, development_area). RLS policies and RPC
-- functions are added in 0022_student_progress_rls.sql, not here.
--
-- DOMAIN DISTINCTION: a progress evaluation is a coach-authored
-- developmental assessment — distinct from attendance (0019/0020),
-- tournament results, FIDE rating, program enrollment, and batch
-- assignment. It is never derived/calculated from any of those; a coach
-- must explicitly author one. See
-- docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Progress Evaluation Domain
-- Distinction".

-- ---------------------------------------------------------------------------
-- ENUM: progress_evaluation_status
-- ---------------------------------------------------------------------------
-- DRAFT — coach working copy, visible only to the authoring coach (and any
--   coach currently assigned to the same batch — see "Coach Historical Read
--   Rule" in docs/STUDENT_PROGRESS_ARCHITECTURE.md) and Admin. Never visible
--   to Student/Parent Portals.
-- PUBLISHED — visible to the student and their linked parents; read-only to
--   Coach Portal from this point on (see "Published Evaluation Immutability").
-- ARCHIVED — historical internal record; not visible to Student/Parent
--   Portals; Coach read visibility follows the same rule as DRAFT/PUBLISHED
--   (coach_id = current coach OR coach currently manages the batch).
-- Deliberately not ACTIVE/COMPLETED/FINAL/APPROVED — those imply a
-- different, unconfirmed workflow semantics this project does not claim.
create type public.progress_evaluation_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- ---------------------------------------------------------------------------
-- ENUM: development_area
-- ---------------------------------------------------------------------------
-- Controlled, closed set of canonical chess development areas — never a
-- free-text category, never accepted as arbitrary browser input. Reviewed
-- against src/content/training.ts (Phoenix's existing authoritative training
-- methodology content) before finalizing: the existing content already uses
-- closely related, non-branded terminology (tactical development; opening/
-- middlegame/endgame foundations; clock training for time-management
-- awareness; tournament experience/preparation) with no confirmed
-- academy-branded methodology name ("Combo Training Formula",  "Phoenix
-- Competitive Development Approach") anywhere in current project content —
-- so this enum uses the spec's recommended canonical values directly rather
-- than inventing new branded terminology. See
-- docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Development Area Architecture".
create type public.development_area as enum (
  'OPENING',
  'MIDDLEGAME',
  'ENDGAME',
  'TACTICS',
  'CALCULATION',
  'POSITIONAL_PLAY',
  'TIME_MANAGEMENT',
  'CONCENTRATION',
  'DECISION_MAKING',
  'TOURNAMENT_PREPARATION'
);

-- ---------------------------------------------------------------------------
-- STUDENT_PROGRESS_EVALUATIONS
-- ---------------------------------------------------------------------------
-- coach_id is the business coach record (public.coaches.id); created_by is
-- the authenticated profile (public.profiles.id) that created the row.
-- Neither is ever accepted from browser input — both are server/RPC-derived
-- from auth.uid() at creation time (see 0022, create_student_progress_evaluation).
-- No parent/student contact data, attendance JSON, payment data, medical
-- data, government IDs, passwords, private credentials, or AI-content flags
-- are stored here (no AI feature exists in Phase 15).
create table public.student_progress_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  program_id uuid references public.programs (id),
  coach_id uuid not null references public.coaches (id),
  evaluation_period_start date not null,
  evaluation_period_end date not null,
  status public.progress_evaluation_status not null default 'DRAFT',
  overall_summary text,
  strengths text,
  development_focus text,
  coach_recommendation text,
  published_at timestamptz,
  published_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint student_progress_evaluations_period_check check (evaluation_period_end >= evaluation_period_start),
  constraint student_progress_evaluations_overall_summary_length_check check (overall_summary is null or char_length(overall_summary) <= 2000),
  constraint student_progress_evaluations_strengths_length_check check (strengths is null or char_length(strengths) <= 1500),
  constraint student_progress_evaluations_development_focus_length_check check (development_focus is null or char_length(development_focus) <= 1500),
  constraint student_progress_evaluations_recommendation_length_check check (coach_recommendation is null or char_length(coach_recommendation) <= 1500),
  -- PUBLISHED_CONSISTENCY: published_at/published_by are both set together,
  -- only when status = PUBLISHED — mirrors the class_sessions
  -- cancelled_at/cancelled_by consistency check from Phase 14.
  constraint student_progress_evaluations_published_consistency_check check (
    (status = 'PUBLISHED' and published_at is not null and published_by is not null)
    or (status <> 'PUBLISHED' and published_at is null and published_by is null)
  )
);

comment on table public.student_progress_evaluations is
  'Coach-authored student development evaluation for one evaluation period — never automatically calculated from attendance/FIDE rating/tournament results/enrollment. See docs/STUDENT_PROGRESS_ARCHITECTURE.md.';
comment on column public.student_progress_evaluations.coach_id is
  'The business coach record (public.coaches.id) who authored this evaluation. Server/RPC-derived only — never accepted from browser input.';
comment on column public.student_progress_evaluations.created_by is
  'The authenticated profile (public.profiles.id) that created this row. Server/RPC-derived only — never accepted from browser input.';

-- EVALUATION UNIQUENESS DECISION: prevents an exact duplicate period
-- evaluation from the same coach for the same student/batch — NOT
-- UNIQUE(student_id) and NOT UNIQUE(student_id, batch_id), both of which
-- would incorrectly block legitimate multiple evaluations across different
-- periods or coaches. status is deliberately excluded from the key (an
-- ARCHIVED evaluation still blocks an exact-duplicate-period re-creation).
-- See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Evaluation Uniqueness Decision".
create unique index student_progress_evaluations_uniqueness_idx
  on public.student_progress_evaluations (student_id, batch_id, coach_id, evaluation_period_start, evaluation_period_end);

create index student_progress_evaluations_student_idx
  on public.student_progress_evaluations (student_id);
create index student_progress_evaluations_batch_idx
  on public.student_progress_evaluations (batch_id);
create index student_progress_evaluations_coach_idx
  on public.student_progress_evaluations (coach_id);
create index student_progress_evaluations_status_idx
  on public.student_progress_evaluations (status);

create trigger set_student_progress_evaluations_updated_at
  before update on public.student_progress_evaluations
  for each row
  execute function public.set_updated_at();

alter table public.student_progress_evaluations enable row level security;

-- ---------------------------------------------------------------------------
-- STUDENT_PROGRESS_AREA_RATINGS
-- ---------------------------------------------------------------------------
-- Rating is a 1-5 internal structured development-assessment scale — never
-- a percentage, 0-100 score, Elo-like score, or FIDE-style rating, and never
-- implies a FIDE title or federation qualification. See "Rating Scale
-- Semantics" in docs/STUDENT_PROGRESS_ARCHITECTURE.md for the exact label
-- text (1 = Needs Significant Development ... 5 = Advanced), which lives in
-- application code (src/components/portal/DevelopmentAreaRating.tsx), not
-- the database.
create table public.student_progress_area_ratings (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.student_progress_evaluations (id) on delete cascade,
  area public.development_area not null,
  rating smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_progress_area_ratings_rating_range_check check (rating >= 1 and rating <= 5),
  constraint student_progress_area_ratings_comment_length_check check (comment is null or char_length(comment) <= 500)
);

comment on table public.student_progress_area_ratings is
  'One 1-5 development rating per (evaluation, development area) — never a percentage/Elo-like/FIDE-style score. Area comments are short chess-development comments only; never medical/financial/government-ID/credential content. See docs/STUDENT_PROGRESS_ARCHITECTURE.md.';

create unique index student_progress_area_ratings_evaluation_area_key
  on public.student_progress_area_ratings (evaluation_id, area);

create index student_progress_area_ratings_evaluation_idx
  on public.student_progress_area_ratings (evaluation_id);

create trigger set_student_progress_area_ratings_updated_at
  before update on public.student_progress_area_ratings
  for each row
  execute function public.set_updated_at();

alter table public.student_progress_area_ratings enable row level security;

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No RLS policy or RPC function is created in this migration — see
-- 0022_student_progress_rls.sql. No admin UI, assignment, homework,
-- certificate, payment, messaging, notification, or AI-generation table or
-- column is added anywhere in Phase 15.
