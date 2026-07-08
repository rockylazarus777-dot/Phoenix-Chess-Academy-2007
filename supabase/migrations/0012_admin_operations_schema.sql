-- =============================================================================
-- 0012_admin_operations_schema.sql
-- =============================================================================
-- Phase 10 — Admin Operations Foundation: business-record schema for
-- students, parents, coaches, batches, schedules, and enrollments.
--
-- IMPORTANT DISTINCTION (see docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
-- "Student/Parent/Coach Architecture"): every table below is a BUSINESS
-- RECORD, not an auth/profile record. `profiles` (0002) is the portal
-- account; `students`/`parents`/`coaches` are the academy's operational
-- record of a real person, and may exist for years before that person
-- ever receives portal login access. `profile_id` is nullable on all
-- three for exactly this reason — do not make it required.
--
-- No fake/seed business data is inserted anywhere in this migration.

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type public.student_status as enum ('ACTIVE', 'INACTIVE', 'ON_HOLD', 'ALUMNI', 'ARCHIVED');
create type public.parent_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');
create type public.coach_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');
create type public.parent_relationship as enum ('MOTHER', 'FATHER', 'GUARDIAN', 'OTHER');
create type public.training_mode as enum ('ONLINE', 'OFFLINE', 'HYBRID');
create type public.batch_status as enum ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
create type public.batch_coach_role as enum ('PRIMARY', 'ASSISTANT', 'GUEST');
create type public.weekday as enum ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
create type public.enrollment_status as enum ('ACTIVE', 'PAUSED', 'COMPLETED', 'WITHDRAWN', 'CANCELLED');
create type public.batch_enrollment_status as enum ('ACTIVE', 'ENDED', 'TRANSFERRED');

-- ---------------------------------------------------------------------------
-- STUDENT CODE / COACH CODE GENERATION
-- ---------------------------------------------------------------------------
-- Concurrency-safe by construction: `nextval()` on a sequence is atomic
-- under concurrent transactions, unlike `select count(*) + 1` (which
-- races under concurrent inserts). See docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
-- "Student Code Generation" for the full rationale, including why the
-- numeric part is a single global monotonic counter rather than a
-- per-year counter (a per-year-reset counter needs its own concurrency-
-- safe bookkeeping table and buys little for an academy this size).
--
-- Format: PCA-<year-of-creation>-<5-digit global sequence>, e.g.
-- PCA-2026-00001. This is a NEW-SYSTEM identifier — existing (pre-
-- database) Phoenix student records, if any, are not claimed to already
-- follow this format.
create sequence public.student_code_seq;
create sequence public.coach_code_seq;

create or replace function public.generate_student_code()
returns text
language sql
as $$
  select 'PCA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.student_code_seq')::text, 5, '0');
$$;

create or replace function public.generate_coach_code()
returns text
language sql
as $$
  select 'PCA-C-' || lpad(nextval('public.coach_code_seq')::text, 4, '0');
$$;

comment on function public.generate_student_code() is
  'Concurrency-safe student_code generator (sequence-backed, not count(*)+1). New-system identifier format — does not claim to match any pre-existing Phoenix student code.';
comment on function public.generate_coach_code() is
  'Concurrency-safe coach_code generator (sequence-backed, not count(*)+1). New-system identifier format.';

-- ---------------------------------------------------------------------------
-- STUDENTS
-- ---------------------------------------------------------------------------
-- Deliberately narrow personal-data footprint: no government ID, no
-- medical data. See docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
-- "PII Security" for what was intentionally excluded and why.
create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  student_code text not null default public.generate_student_code(),
  full_name text not null,
  date_of_birth date not null,
  gender text,
  email text,
  phone text,
  whatsapp text,
  country text not null,
  state text,
  city text,
  address text,
  fide_id text,
  fide_rating integer,
  chess_association_id text,
  current_level text,
  joined_on date,
  status public.student_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_student_code_key unique (student_code),
  constraint students_profile_id_key unique (profile_id),
  constraint students_fide_rating_check check (fide_rating is null or fide_rating >= 0)
);

comment on table public.students is
  'Academy student business record — separate from profiles/auth. A student may exist with profile_id = null for years before a portal account is provisioned (see Phase 10 Account Provisioning).';
