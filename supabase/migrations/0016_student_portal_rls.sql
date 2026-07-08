-- =============================================================================
-- 0016_student_portal_rls.sql
-- =============================================================================
-- Phase 11 — the first real relationship-scoped RLS in this project.
-- Phase 10 (0013_admin_operations_rls.sql) deliberately left every
-- operational table with RLS enabled and ZERO policies, documented as
-- "deny-by-default until the actual portal query requirements exist."
-- This migration is that follow-up — it does not edit 0013, it adds new
-- policies on top of tables that already have RLS enabled.
--
-- SCOPE: STUDENT-facing SELECT policies only. No INSERT/UPDATE/DELETE
-- policy is added for STUDENT anywhere in this file — the student
-- portal (Phase 11) is read-only. Admin/service-role access continues
-- to bypass RLS entirely via the service-role client, unaffected by
-- anything here.
--
-- OWNERSHIP CHAIN: `auth.uid()` (the authenticated Supabase Auth user)
-- equals `profiles.id` (established in Phase 9/0002), and a student's
-- own business record is found via `students.profile_id = auth.uid()`.
-- Every policy below ultimately traces back to that one relationship —
-- never to `student_code`, never to an email match, never to a
-- browser-supplied ID.

-- ---------------------------------------------------------------------------
-- HELPER: current_student_id()
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it can read `students` once to resolve the caller's
-- own student row without that lookup itself being subject to (and
-- recursing through) the policy being defined using it. STABLE (not
-- VOLATILE) since it only reads, and pinned `search_path` to avoid a
-- search-path hijack. Returns null for a non-student caller or a
-- STUDENT profile with no linked students row (the same "not linked"
-- case `getCurrentStudent()` handles in the application layer) — every
-- policy below treats null as "matches nothing," never "matches
-- everything."
create or replace function public.current_student_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.students where profile_id = auth.uid();
$$;

comment on function public.current_student_id() is
  'Resolves the students.id for the current auth.uid(), or null. Used inside student-scoped RLS policies — see docs/STUDENT_PORTAL_ARCHITECTURE.md, "RLS Helper Functions".';

revoke all on function public.current_student_id() from public;
grant execute on function public.current_student_id() to authenticated;

-- ---------------------------------------------------------------------------
-- STUDENTS — a student may read only their own row
-- ---------------------------------------------------------------------------
create policy "students_select_own"
  on public.students
  for select
  to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- STUDENT PROGRAM ENROLLMENTS — own rows only
-- ---------------------------------------------------------------------------
create policy "student_program_enrollments_select_own"
  on public.student_program_enrollments
  for select
  to authenticated
  using (student_id = public.current_student_id());

-- ---------------------------------------------------------------------------
-- BATCH ENROLLMENTS — own rows only
-- ---------------------------------------------------------------------------
create policy "batch_enrollments_select_own"
  on public.batch_enrollments
  for select
  to authenticated
  using (student_id = public.current_student_id());

-- ---------------------------------------------------------------------------
-- BATCHES — only batches the student is connected to, via either a
-- batch_enrollments membership row or a direct batch_id on a program
-- enrollment (Phase 10 left "is batch membership always mirrored into
-- batch_enrollments" as an open question — this policy covers both
-- linkage paths so neither produces a silently-invisible batch).
-- ---------------------------------------------------------------------------
create policy "batches_select_for_own_student"
  on public.batches
  for select
  to authenticated
  using (
    exists (
      select 1 from public.batch_enrollments be
      where be.batch_id = batches.id and be.student_id = public.current_student_id()
    )
    or exists (
      select 1 from public.student_program_enrollments spe
      where spe.batch_id = batches.id and spe.student_id = public.current_student_id()
    )
  );

-- ---------------------------------------------------------------------------
-- CLASS SCHEDULES — only for batches the student is connected to
-- ---------------------------------------------------------------------------
create policy "class_schedules_select_for_own_batches"
  on public.class_schedules
  for select
  to authenticated
  using (
    exists (
      select 1 from public.batch_enrollments be
      where be.batch_id = class_schedules.batch_id and be.student_id = public.current_student_id()
    )
    or exists (
      select 1 from public.student_program_enrollments spe
      where spe.batch_id = class_schedules.batch_id and spe.student_id = public.current_student_id()
    )
  );

