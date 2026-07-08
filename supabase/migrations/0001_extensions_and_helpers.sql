-- =============================================================================
-- 0001_extensions_and_helpers.sql
-- =============================================================================
-- Extensions and shared helper objects used by every later migration.
-- Kept as its own migration since it has no dependencies and everything
-- else depends on it.

-- gen_random_uuid() lives in pgcrypto on most Postgres versions Supabase
-- provisions. `IF NOT EXISTS` makes this safe to re-run.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
-- One shared trigger function, reused by every table with an updated_at
-- column, instead of duplicating the same trigger body per table (see
-- Phase 7 instructions: "Do not duplicate trigger code unnecessarily").
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared BEFORE UPDATE trigger function: stamps updated_at with now() on every row update. Attached per-table via individual CREATE TRIGGER statements.';