comment on column public.students.profile_id is
  'Nullable — set only once a portal account has been provisioned and linked (src/lib/actions/admin/accounts.ts). Never assume every student has one.';

create trigger set_students_updated_at
  before update on public.students
  for each row
  execute function public.set_updated_at();

alter table public.students enable row level security;

-- ---------------------------------------------------------------------------
-- PARENTS
-- ---------------------------------------------------------------------------
create table public.parents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email text,
  phone text not null,
  whatsapp text,
  country text,
  state text,
  city text,
  status public.parent_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parents_profile_id_key unique (profile_id)
);

comment on table public.parents is
  'Parent/guardian business record — separate from profiles/auth. Email is intentionally NOT unique: real households share one email, and some guardians have none on file. `phone` is the more reliable operational identifier here.';
comment on column public.parents.phone is
  'Stored as entered (documented normalization strategy: trimmed, no other reformatting applied at write time — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Parent Phone Normalization"). Search normalizes at query time instead of forcing a rigid input format on data entry.';

create trigger set_parents_updated_at
  before update on public.parents
  for each row
  execute function public.set_updated_at();

alter table public.parents enable row level security;

-- ---------------------------------------------------------------------------
-- STUDENT <-> PARENT (many-to-many)
-- ---------------------------------------------------------------------------
create table public.student_parents (
  student_id uuid not null references public.students (id) on delete cascade,
  parent_id uuid not null references public.parents (id) on delete cascade,
  relationship public.parent_relationship not null,
  is_primary boolean not null default false,
  can_receive_updates boolean not null default true,
  can_manage_student boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (student_id, parent_id)
);

comment on table public.student_parents is
  'Many-to-many student/parent relationship — one student may have multiple guardians (MOTHER + FATHER + GUARDIAN, etc.) and one parent may have multiple students. `relationship` is asserted explicitly per link, never inferred from gender.';

alter table public.student_parents enable row level security;

-- ---------------------------------------------------------------------------
-- COACHES
-- ---------------------------------------------------------------------------
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  coach_code text not null default public.generate_coach_code(),
  full_name text not null,
  email text,
  phone text,
  whatsapp text,
  bio text,
  -- Kept as a simple text[] rather than a relational specialization
  -- table or JSONB object — Phase 10 has no confirmed query requirement
  -- (e.g. "find all coaches specializing in X") that would justify the
  -- extra join/schema complexity. Revisit if that requirement appears.
  specializations text[] not null default '{}',
  status public.coach_status not null default 'ACTIVE',
  joined_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coaches_coach_code_key unique (coach_code),
  constraint coaches_profile_id_key unique (profile_id)
);

comment on table public.coaches is
  'Coach business record — separate from profiles/auth. No FIDE title/rating/certification/years-of-experience columns exist: none of that is confirmed Phoenix data, and Phase 10 does not invent it (see docs/ADMIN_OPERATIONS_ARCHITECTURE.md).';

create trigger set_coaches_updated_at
  before update on public.coaches
  for each row
  execute function public.set_updated_at();

alter table public.coaches enable row level security;

-- ---------------------------------------------------------------------------
-- BATCHES (training groups)
-- ---------------------------------------------------------------------------
-- academy_locations (0003) and programs (0004) are reused as-is — no
-- competing tables created.
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null,
  name text not null,
  program_id uuid not null references public.programs (id),
  location_id uuid references public.academy_locations (id),
  training_mode public.training_mode not null,
  level text,
  primary_coach_id uuid references public.coaches (id) on delete set null,
  capacity integer,
  status public.batch_status not null default 'DRAFT',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_batch_code_key unique (batch_code),
  constraint batches_capacity_check check (capacity is null or capacity > 0),
  constraint batches_date_range_check check (end_date is null or start_date is null or end_date >= start_date)
);

comment on table public.batches is
  'A Phoenix training group/cohort. No batches are seeded — every row is created through admin UI once real batches exist. `primary_coach_id` is a convenience denormalization; `batch_coaches` below is the authoritative, historized coach-assignment relationship.';

create trigger set_batches_updated_at
  before update on public.batches
  for each row
  execute function public.set_updated_at();

alter table public.batches enable row level security;

