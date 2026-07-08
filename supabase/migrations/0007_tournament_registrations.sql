-- =============================================================================
-- 0007_tournament_registrations.sql
-- =============================================================================
-- Maps the actual Phase 6 TournamentRegisterForm /
-- src/lib/validation/tournamentRegistration.ts schema. Because payment
-- is not implemented, the default/initial status is PENDING — never
-- CONFIRMED, never a "PAID" value that doesn't exist yet.

create type public.tournament_registration_status as enum (
  'PENDING',
  'UNDER_REVIEW',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'WAITLISTED'
);

create table public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  -- Resolved server-side by submit_tournament_registration() from
  -- (p_tournament_slug, p_category_key) — never trusted directly from
  -- the client as a raw UUID. See 0009_submission_functions.sql.
  tournament_id uuid not null references public.tournaments (id) on delete restrict,
  category_id uuid not null references public.tournament_categories (id) on delete restrict,
  player_full_name text not null,
  date_of_birth date not null,
  gender text,
  fide_id text,
  fide_rating integer,
  chess_association_id text,
  country text not null,
  state text not null,
  city text not null,
  email text not null,
  phone text not null,
  whatsapp text,
  guardian_name text,
  guardian_relationship text,
  guardian_email text,
  guardian_phone text,
  current_chess_level text,
  school_or_academy text,
  club text,
  -- Required consents in tournamentRegistrationSchema (rulesConsent /
  -- privacyConsent are z.literal(true)) — stamped server-side at
  -- submission time, not client-supplied timestamps.
  rules_acknowledged_at timestamptz not null default now(),
  privacy_acknowledged_at timestamptz not null default now(),
  media_consent boolean not null default false,
  marketing_consent boolean not null default false,
  -- Public submissions can NEVER set this — submit_tournament_registration()
  -- has no p_status parameter. Payment is not implemented, so this must
  -- never default to CONFIRMED/PAID.
  status public.tournament_registration_status not null default 'PENDING',
  source text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_registrations_fide_rating_check check (fide_rating is null or fide_rating >= 0),
  constraint tournament_registrations_dob_not_future_check check (date_of_birth <= current_date)
);

comment on table public.tournament_registrations is
  'Tournament registration submissions. status always starts PENDING (no payment processing exists yet) — see docs/DATABASE_ARCHITECTURE.md, "Tournament Registration Status".';

create trigger set_tournament_registrations_updated_at
  before update on public.tournament_registrations
  for each row
  execute function public.set_updated_at();

alter table public.tournament_registrations enable row level security;

-- ---------------------------------------------------------------------------
-- DUPLICATE PROTECTION (see docs/DATABASE_ARCHITECTURE.md, "Duplicate
-- Protection Strategy" for the full tradeoff discussion)
-- ---------------------------------------------------------------------------
-- 1. Same tournament + category + contact email + date of birth: blocks
--    an accidental exact double-submit while still allowing two siblings
--    who share a parent's contact email, since their dates of birth
--    differ. Two players with genuinely identical (tournament, category,
--    email, DOB) are treated as the same registration — a known, narrow
--    edge case (e.g. twins sharing a parent's email) documented as a
--    limitation rather than silently working around it with a weaker
--    constraint.
create unique index tournament_registrations_dedupe_email_dob_idx
  on public.tournament_registrations (tournament_id, category_id, email, date_of_birth);

-- 2. Same tournament + category + FIDE ID, only when a FIDE ID was
--    actually supplied: a stronger identity signal than email+DOB when
--    available. Partial index so players without a FIDE ID (the common
--    case for junior/beginner players) are never constrained by it.
create unique index tournament_registrations_dedupe_fide_id_idx
  on public.tournament_registrations (tournament_id, category_id, fide_id)
  where fide_id is not null and fide_id <> '';
