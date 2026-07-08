-- =============================================================================
-- 0018_coach_portal_rls.sql
-- =============================================================================
-- Phase 13 — coach-scoped RLS, following the exact pattern established
-- in 0016_student_portal_rls.sql and 0017_parent_portal_rls.sql. Does
-- not edit either earlier migration; adds new policies on top of tables
-- that already have RLS enabled since 0012.
--
-- SCOPE: COACH-facing SELECT policies only. No INSERT/UPDATE/DELETE
-- policy is added for COACH anywhere in this file — the Coach Portal
-- (Phase 13) is read-only, exactly like the Student and Parent Portals.
-- Admin/service-role access continues to bypass RLS entirely.
--
-- OWNERSHIP CHAIN: `auth.uid()` equals `profiles.id` (verified in 0016's
-- comment), and a coach's own business record is found via
-- `coaches.profile_id = auth.uid()`. A coach's authorization over a
-- batch is a SECOND, separate relationship: `batch_coaches.coach_id =
-- <that coach's id> AND batch_coaches.batch_id = <the batch in
-- question> AND batch_coaches.ended_at IS NULL` — an ended assignment
-- is treated the same as no assignment. Every policy below traces back
-- to these two relationships — never to batch_code, program, location,
-- training mode, or batch status.

-- ---------------------------------------------------------------------------
-- HELPER: current_coach_id()
-- ---------------------------------------------------------------------------
create or replace function public.current_coach_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.coaches where profile_id = auth.uid();
$$;

comment on function public.current_coach_id() is
  'Resolves the coaches.id for the current auth.uid(), or null. Used inside coach-scoped RLS policies — see docs/COACH_PORTAL_ARCHITECTURE.md, "Coach RLS Helper Functions".';

revoke all on function public.current_coach_id() from public;
grant execute on function public.current_coach_id() to authenticated;

-- ---------------------------------------------------------------------------
-- HELPER: coach_has_batch(target_batch_id)
-- ---------------------------------------------------------------------------
-- Requires `ended_at is null` — a coach whose assignment to a batch has
-- ended no longer has portal access to that batch's operational data.
-- Returns false (never true) for any caller who is not a coach, has no
-- linked coaches row, or has no CURRENT batch_coaches row for the given
-- batch.
create or replace function public.coach_has_batch(target_batch_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.batch_coaches bc
    where bc.coach_id = public.current_coach_id()
      and bc.batch_id = target_batch_id
      and bc.ended_at is null
  );
$$;

comment on function public.coach_has_batch(uuid) is
  'True only if the current auth.uid()-resolved coach has a CURRENT (ended_at is null) batch_coaches row for target_batch_id. See docs/COACH_PORTAL_ARCHITECTURE.md, "batch_coaches Security Boundary".';