-- ---------------------------------------------------------------------------
-- BATCH <-> COACH (many-to-many, historized)
-- ---------------------------------------------------------------------------
create table public.batch_coaches (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  role public.batch_coach_role not null default 'PRIMARY',
  assigned_at timestamptz not null default now(),
  ended_at timestamptz
);

comment on table public.batch_coaches is
  'Historized batch/coach assignment. A batch may have more than one coach (PRIMARY/ASSISTANT/GUEST) and assignments end (ended_at set) rather than being deleted, preserving assignment history.';

-- Only one active (ended_at is null) assignment per batch+coach+role at a time.
create unique index batch_coaches_active_unique_idx
  on public.batch_coaches (batch_id, coach_id, role)
  where ended_at is null;

alter table public.batch_coaches enable row level security;

-- ---------------------------------------------------------------------------
-- CLASS SCHEDULES (recurring definitions — NOT attendance, NOT dated occurrences)
-- ---------------------------------------------------------------------------
-- See docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Schedule vs Future Class
-- Session Distinction": this table defines a recurring weekly slot for a
-- batch. A future `class_sessions` table (attendance phase) will
-- represent actual dated occurrences generated from these definitions;
-- attendance will attach there, never directly to this table.
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  day_of_week public.weekday not null,
  start_time time not null,
  end_time time not null,
  -- Asia/Kolkata is the confirmed current operating timezone for the
  -- academy's one confirmed location (Madipakkam, Chennai) — see
  -- supabase/migrations/0003_academy_structure.sql. Not a claim that
  -- every future batch is in this timezone; each row states its own.
  timezone text not null default 'Asia/Kolkata',
  effective_from date,
  effective_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_schedules_time_range_check check (end_time > start_time),
  constraint class_schedules_effective_range_check check (
    effective_until is null or effective_from is null or effective_until >= effective_from
  )
);

comment on table public.class_schedules is
  'Recurring weekly class schedule definitions for a batch — not attendance, not dated occurrences. See "Schedule vs Future Class Session Distinction" in docs/ADMIN_OPERATIONS_ARCHITECTURE.md.';

create trigger set_class_schedules_updated_at
  before update on public.class_schedules
  for each row
  execute function public.set_updated_at();

alter table public.class_schedules enable row level security;

-- ---------------------------------------------------------------------------
-- STUDENT PROGRAM ENROLLMENTS
-- ---------------------------------------------------------------------------
-- Enrollment in a PROGRAM. Optionally references the batch the student
-- was enrolled through, but batch MEMBERSHIP over time is tracked
-- separately in batch_enrollments below — see "Batch Membership
-- Decision" in docs/ADMIN_OPERATIONS_ARCHITECTURE.md for why these are
-- two tables, not one.
create table public.student_program_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  program_id uuid not null references public.programs (id),
  batch_id uuid references public.batches (id) on delete set null,
  status public.enrollment_status not null default 'ACTIVE',
  enrolled_on date not null default current_date,
  completed_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.student_program_enrollments is
  'Program enrollment — NOT payment/billing (no fee/payment columns exist here by design; see Phase 10 scope). A student may hold more than one concurrent enrollment (e.g. two programs) — no uniqueness constraint forces one-active-enrollment-only, since that business rule is not confirmed.';

create trigger set_student_program_enrollments_updated_at
  before update on public.student_program_enrollments
  for each row
  execute function public.set_updated_at();

alter table public.student_program_enrollments enable row level security;

-- ---------------------------------------------------------------------------
-- BATCH ENROLLMENTS (batch membership, historized)
-- ---------------------------------------------------------------------------
create table public.batch_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  status public.batch_enrollment_status not null default 'ACTIVE',
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.batch_enrollments is
  'Historized batch membership, kept separate from student_program_enrollments so a student can change batches over time (or belong to more than one) without losing assignment history. Whether "one active batch at a time" is a hard business rule is NOT yet confirmed by the academy — this schema does not enforce it (see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Batch Membership Decision"); it only prevents an exact duplicate active row for the same student+batch.';

-- Prevent an exact duplicate active assignment (same student, same
-- batch, both currently active) — this is NOT a one-batch-only rule.
create unique index batch_enrollments_active_unique_idx
  on public.batch_enrollments (student_id, batch_id)
  where status = 'ACTIVE';

alter table public.batch_enrollments enable row level security;
