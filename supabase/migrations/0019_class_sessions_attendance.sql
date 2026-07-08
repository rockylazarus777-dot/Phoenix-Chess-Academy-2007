-- =============================================================================
-- 0019_class_sessions_attendance.sql
-- =============================================================================
-- Phase 14 — Class Sessions + Attendance Foundation: schema only (enums,
-- tables, constraints, indexes). RLS policies and RPC functions are
-- deliberately split into 0020_attendance_rls.sql — the same two-file
-- pattern would have been used in Phase 10 had a schema/RLS split been
-- needed there; Phase 14 genuinely needs it given how much RPC logic the
-- security model requires (see docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md).
--
-- CORE DOMAIN DISTINCTION (mandatory — do not blur this):
--   class_schedules  = recurring weekly DEFINITIONS (0012, unchanged).
--   class_sessions   = real, DATED occurrences (this migration).
-- Attendance attaches only to class_sessions, never to class_schedules.
-- Existing class_schedules rows are not reinterpreted as historical
-- records, and no class_sessions rows are backfilled/materialized from
-- them in this migration.
--
-- No fake/seed session or attendance data is inserted anywhere here.

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- Operational session status only — not a live/real-time state machine.
-- Deliberately excludes LIVE/ONGOING/MISSED/ABSENT/PRESENT: those are
-- either attendance concepts (belong on attendance_status) or automatic
-- inferences this project explicitly refuses to make (see "NO AUTOMATIC
-- ATTENDANCE" in the architecture doc). COMPLETED is never inferred from
-- end_time passing — it is set only by an explicit coach action.
create type public.session_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- Persisted attendance outcomes only. NOT_MARKED is intentionally absent
-- from this enum — "no row" already means "not marked" (see "ATTENDANCE
-- ELIGIBILITY" / "NOT_MARKED Decision"); persisting a NOT_MARKED status
-- would blur that distinction, making a deliberately-recorded outcome
-- indistinguishable from "the coach simply hasn't marked this yet."
-- NOT_MARKED exists only as a UI-only, never-persisted display label.
create type public.attendance_status as enum ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- ---------------------------------------------------------------------------
-- CLASS_SESSIONS — dated occurrences
-- ---------------------------------------------------------------------------
-- `schedule_id` is OPTIONAL PROVENANCE ONLY: a session may be created
-- manually with no originating class_schedules row (walk-in makeup
-- class, one-off session, etc.). Phase 14 does not require every session
-- to trace back to a recurring definition, and does not auto-generate
-- sessions from class_schedules rows (no batch job, no cron, no "create
-- next 90 days of sessions" feature exists).
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  schedule_id uuid references public.class_schedules (id) on delete set null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  -- Explicit per-row timezone, same convention as class_schedules — never
  -- silently converted to a viewer's browser timezone at display time.
  timezone text not null default 'Asia/Kolkata',
  status public.session_status not null default 'SCHEDULED',
  -- Nullable override — a session may run in a different mode than the
  -- batch's own default (e.g. one online makeup class for an OFFLINE
  -- batch). Null means "use the batch's own training_mode" at display
  -- time; this migration does not backfill a value.
  training_mode public.training_mode,
  location_id uuid references public.academy_locations (id),
  topic text,
  -- Coach-only operational note. Never displayed to Student/Parent
  -- Portals (see "ATTENDANCE NOTES" / "Coach Attendance Privacy
  -- Boundary" in the architecture doc). Phase 14's Coach Portal UI does
  -- not actually implement an editor for this column (deferred, per the
  -- spec's "prefer not implementing coach notes UI this phase") — the
  -- column exists so the schema doesn't need a future migration once a
  -- coach-notes editor is genuinely built.
  coach_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  constraint class_sessions_time_range_check check (end_time > start_time),
  constraint class_sessions_topic_length_check check (topic is null or char_length(topic) <= 200),
  constraint class_sessions_cancelled_consistency_check check (
    (status = 'CANCELLED' and cancelled_at is not null) or
    (status <> 'CANCELLED' and cancelled_at is null and cancelled_by is null)
  )
);

comment on table public.class_sessions is
  'Dated class occurrences — NOT recurring definitions (see class_schedules) and NOT attendance. A session may exist with schedule_id = null (manually created); Phase 14 never auto-materializes class_schedules rows into class_sessions. status is operational data, set only by explicit coach action — never inferred from session_date/end_time passing.';
comment on column public.class_sessions.schedule_id is
  'Optional provenance only. Null is a completely normal, expected value — it does not mean data is missing.';
comment on column public.class_sessions.coach_notes is
  'Coach-only operational note. Never exposed to Student/Parent Portals. No Phase 14 UI writes to this column yet (deferred) — reserved for a future coach-notes editor.';

-- SESSION UNIQUENESS RULE: prevents an exact duplicate session (same
-- batch, same date, same start AND end time). Deliberately does NOT use
-- topic — two sessions for the same batch on the same date are allowed
-- as long as their times differ (e.g. a normal slot plus a separate
-- makeup slot on the same day), matching the spec's explicit
-- instruction not to block legitimate same-day multiple sessions.
create unique index class_sessions_uniqueness_idx
  on public.class_sessions (batch_id, session_date, start_time, end_time);

create index class_sessions_batch_date_idx on public.class_sessions (batch_id, session_date);
create index class_sessions_status_date_idx on public.class_sessions (status, session_date);

create trigger set_class_sessions_updated_at
  before update on public.class_sessions
  for each row
  execute function public.set_updated_at();

alter table public.class_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- ATTENDANCE_RECORDS — one row per (session, student)
-- ---------------------------------------------------------------------------
-- No JSON summary blob, no parent/coach contact fields, no payment
-- fields, no meeting passwords/credentials — see "ATTENDANCE_RECORDS
-- SCHEMA" in the architecture doc for the full list of what was
-- deliberately excluded.
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attendance_status not null,
  marked_by uuid not null references public.profiles (id),
  marked_at timestamptz not null default now(),
  -- Operational note only — length-limited; see "ATTENDANCE NOTES" in
  -- the architecture doc for what must never be placed here (medical
  -- diagnoses, government IDs, payment details, passwords/credentials).
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_session_student_key unique (session_id, student_id),
  constraint attendance_records_notes_length_check check (notes is null or char_length(notes) <= 500)
);

comment on table public.attendance_records is
  'One row per (session, student) — enforced by attendance_records_session_student_key. A missing row for an eligible student means "Not Marked," never a fabricated ABSENT. Updates modify the existing row (upsert on session_id+student_id) rather than creating a second event; full audit history of attendance changes is deferred (see "Attendance Audit History" in the architecture doc) unless folded into the existing admin_audit_log system in a future phase.';
comment on column public.attendance_records.notes is
  'Coach-only operational note, max 500 chars. Never exposed to Student/Parent Portals — see "Attendance Notes Privacy" in the architecture doc.';

create index attendance_records_student_idx on public.attendance_records (student_id);

create trigger set_attendance_records_updated_at
  before update on public.attendance_records
  for each row
  execute function public.set_updated_at();

alter table public.attendance_records enable row level security;
