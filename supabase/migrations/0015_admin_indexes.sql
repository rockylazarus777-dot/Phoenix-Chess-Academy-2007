-- =============================================================================
-- 0015_admin_indexes.sql
-- =============================================================================
-- Indexes for Phase 10's real, known access patterns (server-side
-- search/filter/sort/pagination at 5,000+ student scale) + the
-- deterministic programs seed needed so batches/enrollments have a
-- stable program_id foreign key to reference.

-- pg_trgm powers fast ILIKE/substring search on name/email columns —
-- required so student/parent/coach search stays fast without ever
-- fetching the full table into the application to filter in memory.
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- STUDENTS
-- ---------------------------------------------------------------------------
create index students_full_name_trgm_idx on public.students using gin (full_name extensions.gin_trgm_ops);
create index students_email_trgm_idx on public.students using gin (email extensions.gin_trgm_ops) where email is not null;
create index students_phone_idx on public.students (phone) where phone is not null;
create index students_fide_id_idx on public.students (fide_id) where fide_id is not null;
create index students_status_idx on public.students (status);
create index students_current_level_idx on public.students (current_level) where current_level is not null;
create index students_created_at_idx on public.students (created_at desc);
create index students_profile_id_idx on public.students (profile_id) where profile_id is not null;

-- ---------------------------------------------------------------------------
-- PARENTS
-- ---------------------------------------------------------------------------
create index parents_full_name_trgm_idx on public.parents using gin (full_name extensions.gin_trgm_ops);
create index parents_phone_idx on public.parents (phone);
create index parents_status_idx on public.parents (status);
create index parents_created_at_idx on public.parents (created_at desc);

-- ---------------------------------------------------------------------------
-- STUDENT_PARENTS
-- ---------------------------------------------------------------------------
-- (student_id, parent_id) primary key already covers "all parents for a
-- student" lookups; the reverse direction ("all students for a parent")
-- needs its own index.
create index student_parents_parent_id_idx on public.student_parents (parent_id);

-- ---------------------------------------------------------------------------
-- COACHES
-- ---------------------------------------------------------------------------
create index coaches_full_name_trgm_idx on public.coaches using gin (full_name extensions.gin_trgm_ops);
create index coaches_status_idx on public.coaches (status);
create index coaches_created_at_idx on public.coaches (created_at desc);

-- ---------------------------------------------------------------------------
-- BATCHES
-- ---------------------------------------------------------------------------
create index batches_program_id_idx on public.batches (program_id);
create index batches_location_id_idx on public.batches (location_id) where location_id is not null;
create index batches_status_idx on public.batches (status);
create index batches_primary_coach_id_idx on public.batches (primary_coach_id) where primary_coach_id is not null;

-- ---------------------------------------------------------------------------
-- BATCH_COACHES
-- ---------------------------------------------------------------------------
create index batch_coaches_batch_id_idx on public.batch_coaches (batch_id);
create index batch_coaches_coach_id_idx on public.batch_coaches (coach_id);

-- ---------------------------------------------------------------------------
-- CLASS_SCHEDULES
-- ---------------------------------------------------------------------------
create index class_schedules_batch_id_idx on public.class_schedules (batch_id);
create index class_schedules_day_of_week_idx on public.class_schedules (day_of_week);
create index class_schedules_active_idx on public.class_schedules (active);

-- ---------------------------------------------------------------------------
-- STUDENT_PROGRAM_ENROLLMENTS
-- ---------------------------------------------------------------------------
create index student_program_enrollments_student_id_idx on public.student_program_enrollments (student_id);
create index student_program_enrollments_program_id_idx on public.student_program_enrollments (program_id);
create index student_program_enrollments_batch_id_idx on public.student_program_enrollments (batch_id) where batch_id is not null;
create index student_program_enrollments_status_idx on public.student_program_enrollments (status);

-- ---------------------------------------------------------------------------
-- BATCH_ENROLLMENTS
-- ---------------------------------------------------------------------------
create index batch_enrollments_student_id_idx on public.batch_enrollments (student_id);
create index batch_enrollments_batch_id_idx on public.batch_enrollments (batch_id);
create index batch_enrollments_status_idx on public.batch_enrollments (status);

-- =============================================================================
-- PROGRAM DATABASE / STATIC CONTENT SYNC
-- =============================================================================
-- `programs` (0004) exists but was intentionally left empty in Phase 7 —
-- the public /programs pages read exclusively from
-- src/content/programs.ts. Phase 10 needs a real programs.id for
-- batches/enrollments to reference as a foreign key, so the six
-- currently authoritative program slugs/names from
-- src/content/programs.ts are seeded here, deterministically and
-- idempotently (ON CONFLICT DO NOTHING, matching the pattern already
-- used for academy_locations in 0003).
--
-- SYNC STRATEGY (see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Program
-- Database Sync Strategy" for the full writeup): src/content/programs.ts
-- remains the single source of truth for PUBLIC marketing copy
-- (description, skills, FAQ, images) — this table is NOT read by the
-- public website in Phase 10, and this migration does not change that.
-- Only `slug`, `name`, `short_description`, `level`, and `level_label`
-- are mirrored here, and only so admin operational records have a
-- stable id to reference. If a program's public name/slug ever changes
-- in the TypeScript source, this row must be updated in a NEW migration
-- (never by editing this one) to keep the two in sync — this migration
-- does not create an automatic sync mechanism, only the initial
-- snapshot.
insert into public.programs (slug, name, short_description, level, level_label, active, display_order) values
  ('beginner-chess', 'Beginner Chess', 'A structured first step into chess — rules, board vision, and the habits that make later stages click.', 'beginner', 'Foundational', true, 1),
  ('intermediate-chess', 'Intermediate Chess', 'Tactical pattern recognition and opening principles for players ready to compete with intent.', 'intermediate', 'Developing', true, 2),
  ('advanced-chess', 'Advanced Chess', 'Deeper strategic understanding, calculation training, and endgame technique for serious players.', 'advanced', 'Advanced', true, 3),
  ('professional-training', 'Professional Chess Training', 'High-intensity coaching for players targeting competitive titles and national-level results.', 'professional', 'Competitive / Professional', true, 4),
  ('tournament-preparation', 'Tournament Preparation', 'Focused preparation cycles — opening repertoire, time management, and tournament-day discipline.', 'tournament-prep', 'Tournament-Focused', true, 5),
  ('online-chess-coaching', 'Online Chess Coaching', 'The same structured Phoenix curriculum, delivered live online for students anywhere in the world.', 'online', 'Flexible / Remote', true, 6)
on conflict (slug) do nothing;