-- ---------------------------------------------------------------------------
-- BATCH COACHES — row is not PII (batch_id/coach_id/role/timestamps
-- only); safe to expose for the student's own batches. This does NOT
-- expose coach contact details — that stays locked behind the RPC
-- below, since `coaches` itself gets no student SELECT policy.
-- ---------------------------------------------------------------------------
create policy "batch_coaches_select_for_own_batches"
  on public.batch_coaches
  for select
  to authenticated
  using (
    exists (
      select 1 from public.batch_enrollments be
      where be.batch_id = batch_coaches.batch_id and be.student_id = public.current_student_id()
    )
    or exists (
      select 1 from public.student_program_enrollments spe
      where spe.batch_id = batch_coaches.batch_id and spe.student_id = public.current_student_id()
    )
  );

-- ---------------------------------------------------------------------------
-- COACHES — deliberately NO student SELECT policy.
-- ---------------------------------------------------------------------------
-- `coaches` holds email/phone/whatsapp/bio — RLS is row-level, not
-- column-level, so a broad "student can see coaches on their own
-- batches" policy would still let a student SELECT the full coach row
-- (including contact fields) for any coach on their batch. Instead,
-- narrow coach *display* data (id, full_name only) is exposed through
-- get_student_batch_coaches() below, a SECURITY DEFINER function that
-- internally re-derives the caller's own batches and returns only the
-- two safe columns. `coaches` itself remains deny-by-default for
-- `authenticated`, exactly as Phase 10 left it for everyone else. See
-- docs/STUDENT_PORTAL_ARCHITECTURE.md, "Coach Display Privacy Boundary".

-- ---------------------------------------------------------------------------
-- get_student_batch_coaches — narrow, self-scoped coach display
-- ---------------------------------------------------------------------------
-- Takes no parameters — always scoped to auth.uid() internally, never
-- to a caller-supplied student or batch ID. Returns only what the
-- portal UI needs to display ("Coach: <name>"); never email/phone/
-- whatsapp/bio/specializations.
create or replace function public.get_student_batch_coaches()
returns table (
  batch_id uuid,
  coach_id uuid,
  full_name text,
  role public.batch_coach_role
)
language sql
security definer
stable
set search_path = public
as $$
  select bc.batch_id, bc.coach_id, c.full_name, bc.role
  from public.batch_coaches bc
  join public.coaches c on c.id = bc.coach_id
  where bc.ended_at is null
    and (
      exists (
        select 1 from public.batch_enrollments be
        where be.batch_id = bc.batch_id and be.student_id = public.current_student_id()
      )
      or exists (
        select 1 from public.student_program_enrollments spe
        where spe.batch_id = bc.batch_id and spe.student_id = public.current_student_id()
      )
    );
$$;

comment on function public.get_student_batch_coaches() is
  'Narrow, self-scoped coach display (id + full_name + role only, no contact fields) for the current students batches. See docs/STUDENT_PORTAL_ARCHITECTURE.md, "Coach Display Privacy Boundary".';

revoke all on function public.get_student_batch_coaches() from public;
grant execute on function public.get_student_batch_coaches() to authenticated;

-- ---------------------------------------------------------------------------
-- PROGRAMS / ACADEMY_LOCATIONS — no new policy needed
-- ---------------------------------------------------------------------------
-- Both already have an `active = true` public read policy granted to
-- `anon, authenticated` from 0010_rls_policies.sql (Phase 7) — an
-- authenticated STUDENT can already read active programs/locations,
-- which is all the portal needs (program name for linking, location
-- name for batch display). Nothing to add here.

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- PARENT-scoped policies (a parent reading their linked students) and
-- COACH-scoped policies (a coach reading their assigned batch's
-- students) are explicitly NOT built here — see
-- docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Deferred Future Portal
-- Policies", and docs/STUDENT_PORTAL_ARCHITECTURE.md. Those wait for
-- the phases that build the parent/coach portals.
