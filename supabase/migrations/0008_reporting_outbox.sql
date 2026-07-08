-- =============================================================================
-- 0008_reporting_outbox.sql
-- =============================================================================
-- Reliable asynchronous reporting/export events. Google Sheets is never
-- called as part of the primary form-submission transaction — see
-- docs/GOOGLE_SHEETS_REPORTING.md, "Why Outbox Architecture". A row here
-- is created in the SAME transaction as the business record insert (see
-- 0009_submission_functions.sql), so a Sheets outage can never cause a
-- valid Supabase submission to silently go unreported or, worse, fail.

create type public.outbox_event_status as enum (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

create table public.reporting_outbox (
  id uuid primary key default gen_random_uuid(),
  -- e.g. 'contact_enquiry.created', 'trial_booking.created',
  -- 'tournament_registration.created'
  event_type text not null,
  -- e.g. 'contact_enquiry', 'trial_booking', 'tournament_registration'
  aggregate_type text not null,
  aggregate_id uuid not null,
  -- Only non-secret, already-public-within-the-org business fields
  -- belong here — see docs/GOOGLE_SHEETS_REPORTING.md, "Sheets Field
  -- Mapping". NEVER a Supabase service-role key or a Google private key.
  payload jsonb not null,
  status public.outbox_event_status not null default 'PENDING',
  attempt_count integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint reporting_outbox_attempt_count_check check (attempt_count >= 0)
);

comment on table public.reporting_outbox is
  'Asynchronous reporting queue for Google Sheets sync. Supabase is always written first — this table records that a reporting event is owed, not the business record itself. Zero anon/authenticated RLS policies; only the service-role sync worker (src/lib/google/sheets.ts via /api/internal/reporting/sync) reads or updates this table.';

alter table public.reporting_outbox enable row level security;
