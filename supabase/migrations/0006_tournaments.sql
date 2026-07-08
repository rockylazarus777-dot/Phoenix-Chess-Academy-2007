-- =============================================================================
-- 0006_tournaments.sql
-- =============================================================================
-- Tournament database foundation matching the Phase 6 public architecture
-- (src/content/tournaments.ts). NO tournaments are inserted here — the
-- content layer's `tournaments: Tournament[] = []` stays the single
-- source of truth for public display in Phase 7 (see
-- docs/DATABASE_ARCHITECTURE.md, "Static Content vs Database"). This
-- schema exists so (a) tournament_registrations has something real to
-- reference once a real tournament is entered, and (b) a future phase
-- can migrate public tournament display to Supabase without a schema
-- rework.
--
-- NORMALIZATION DECISION: schedule/rules/documents/FAQs/results/winners/
-- gallery are modeled as their own tables (one row per item) because
-- they are independently orderable, filterable, and — for results/
-- winners — need their own foreign keys to tournament_categories.
-- Tie-break values (tournament_results.tie_breaks) use JSONB instead of
-- a `tournament_result_tiebreaks` table: a tie-break is just an ordered
-- list of small (label, value) pairs, is never queried/filtered on its
-- own, and always displayed as a unit — normalizing it into another
-- table would add a join for no real query benefit. `tournaments.
-- highlights` is JSONB for the same reason (small, fixed-shape,
-- display-only list).

create type public.tournament_status as enum (
  'DRAFT',
  'UPCOMING',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'LIVE',
  'COMPLETED',
  'CANCELLED'
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  short_name text,
  description text,
  status public.tournament_status not null default 'DRAFT',
  -- Free text (state / academy / open / student / age-category / national
  -- / international, per Phase 6) — not an enum, so new tournament types
  -- don't require a migration.
  tournament_type text,
  level text,
  start_date date not null,
  end_date date,
  registration_open_date timestamptz,
  registration_close_date timestamptz,
  timezone text,
  venue_name text,
  address text,
  city text,
  state text,
  country text,
  map_url text,
  hero_image text,
  card_image text,
  image_position text,
  organizer text,
  chief_arbiter text,
  contact_email text,
  contact_phone text,
  registration_enabled boolean not null default false,
  registration_url text,
  entry_fee numeric(10, 2),
  currency text default 'INR',
  max_participants integer,
  registered_participants integer not null default 0,
  -- Small, fixed-shape, display-only list of { label, value } pairs — see
  -- normalization decision note above.
  highlights jsonb,
  related_slugs text[],
  featured boolean not null default false,
  active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_slug_key unique (slug),
  constraint tournaments_entry_fee_check check (entry_fee is null or entry_fee >= 0),
  constraint tournaments_max_participants_check check (max_participants is null or max_participants >= 0),
  constraint tournaments_registered_participants_check check (registered_participants >= 0),
  constraint tournaments_end_date_check check (end_date is null or end_date >= start_date)
);

comment on table public.tournaments is
  'Tournament database foundation. Empty by design — src/content/tournaments.ts remains the public display source of truth in Phase 7. A row here is required only so tournament_registrations has something to reference once a real tournament exists in both places.';

create trigger set_tournaments_updated_at
  before update on public.tournaments
  for each row
  execute function public.set_updated_at();

alter table public.tournaments enable row level security;

-- ---------------------------------------------------------------------------
create table public.tournament_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  -- Matches the content-layer TournamentCategory.id string exactly — the
  -- bridge that lets submit_tournament_registration() resolve a category
  -- by (tournament slug, category_key) instead of trusting a client-
  -- supplied UUID. See docs/DATABASE_ARCHITECTURE.md, "Tournament
  -- Registration Validation".
  category_key text not null,
  name text not null,
  min_age integer,
  max_age integer,
  min_rating integer,
  max_rating integer,
  gender_restriction text,
  entry_fee numeric(10, 2),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_categories_key_unique unique (tournament_id, category_key),
  constraint tournament_categories_min_age_check check (min_age is null or min_age >= 0),
  constraint tournament_categories_max_age_check check (max_age is null or max_age >= 0),
  constraint tournament_categories_min_rating_check check (min_rating is null or min_rating >= 0),
  constraint tournament_categories_max_rating_check check (max_rating is null or max_rating >= 0),
  constraint tournament_categories_entry_fee_check check (entry_fee is null or entry_fee >= 0),
  constraint tournament_categories_display_order_check check (display_order >= 0)
);

create trigger set_tournament_categories_updated_at
  before update on public.tournament_categories
  for each row
  execute function public.set_updated_at();

alter table public.tournament_categories enable row level security;

-- ---------------------------------------------------------------------------
create table public.tournament_schedule_items (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  item_date date,
  start_time time,
  end_time time,
  title text not null,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_schedule_items_display_order_check check (display_order >= 0)
);

alter table public.tournament_schedule_items enable row level security;

-- ---------------------------------------------------------------------------
create table public.tournament_rule_sections (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  title text not null,
  body text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_rule_sections_display_order_check check (display_order >= 0)
);

alter table public.tournament_rule_sections enable row level security;

-- ---------------------------------------------------------------------------
create table public.tournament_documents (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  title text not null,
  url text not null,
  doc_type text,
  file_size text,
  is_external boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_documents_display_order_check check (display_order >= 0)
);

alter table public.tournament_documents enable row level security;

-- ---------------------------------------------------------------------------
create table public.tournament_faqs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  question text not null,
  answer text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_faqs_display_order_check check (display_order >= 0)
);

alter table public.tournament_faqs enable row level security;

-- ---------------------------------------------------------------------------
create table public.tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete set null,
  rank integer,
  player_name text not null,
  -- Text, not numeric: scores are commonly displayed as "7.5/9", not a
  -- single number.
  score text,
  -- See normalization decision note at the top of this file.
  tie_breaks jsonb,
  rating integer,
  federation text,
  state text,
  prize text,
  created_at timestamptz not null default now(),
  constraint tournament_results_rank_check check (rank is null or rank >= 1),
  constraint tournament_results_rating_check check (rating is null or rating >= 0)
);

alter table public.tournament_results enable row level security;

-- ---------------------------------------------------------------------------
create table public.tournament_winners (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete set null,
  player_name text not null,
  position_title text,
  photo_url text,
  achievement text,
  rating integer,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_winners_rating_check check (rating is null or rating >= 0),
  constraint tournament_winners_display_order_check check (display_order >= 0)
);

alter table public.tournament_winners enable row level security;

-- ---------------------------------------------------------------------------
-- Gallery images only — hero_image/card_image are single columns on
-- `tournaments` already (Phase 6's MEDIA_MAPPING.md hero.webp/card.webp).
create table public.tournament_media (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  image_url text not null,
  alt_text text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_media_display_order_check check (display_order >= 0)
);

alter table public.tournament_media enable row level security;
