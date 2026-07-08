-- =============================================================================
-- 0017_parent_portal_rls.sql
-- =============================================================================
-- Phase 12 — parent-scoped RLS, following the exact pattern established
-- in 0016_student_portal_rls.sql. Does not edit 0016 or any earlier
-- migration; adds new policies on top of tables that already have RLS
-- enabled since 0012.
--
-- SCOPE: PARENT-facing SELECT policies only. No INSERT/UPDATE/DELETE
-- policy is added for PARENT anywhere in this file — the Parent Portal
-- (Phase 12) is read-only, exactly like the Student Portal. Admin/
-- service-role access continues to bypass RLS entirely, unaffected by
-- anything here. Postgres RLS policies on the same table are OR'd
-- together (for the same command), so adding a parent-scoped SELECT
-- policy to `students` (for example) does not weaken or replace the
-- STUDENT-scoped `students_select_own` policy from 0016 — a caller only
-- ever sees the union of what their own applicable policies allow.
--
-- OWNERSHIP CHAIN: `auth.uid()` equals `profiles.id` (see 0016's
-- comment for the same verified fact), and a parent's own business
-- record is found via `parents.profile_id = auth.uid()`. A parent's
-- authorization over a student is a SECOND, separate relationship:
-- `student_parents.parent_id = <that parent's id> AND
-- student_parents.student_id = <the student in question>`. Every
-- policy below traces back to these two relationships — never to
-- student_code, never to an email/phone match, never to a
-- browser-supplied parent_id.

-- ---------------------------------------------------------------------------
-- HELPER: current_parent_id()
-- ---------------------------------------------------------------------------
-- Same rationale as 0016's current_student_id(): SECURITY DEFINER so it
-- can read `parents` once without that lookup being subject to (and
-- recursing through) the policy being defined using it. STABLE, pinned
-- search_path. Returns null for a non-parent caller or a PARENT profile
-- with no linked parents row — the same "not linked" case
-- `getCurrentParent()` handles in the application layer. Every policy
-- below treats null as "matches nothing."
create or replace function public.current_parent_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.parents where profile_id = auth.uid();
$$;

comment on function public.current_parent_id() is
  'Resolves the parents.id for the current auth.uid(), or null. Used inside parent-scoped RLS policies — see docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent RLS Helper Functions".';

revoke all on function public.current_parent_id() from public;
grant execute on function public.current_parent_id() to authenticated;

-- ---------------------------------------------------------------------------
-- HELPER: parent_has_student(target_student_id)
-- ---------------------------------------------------------------------------
-- The single relationship check every linked-student policy below is
-- built from. Returns false (never true) for any caller who is not a
-- parent, has no linked parents row, or has no student_parents row for
-- the given student — there is no "is_primary" or "can_manage_student"
-- condition here: the existence of the relationship itself is the read
-- authorization boundary for Phase 12 (see docs/PARENT_PORTAL_ARCHITECTURE.md,
-- "Parent Relationship Flag Decision" for why those two flags are not
-- used as a gate).
create or replace function public.parent_has_student(target_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.student_parents sp
    where sp.parent_id = public.current_parent_id() and sp.student_id = target_student_id
  );
$$;

comment on function public.parent_has_student(uuid) is
  'True only if the current auth.uid()-resolved parent has a student_parents row for target_student_id. See docs/PARENT_PORTAL_ARCHITECTURE.md, "student_parents Security Boundary".';

revoke all on function public.parent_has_student(uuid) from public;
grant execute on function public.parent_has_student(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PARENTS — a parent may read only their own row
-- ---------------------------------------------------------------------------
create policy "parents_select_own"
  on public.parents
  for select
  to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- STUDENT_PARENTS — a parent may read only their own relationship rows
-- ---------------------------------------------------------------------------
create policy "student_parents_select_own"
  on public.student_parents
  for select
  to authenticated
  using (parent_id = public.current_parent_id());

-- ---------------------------------------------------------------------------
-- STUDENTS — a parent may read only students linked via student_parents
-- ---------------------------------------------------------------------------
-- This is additive alongside 0016's `students_select_own` (STUDENT
-- role) — a caller sees the union of both, and in practice at most one
-- ever applies to a given profile's role.
create policy "students_select_for_linked_parent"
  on public.students
  for select
  to authenticated
  using (public.parent_has_student(id));

-- ---------------------------------------------------------------------------
-- STUDENT PROGRAM ENROLLMENTS — only for linked students
-- ---------------------------------------------------------------------------
create policy "student_program_enrollments_select_for_linked_parent"
  on public.student_program_enrollments
  for select
  to authenticated
  using (public.parent_has_student(student_id));

-- ---------------------------------------------------------------------------
-- BATCH ENROLLMENTS — only for linked students
-- ---------------------------------------------------------------------------
create policy "batch_enrollments_select_for_linked_parent"
  on public.batch_enrollments
  for select
  to authenticated
  using (public.parent_has_student(student_id));

