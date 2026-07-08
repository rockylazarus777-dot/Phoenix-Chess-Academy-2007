-- =============================================================================
-- 0011_indexes_and_constraints.sql
-- =============================================================================
-- Indexes for real, known query patterns only (see
-- docs/DATABASE_ARCHITECTURE.md, "Database Indexes" for the full list
-- and rationale). Uniqueness/CHECK constraints that are intrinsic to a
-- table's own business rules already live in that table's own migration
-- (e.g. tournaments_slug_key, the tournament_registrations dedupe
-- indexes) — this file only adds secondary lookup/sort indexes.

-- Staff review queues sort/filter by these.
create index contact_enquiries_created_at_idx on public.contact_enquiries (created_at desc);
create index contact_enquiries_status_idx on public.contact_enquiries (status);

create index trial_bookings_created_at_idx on public.trial_bookings (created_at desc);
create index trial_bookings_status_idx on public.trial_bookings (status);
create index trial_bookings_preferred_program_idx on public.trial_bookings (preferred_program);

-- Tournament listing queries filter/sort by status and start_date (the
-- Phase 6 /tournaments page groups by status, ordered by date).
create index tournaments_status_idx on public.tournaments (status);
create index tournaments_start_date_idx on public.tournaments (start_date);

-- Every tournament detail sub-table is queried "all rows for this
-- tournament_id" by the Phase 6 detail-page section components.
create index tournament_schedule_items_tournament_id_idx on public.tournament_schedule_items (tournament_id);
create index tournament_rule_sections_tournament_id_idx on public.tournament_rule_sections (tournament_id);
create index tournament_documents_tournament_id_idx on public.tournament_documents (tournament_id);
create index tournament_faqs_tournament_id_idx on public.tournament_faqs (tournament_id);
create index tournament_results_tournament_id_idx on public.tournament_results (tournament_id);
create index tournament_results_category_id_idx on public.tournament_results (category_id);
create index tournament_winners_tournament_id_idx on public.tournament_winners (tournament_id);
create index tournament_winners_category_id_idx on public.tournament_winners (category_id);
create index tournament_media_tournament_id_idx on public.tournament_media (tournament_id);

-- Registration review queues filter by status; category_id lookups
-- support "registrations for this category" review views.
create index tournament_registrations_status_idx on public.tournament_registrations (status);
create index tournament_registrations_category_id_idx on public.tournament_registrations (category_id);

-- The outbox worker's core query is "pending events whose next_attempt_at
-- has arrived, oldest first" — a composite index matching that access
-- pattern exactly.
create index reporting_outbox_status_next_attempt_idx
  on public.reporting_outbox (status, next_attempt_at);
