-- =============================================================================
-- 0005_leads_and_enquiries.sql
-- =============================================================================
-- contact_enquiries and trial_bookings, mapped to the ACTUAL current
-- ContactForm (src/lib/validation/contact.ts) and TrialForm
-- (src/lib/validation/trial.ts) Zod schemas — no invented fields.

-- ---------------------------------------------------------------------------
-- CONTACT ENQUIRIES
-- ---------------------------------------------------------------------------
create type public.enquiry_status as enum (
  'NEW',
  'IN_REVIEW',
  'CONTACTED',
  'RESOLVED',
  'SPAM'
);

create table public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  country text not null,
  -- Free text, not an enum: enquiryTypes in contact.ts is presentational
  -- content that may be renamed/extended without a migration.
  enquiry_type text not null,
  subject text not null,
  message text not null,
  -- The form's required consent checkbox — a real, collected fact, not
  -- an invented field. Set server-side to now() at submission time.
  privacy_acknowledged_at timestamptz not null default now(),
  -- Public submissions can NEVER set this directly — only
  -- submit_contact_enquiry() (0009_submission_functions.sql) inserts a
  -- row, and it has no p_status parameter. Always starts NEW.
  status public.enquiry_status not null default 'NEW',
  source text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contact_enquiries is
  'Contact form submissions. status can only change via a future authorized staff action — public submission always creates NEW.';

create trigger set_contact_enquiries_updated_at
  before update on public.contact_enquiries
  for each row
  execute function public.set_updated_at();

alter table public.contact_enquiries enable row level security;

-- ---------------------------------------------------------------------------
-- TRIAL BOOKINGS
-- ---------------------------------------------------------------------------
create type public.trial_status as enum (
  'NEW',
  'CONTACTED',
  'ASSESSMENT_PENDING',
  'TRIAL_SCHEDULED',
  'TRIAL_COMPLETED',
  'CONVERTED',
  'CLOSED'
);

create table public.trial_bookings (
  id uuid primary key default gen_random_uuid(),
  student_full_name text not null,
  date_of_birth date not null,
  -- chessLevel / preferredProgram / trainingMode are free text, matching
  -- the enum values currently defined in src/lib/validation/trial.ts —
  -- kept as text (not a DB enum) since those lists belong to the
  -- programs content layer and can change without a schema migration.
  chess_level text not null,
  fide_id text,
  fide_rating integer,
  country text not null,
  state text not null,
  city text not null,
  preferred_program text not null,
  training_mode text not null,
  preferred_schedule text,
  goals text,
  -- Guardian fields: required only for minors, enforced by the
  -- submission function (0009), not by a NOT NULL constraint here —
  -- guardian requirement depends on date_of_birth, which SQL CHECK
  -- constraints can evaluate but the friendlier error path is inside
  -- the RPC function (see submit_trial_booking).
  parent_name text,
  parent_email text,
  parent_phone text,
  parent_relationship text,
  privacy_acknowledged_at timestamptz not null default now(),
  marketing_consent boolean not null default false,
  status public.trial_status not null default 'NEW',
  source text not null default 'website',
  -- Soft, advisory duplicate-detection hint (see docs/DATABASE_ARCHITECTURE.md,
  -- "Duplicate Protection Strategy") — NOT a unique constraint. Never
  -- used to silently reject a legitimate trial request.
  submission_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trial_bookings_fide_rating_check check (fide_rating is null or fide_rating >= 0),
  constraint trial_bookings_dob_not_future_check check (date_of_birth <= current_date)
);

comment on table public.trial_bookings is
  'Book a Trial submissions. Guardian fields are required for minors — enforced in submit_trial_booking(), not by a table-level NOT NULL, since the requirement is conditional on date_of_birth.';

create trigger set_trial_bookings_updated_at
  before update on public.trial_bookings
  for each row
  execute function public.set_updated_at();

alter table public.trial_bookings enable row level security;
