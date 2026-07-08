-- =============================================================================
-- 0004_programs.sql
-- =============================================================================
-- DATABASE FOUNDATION ONLY. The public /programs system currently reads
-- exclusively from src/content/programs.ts (statically generated) — this
-- table is NOT populated and NOT read from by the website in Phase 7. It
-- exists so a future phase can migrate program content to Supabase
-- without a schema redesign. Deliberately NOT seeded with the current 6
-- programs: doing so would create a half-migrated system where some
-- program data lives in Supabase and some in TypeScript with no single
-- source of truth, which Phase 7's instructions explicitly rule out. See
-- docs/DATABASE_ARCHITECTURE.md, "Static Content vs Database".

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  short_description text,
  description text,
  -- Intentionally plain text, not an enum/CHECK list — program levels
  -- are still evolving business data, not a stable fixed set. Phase 7
  -- instructions explicitly warn against hardcoding six programs as an
  -- enum.
  level text,
  level_label text,
  active boolean not null default true,
  featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programs_slug_key unique (slug),
  constraint programs_display_order_check check (display_order >= 0)
);

comment on table public.programs is
  'Database foundation for future program migration. Empty by design in Phase 7 — the public site reads src/content/programs.ts exclusively. Do not populate until a dedicated migration phase reconciles this table with that file.';

create trigger set_programs_updated_at
  before update on public.programs
  for each row
  execute function public.set_updated_at();

alter table public.programs enable row level security;
