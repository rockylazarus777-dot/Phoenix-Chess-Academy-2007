-- =============================================================================
-- 0003_academy_structure.sql
-- =============================================================================
-- Foundation for future Phoenix branches/locations. Only the confirmed
-- current Madipakkam address is seeded (see PHOENIX_REAL_CONTENT_MASTER.md,
-- Section 3 — CONFIRMED). Canada/Germany/London/New York are NOT seeded;
-- those were historical-source-only claims, never owner-confirmed.

create table public.academy_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_locations_slug_key unique (slug)
);

comment on table public.academy_locations is
  'Physical academy locations. Only owner-confirmed addresses may be seeded here — see PHOENIX_REAL_CONTENT_MASTER.md before adding a row.';

create trigger set_academy_locations_updated_at
  before update on public.academy_locations
  for each row
  execute function public.set_updated_at();

alter table public.academy_locations enable row level security;

-- Deterministic slug + ON CONFLICT DO NOTHING: safe to re-run this
-- migration (or apply it more than once against the same database)
-- without creating a duplicate row.
insert into public.academy_locations (
  name, slug, address_line_1, address_line_2, city, state, postal_code, country, phone, email, active
) values (
  'Phoenix Chess Academy — Madipakkam',
  'madipakkam',
  '73A, 13th St, Ram Nagar, Kuberan Nagar',
  'Madipakkam',
  'Chennai',
  'Tamil Nadu',
  '600091',
  'India',
  '+91 63696 87328',
  'info@phoenixchessacademy.org',
  true
)
on conflict (slug) do nothing;