-- ---------------------------------------------------------------------------
-- BATCHES — only batches a linked student is connected to, via either
-- linkage path (same dual-path pattern as 0016, for the same reason:
-- Phase 10 left "is batch membership always mirrored into
-- batch_enrollments" as an open question).
-- ---------------------------------------------------------------------------
create policy "batches_select_for_linked_parent"
  on public.batches
  for select
  to authenticated
  using (
    exists (
      select 1 from public.batch_enrollments be
      where be.batch_id = batches.id and public.parent_has_student(be.student_id)
    )
    or exists (
      select 1 from public.student_program_enrollments spe
      where spe.batch_id = batches.id and public.parent_has_student(spe.student_id)
    )
  );

-- ---------------------------------------------------------------------------
-- CLASS SCHEDULES — only for batches a linked student is connected to
-- ---------------------------------------------------------------------------
create policy "class_schedules_select_for_linked_parent"
  on public.class_schedules
  for select
  to authenticated
  using (
    exists (
      select 1 from public.batch_enrollments be
      where be.batch_id = class_schedules.batch_id and public.parent_has_student(be.student_id)
    )
    or exists (
      select 1 from public.student_program_enrollments spe
      where spe.batch_id = class_schedules.batch_id and public.parent_has_student(spe.student_id)
    )
  );

-- ---------------------------------------------------------------------------
-- BATCH COACHES — row is not PII (batch_id/coach_id/role/timestamps
-- only); safe to expose for a linked student's batches. Does NOT expose
-- coach contact details — that stays locked behind the RPC below, since
-- `coaches` itself gets no parent-facing SELECT policy either.
-- ---------------------------------------------------------------------------
create policy "batch_coaches_select_for_linked_parent"
  on public.batch_coaches
  for select
  to authenticated
  using (
    exists (
      select 1 from public.batch_enrollments be
      where be.batch_id = batch_coaches.batch_id and public.parent_has_student(be.student_id)
    )
    or exists (
      select 1 from public.student_program_enrollments spe
      where spe.batch_id = batch_coaches.batch_id and public.parent_has_student(spe.student_id)
    )
  );

-- ---------------------------------------------------------------------------
-- COACHES — deliberately NO parent SELECT policy (same reasoning as
-- 0016 for students): `coaches` holds email/phone/whatsapp/bio, and RLS
-- is row-level, not column-level. Narrow coach *display* data is
-- exposed through get_parent_linked_student_batch_coaches() below.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- get_parent_linked_student_batch_coaches — narrow, relationship-scoped
-- coach display for one linked student at a time
-- ---------------------------------------------------------------------------
-- Takes the target student as an explicit argument (unlike 0016's
-- zero-argument get_student_batch_coaches, since a parent may have more
-- than one linked student) — but authorization is enforced INSIDE the
-- query via parent_has_student(), not by trusting the caller. An
-- unauthorized target_student_id simply yields zero rows, exactly like
-- an authorized student with no assigned coach yet — indistinguishable,
-- so this function cannot be used to enumerate/confirm another family's
-- student relationship. Returns only full_name/role, never email/phone/
-- whatsapp/bio/specializations.
create or replace function public.get_parent_linked_student_batch_coaches(target_student_id uuid)
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
    and public.parent_has_student(target_student_id)
    and (
      exists (
        select 1 from public.batch_enrollments be
        where be.batch_id = bc.batch_id and be.student_id = target_student_id
      )
      or exists (
        select 1 from public.student_program_enrollments spe
        where spe.batch_id = bc.batch_id and spe.student_id = target_student_id
      )
    );
$$;

comment on function public.get_parent_linked_student_batch_coaches(uuid) is
  'Narrow, relationship-scoped coach display (full_name + role only, no contact fields) for one linked students batches. Authorization is enforced inside the query via parent_has_student(), not by the caller. See docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Coach Display Privacy".';

revoke all on function public.get_parent_linked_student_batch_coaches(uuid) from public;
grant execute on function public.get_parent_linked_student_batch_coaches(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PROGRAMS / ACADEMY_LOCATIONS — no new policy needed
-- ---------------------------------------------------------------------------
-- Both already have an `active = true` public read policy granted to
-- `anon, authenticated` from 0010_rls_policies.sql (Phase 7), reused
-- as-is by the Student Portal (0016) and reused as-is here — an
-- authenticated PARENT can already read active programs/locations,
-- which is all the portal needs (program name for linking, location
-- name for batch display). Nothing to add here.

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- COACH-scoped policies (a coach reading their assigned batch's
-- students) remain explicitly NOT built here — see
-- docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Deferred Future Portal
-- Policies", and docs/PARENT_PORTAL_ARCHITECTURE.md. Those wait for the
-- coach portal phase.