revoke all on function public.coach_has_batch(uuid) from public;
grant execute on function public.coach_has_batch(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- COACHES — a coach may read only their own row
-- ---------------------------------------------------------------------------
create policy "coaches_select_own"
  on public.coaches
  for select
  to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- BATCH_COACHES — a coach may read only their own assignment rows
-- ---------------------------------------------------------------------------
create policy "batch_coaches_select_own"
  on public.batch_coaches
  for select
  to authenticated
  using (coach_id = public.current_coach_id());

-- ---------------------------------------------------------------------------
-- BATCHES — a coach may read only batches they are currently assigned to
-- ---------------------------------------------------------------------------
-- Additive alongside 0016's `batches_select_for_own_student` and
-- 0017's `batches_select_for_linked_parent` — Postgres OR's permissive
-- policies together, so this does not weaken either.
create policy "batches_select_for_assigned_coach"
  on public.batches
  for select
  to authenticated
  using (public.coach_has_batch(id));

-- ---------------------------------------------------------------------------
-- BATCH ENROLLMENTS — only for the coach's assigned batches. Contains
-- no student PII (student_id/batch_id/status/timestamps only), so a
-- direct SELECT policy is safe here even though the `students` table
-- itself gets none (see "STUDENTS TABLE PRIVACY DECISION" below).
-- ---------------------------------------------------------------------------
create policy "batch_enrollments_select_for_assigned_coach"
  on public.batch_enrollments
  for select
  to authenticated
  using (public.coach_has_batch(batch_id));

-- ---------------------------------------------------------------------------
-- STUDENT PROGRAM ENROLLMENTS — only for the coach's assigned batches,
-- needed to resolve the dual-path roster (a student may be connected to
-- a batch only through student_program_enrollments.batch_id, without a
-- mirrored batch_enrollments row). Same non-PII justification as above
-- — this table has no student contact/PII columns.
-- ---------------------------------------------------------------------------
create policy "student_program_enrollments_select_for_assigned_coach"
  on public.student_program_enrollments
  for select
  to authenticated
  using (batch_id is not null and public.coach_has_batch(batch_id));

-- ---------------------------------------------------------------------------
-- CLASS SCHEDULES — only for the coach's assigned batches
-- ---------------------------------------------------------------------------
create policy "class_schedules_select_for_assigned_coach"
  on public.class_schedules
  for select
  to authenticated
  using (public.coach_has_batch(batch_id));

-- ---------------------------------------------------------------------------
-- STUDENTS TABLE PRIVACY DECISION — deliberately NO coach SELECT policy
-- ---------------------------------------------------------------------------
-- `students` holds date_of_birth/address/email/phone/whatsapp/notes/
-- chess_association_id — RLS is row-level, not column-level, so a
-- policy of the shape "coach can see students on assigned batches"
-- would still let a coach SELECT the full row (every PII column) for
-- any student on their batch, regardless of what the UI code selects.
-- Instead, narrow roster *display* data is exposed through
-- get_coach_batch_roster() below, a SECURITY DEFINER function that
-- internally re-derives the caller's own assigned batch and returns
-- only the seven safe columns. `students` itself remains deny-by-
-- default for `authenticated` coaches, exactly as it already is for
-- everyone except the row's own linked profile (0016) and that
-- student's linked parents (0017). See
-- docs/COACH_PORTAL_ARCHITECTURE.md, "Roster Privacy RPC Decision".

-- ---------------------------------------------------------------------------
-- get_coach_batch_roster — narrow, self-scoped roster for one assigned
-- batch at a time
-- ---------------------------------------------------------------------------
-- Takes the target batch as an explicit argument (a coach may have more
-- than one assigned batch) — authorization is enforced INSIDE the
-- query via coach_has_batch(), not by trusting the caller. An
-- unauthorized target_batch_id simply yields zero rows.
--
-- ROSTER DUAL-PATH STRATEGY: a student is included if EITHER a
-- batch_enrollments row OR a student_program_enrollments row links them
-- to this batch (both linkage paths Phase 10 left open — see
-- docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Batch Membership Decision").
-- Deduplicated by student.id via the two EXISTS clauses in the WHERE
-- (a student matching both paths still produces exactly one output
-- row). `assignment_status` is resolved via a LATERAL subquery that
-- picks the single most relevant batch_enrollments row for that
-- student+batch (an ACTIVE row if one exists, otherwise the most
-- recently assigned row) — if the student has NO batch_enrollments row
-- at all (linked only via student_program_enrollments.batch_id),
-- `assignment_status` is NULL. This is a deliberate, documented choice:
-- NULL here means "connected via program enrollment only," never a
-- fabricated 'ACTIVE' batch_enrollments status.
create or replace function public.get_coach_batch_roster(target_batch_id uuid)
returns table (
  student_id uuid,
  student_code text,
  full_name text,
  current_level text,
  status public.student_status,
  fide_id text,
  fide_rating integer,
  assignment_status public.batch_enrollment_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id,
    s.student_code,
    s.full_name,
    s.current_level,
    s.status,
    s.fide_id,
    s.fide_rating,
    be_best.status as assignment_status
  from public.students s
  left join lateral (
    select be_inner.status
    from public.batch_enrollments be_inner
    where be_inner.student_id = s.id and be_inner.batch_id = target_batch_id
    order by (be_inner.status = 'ACTIVE') desc, be_inner.assigned_at desc
    limit 1
  ) be_best on true
  where public.coach_has_batch(target_batch_id)
    and (
      exists (
        select 1 from public.batch_enrollments be
        where be.student_id = s.id and be.batch_id = target_batch_id
      )
      or exists (
        select 1 from public.student_program_enrollments spe
        where spe.student_id = s.id and spe.batch_id = target_batch_id
      )
    );
$$;

comment on function public.get_coach_batch_roster(uuid) is
  'Narrow, self-scoped student roster (student_code/full_name/current_level/status/fide_id/fide_rating/assignment_status only — no DOB/address/email/phone/whatsapp/notes/parent data) for one of the callers assigned batches. Dual-path membership, deduplicated by student id. See docs/COACH_PORTAL_ARCHITECTURE.md, "Roster Dual-Path Decision".';

revoke all on function public.get_coach_batch_roster(uuid) from public;
grant execute on function public.get_coach_batch_roster(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PROGRAMS / ACADEMY_LOCATIONS — no new policy needed
-- ---------------------------------------------------------------------------
-- Both already have an `active = true` public read policy granted to
-- `anon, authenticated` from 0010_rls_policies.sql (Phase 7), reused
-- as-is by the Student Portal (0016) and Parent Portal (0017), and
-- reused as-is here.

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No PARENT or STUDENT contact data is exposed to a COACH anywhere in
-- this migration — `parents`, `student_parents`, and the sensitive
-- columns of `students` remain fully deny-by-default for the COACH
-- role. Attendance/progress/evaluation-scoped policies are deferred to
-- future phases once those systems exist.
