-- =============================================================================
-- 0024_assignments_rls.sql
-- =============================================================================
-- Phase 16 — RLS policies and RPC functions for assignments /
-- assignment_recipients / assignment_submissions (schema created in
-- 0023_assignments_submissions.sql). Does not edit 0023 or any earlier
-- migration.
--
-- Reuses current_coach_id() / coach_has_batch() (0018), current_student_id()
-- (0016), current_parent_id() / parent_has_student() (0017), and
-- student_in_batch_roster() (0022) as-is — no redefinition.
--
-- SCOPE: STUDENT and PARENT get NO direct RLS SELECT policy on any of the
-- three tables — all access goes through narrow SECURITY DEFINER RPCs
-- (get_student_assignments/get_student_assignment/
-- get_parent_student_assignments/get_parent_student_assignment), mirroring
-- the Phase 14/15 decision. COACH gets a direct SELECT policy on
-- `assignments` only (same historical read rule as student_progress_
-- evaluations); `assignment_recipients`/`assignment_submissions` get a
-- coach SELECT policy scoped via a join back to `assignments` visibility
-- (mirroring student_progress_area_ratings' policy in 0022) — these two
-- tables carry no independent PII, so a join-scoped read is safe. No
-- INSERT/UPDATE/DELETE policy exists for COACH on any of the three tables
-- — all writes go exclusively through the six RPCs below.

-- ---------------------------------------------------------------------------
-- HELPER: assignment_batch_roster_student_ids(target_batch_id)
-- ---------------------------------------------------------------------------
-- CURRENT (not historical/date-aware) dual-path membership list — the
-- bulk-list counterpart to student_in_batch_roster() (0022), used only to
-- build the assignment_recipients snapshot for a BATCH-audience assignment
-- at publish time. Same non-date-aware rationale as
-- student_in_batch_roster(): a homework assignment is not tied to one
-- dated occurrence the way a class session is.
--
-- ACCESS: intentionally NOT granted to authenticated — same enumeration-
-- prevention rationale as session_eligible_student_ids() (0020) and
-- student_in_batch_roster() (0022). Only called from inside
-- publish_assignment() below, which performs its own authorization first.
create or replace function public.assignment_batch_roster_student_ids(target_batch_id uuid)
returns table (student_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select be.student_id
  from public.batch_enrollments be
  where be.batch_id = target_batch_id
  union
  select spe.student_id
  from public.student_program_enrollments spe
  where spe.batch_id = target_batch_id;
$$;

comment on function public.assignment_batch_roster_student_ids(uuid) is
  'Internal-only current (non-historical) dual-path batch roster list — NOT granted to authenticated. Called only from publish_assignment() to build the assignment_recipients snapshot. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Audience Snapshot Decision".';

revoke all on function public.assignment_batch_roster_student_ids(uuid) from public;

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS RLS — coach read only, no write policy
-- ---------------------------------------------------------------------------
-- COACH HISTORICAL READ RULE (identical shape to student_progress_
-- evaluations, 0022): a coach may read an assignment when
-- assignment.coach_id = current_coach_id() OR the coach currently manages
-- assignment.batch_id (coach_has_batch()) — supports batch continuity
-- across PRIMARY/ASSISTANT/GUEST coach handoffs while letting a coach keep
-- reading their own authored assignments after their own assignment ends.
-- Mutation (update/publish/archive) is always STRICTER — author-only AND
-- current batch assignment — enforced entirely inside the RPCs below, not
-- by this policy.
create policy "assignments_select_for_coach"
  on public.assignments
  for select
  to authenticated
  using (coach_id = public.current_coach_id() or public.coach_has_batch(batch_id));

create policy "assignment_recipients_select_for_coach"
  on public.assignment_recipients
  for select
  to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_recipients.assignment_id
        and (a.coach_id = public.current_coach_id() or public.coach_has_batch(a.batch_id))
    )
  );

create policy "assignment_submissions_select_for_coach"
  on public.assignment_submissions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id
        and (a.coach_id = public.current_coach_id() or public.coach_has_batch(a.batch_id))
    )
  );

-- ---------------------------------------------------------------------------
-- create_assignment — the ONLY way a new assignment is created
-- ---------------------------------------------------------------------------
-- Always inserted as DRAFT. coach_id/created_by are always server-derived
-- from current_coach_id()/auth.uid() — never accepted as parameters.
-- program_id is always derived from the target batch's own program_id
-- (batches.program_id is NOT NULL) — target_program_id, if supplied, is
-- validated to match rather than trusted. session_id, if supplied, must
-- belong to the same target_batch_id. For STUDENT audience, the student
-- must be a current member of the target batch's roster
-- (student_in_batch_roster(), reused from 0022) — never authorized by
-- student UUID/code/name/program/location/email/phone alone.
create or replace function public.create_assignment(
  target_title text,
  target_description text,
  target_instructions text,
  target_audience_type public.assignment_audience_type,
  target_batch_id uuid,
  target_student_id uuid,
  target_program_id uuid,
  target_session_id uuid,
  target_due_at timestamptz,
  target_allow_late_submission boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_coach_status public.coach_status;
  v_batch_program_id uuid;
  v_assignment_id uuid;
  v_title text;
  v_description text;
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select status into v_coach_status from public.coaches where id = v_coach_id;
  if v_coach_status is distinct from 'ACTIVE' then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if target_batch_id is null or not public.coach_has_batch(target_batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if target_audience_type = 'BATCH' then
    if target_student_id is not null then
      raise exception 'VALIDATION_ERROR';
    end if;
  elsif target_audience_type = 'STUDENT' then
    if target_student_id is null then
      raise exception 'VALIDATION_ERROR';
    end if;
    if not public.student_in_batch_roster(target_student_id, target_batch_id) then
      raise exception 'NOT_AUTHORIZED';
    end if;
  else
    raise exception 'VALIDATION_ERROR';
  end if;

  v_title := trim(target_title);
  v_description := trim(target_description);
  if v_title is null or char_length(v_title) = 0 or char_length(v_title) > 200 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if v_description is null or char_length(v_description) = 0 or char_length(v_description) > 3000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_instructions is not null and char_length(target_instructions) > 5000 then
    raise exception 'VALIDATION_ERROR';
  end if;

  select program_id into v_batch_program_id from public.batches where id = target_batch_id;
  if target_program_id is not null and target_program_id is distinct from v_batch_program_id then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_session_id is not null then
    if not exists (
      select 1 from public.class_sessions cs
      where cs.id = target_session_id and cs.batch_id = target_batch_id
    ) then
      raise exception 'VALIDATION_ERROR';
    end if;
  end if;

  insert into public.assignments (
    title, description, instructions, audience_type, batch_id, student_id,
    program_id, session_id, coach_id, status, due_at, allow_late_submission, created_by
  )
  values (
    v_title, v_description, nullif(trim(coalesce(target_instructions, '')), ''), target_audience_type, target_batch_id, target_student_id,
    v_batch_program_id, target_session_id, v_coach_id, 'DRAFT', target_due_at, coalesce(target_allow_late_submission, false), auth.uid()
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

comment on function public.create_assignment(text, text, text, public.assignment_audience_type, uuid, uuid, uuid, uuid, timestamptz, boolean) is
  'The only path that creates assignments. Verifies COACH + ACTIVE status + coach_has_batch(target_batch_id); for STUDENT audience additionally verifies student_in_batch_roster(); validates audience consistency, text lengths, program/session context; derives coach_id/created_by/program_id server-side; always inserts as DRAFT. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Create Assignment RPC".';

revoke all on function public.create_assignment(text, text, text, public.assignment_audience_type, uuid, uuid, uuid, uuid, timestamptz, boolean) from public;
grant execute on function public.create_assignment(text, text, text, public.assignment_audience_type, uuid, uuid, uuid, uuid, timestamptz, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- update_assignment — the ONLY way an existing DRAFT is edited
-- ---------------------------------------------------------------------------
-- audience_type/batch_id/student_id/coach_id/created_by/status/
-- published_at/published_by are never parameters here and are never
-- changed by this function. If a coach chose the wrong audience, the
-- documented path is: archive the draft and create a new assignment (see
-- "Update Assignment RPC" in the architecture doc) — this keeps
-- authorization integrity simple rather than allowing an audience/batch/
-- student rewrite mid-lifecycle.
create or replace function public.update_assignment(
  target_assignment_id uuid,
  target_title text,
  target_description text,
  target_instructions text,
  target_program_id uuid,
  target_session_id uuid,
  target_due_at timestamptz,
  target_allow_late_submission boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_row record;
  v_title text;
  v_description text;
  v_program_id uuid;
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, coach_id, batch_id, status into v_row
  from public.assignments
  where id = target_assignment_id;

  if v_row.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  if v_row.coach_id is distinct from v_coach_id then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.coach_has_batch(v_row.batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_row.status <> 'DRAFT' then
    raise exception 'ASSIGNMENT_NOT_EDITABLE';
  end if;

  v_title := trim(target_title);
  v_description := trim(target_description);
  if v_title is null or char_length(v_title) = 0 or char_length(v_title) > 200 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if v_description is null or char_length(v_description) = 0 or char_length(v_description) > 3000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_instructions is not null and char_length(target_instructions) > 5000 then
    raise exception 'VALIDATION_ERROR';
  end if;

  select program_id into v_program_id from public.batches where id = v_row.batch_id;
  if target_program_id is not null and target_program_id is distinct from v_program_id then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_session_id is not null then
    if not exists (
      select 1 from public.class_sessions cs
      where cs.id = target_session_id and cs.batch_id = v_row.batch_id
    ) then
      raise exception 'VALIDATION_ERROR';
    end if;
  end if;

  update public.assignments
  set
    title = v_title,
    description = v_description,
    instructions = nullif(trim(coalesce(target_instructions, '')), ''),
    program_id = v_program_id,
    session_id = target_session_id,
    due_at = target_due_at,
    allow_late_submission = coalesce(target_allow_late_submission, false),
    updated_at = now()
  where id = target_assignment_id
    and status = 'DRAFT';

  return true;
end;
$$;

comment on function public.update_assignment(uuid, text, text, text, uuid, uuid, timestamptz, boolean) is
  'The only path that edits an existing DRAFT assignment. Verifies assignment.coach_id = current coach, status = DRAFT, coach_has_batch(assignment.batch_id); never changes audience_type/batch_id/student_id/coach_id/created_by/status/published fields. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Update Assignment RPC".';

revoke all on function public.update_assignment(uuid, text, text, text, uuid, uuid, timestamptz, boolean) from public;
grant execute on function public.update_assignment(uuid, text, text, text, uuid, uuid, timestamptz, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- publish_assignment — the ONLY path DRAFT -> PUBLISHED (with recipient snapshot)
-- ---------------------------------------------------------------------------
-- PUBLISH RECIPIENT SNAPSHOT TRANSACTION: this entire function body runs
-- inside Postgres' implicit per-function transaction — any raised
-- exception (e.g. NO_RECIPIENTS) rolls back every write this invocation
-- made, including any assignment_recipients rows already inserted. There
-- is no partial publish. For BATCH audience, every currently-eligible
-- student (assignment_batch_roster_student_ids()) becomes a recipient;
-- publication is rejected with NO_RECIPIENTS if that roster is empty. For
-- STUDENT audience, the direct student/batch relationship is re-verified
-- (it may have changed since DRAFT creation) and exactly one recipient row
-- is inserted. The final status UPDATE is conditioned atomically on
-- status = 'DRAFT', preventing a concurrent double-publish.
create or replace function public.publish_assignment(target_assignment_id uuid)
returns public.assignment_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_row record;
  v_updated_status public.assignment_status;
  v_recipient_count integer;
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, coach_id, batch_id, student_id, audience_type, status, title, description
  into v_row
  from public.assignments
  where id = target_assignment_id;

  if v_row.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  if v_row.coach_id is distinct from v_coach_id then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.coach_has_batch(v_row.batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_row.status <> 'DRAFT' then
    raise exception 'INVALID_TRANSITION';
  end if;

  if v_row.title is null or char_length(trim(v_row.title)) = 0
     or v_row.description is null or char_length(trim(v_row.description)) = 0 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if v_row.audience_type = 'BATCH' then
    insert into public.assignment_recipients (assignment_id, student_id, assigned_at)
    select target_assignment_id, roster.student_id, now()
    from public.assignment_batch_roster_student_ids(v_row.batch_id) roster
    on conflict (assignment_id, student_id) do nothing;

    select count(*) into v_recipient_count
    from public.assignment_recipients
    where assignment_id = target_assignment_id;

    if v_recipient_count = 0 then
      raise exception 'NO_RECIPIENTS';
    end if;
  else
    -- STUDENT audience: re-verify the direct student/batch relationship
    -- still holds at publish time (it may have changed since DRAFT
    -- creation).
    if v_row.student_id is null or not public.student_in_batch_roster(v_row.student_id, v_row.batch_id) then
      raise exception 'NOT_AUTHORIZED';
    end if;

    insert into public.assignment_recipients (assignment_id, student_id, assigned_at)
    values (target_assignment_id, v_row.student_id, now())
    on conflict (assignment_id, student_id) do nothing;
  end if;

  update public.assignments
  set
    status = 'PUBLISHED',
    published_at = now(),
    published_by = auth.uid(),
    updated_at = now()
  where id = target_assignment_id
    and status = 'DRAFT'
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.publish_assignment(uuid) is
  'The only path DRAFT -> PUBLISHED. Verifies assignment.coach_id = current coach and coach_has_batch(assignment.batch_id), requires non-empty title/description, atomically snapshots assignment_recipients (BATCH: full current roster, rejecting NO_RECIPIENTS if empty; STUDENT: exactly the one authorized student), sets published_at/published_by server-side, conditions the status UPDATE atomically on status=DRAFT. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Publish Assignment RPC" and "Publish Recipient Snapshot Transaction".';

revoke all on function public.publish_assignment(uuid) from public;
grant execute on function public.publish_assignment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- archive_assignment — the ONLY path DRAFT|PUBLISHED -> ARCHIVED
-- ---------------------------------------------------------------------------
-- Unlike student_progress_evaluations (Phase 15, DRAFT-only archive),
-- assignments may be archived from either DRAFT or PUBLISHED — archiving a
-- PUBLISHED assignment preserves its existing assignment_recipients and
-- assignment_submissions rows (no cascade delete, no data loss); it only
-- blocks new submissions/resubmissions going forward (enforced by
-- submit_assignment() requiring status = PUBLISHED). ARCHIVED never
-- transitions anywhere — no ARCHIVED -> DRAFT, no ARCHIVED -> PUBLISHED.
-- There is no assignment DELETE RPC and no Coach DELETE policy anywhere —
-- archive is the only lifecycle exit.
create or replace function public.archive_assignment(target_assignment_id uuid)
returns public.assignment_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_row record;
  v_updated_status public.assignment_status;
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, coach_id, batch_id, status into v_row
  from public.assignments
  where id = target_assignment_id;

  if v_row.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  if v_row.coach_id is distinct from v_coach_id then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.coach_has_batch(v_row.batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_row.status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.assignments
  set status = 'ARCHIVED', updated_at = now()
  where id = target_assignment_id
    and status in ('DRAFT', 'PUBLISHED')
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.archive_assignment(uuid) is
  'The only Coach Portal path DRAFT|PUBLISHED -> ARCHIVED. Never allows ARCHIVED -> anything. Preserves existing recipients/submissions; blocks only new submissions going forward. Verifies assignment.coach_id = current coach and coach_has_batch(assignment.batch_id). See docs/ASSIGNMENTS_ARCHITECTURE.md, "Archive Assignment RPC".';

revoke all on function public.archive_assignment(uuid) from public;
grant execute on function public.archive_assignment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_assignment — the ONLY way assignment_submissions is written by a student
-- ---------------------------------------------------------------------------
-- Authorization chain: STUDENT role -> current_student_id() -> assignment
-- exists -> assignment_recipients row exists for this student (never
-- derived from live batch membership) -> assignment.status = PUBLISHED
-- (raises ASSIGNMENT_NOT_PUBLISHED otherwise — covers the ARCHIVED case;
-- DRAFT can never reach this branch since DRAFT assignments have no
-- recipients yet) -> deadline/late-submission rule validated server-side
-- -> content requirement + text length + URL protocol validated -> insert
-- (no existing row) or resubmit (existing row with status =
-- REVISION_REQUESTED only). A SUBMITTED or REVIEWED existing row rejects
-- the call as SUBMISSION_NOT_EDITABLE — a student can never arbitrarily
-- overwrite already-submitted or already-reviewed work. Resubmission
-- resets reviewed_at/reviewed_by/coach_feedback to null (the previous
-- feedback is not preserved — see "Resubmission Decision"). student_id/
-- status/submitted_at/reviewed_by/reviewed_at are never parameters here.
create or replace function public.submit_assignment(
  target_assignment_id uuid,
  target_submission_text text,
  target_submission_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_assignment record;
  v_existing record;
  v_text text;
  v_url text;
  v_submission_id uuid;
begin
  v_student_id := public.current_student_id();
  if v_student_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, status, due_at, allow_late_submission into v_assignment
  from public.assignments
  where id = target_assignment_id;

  if v_assignment.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.assignment_recipients ar
    where ar.assignment_id = target_assignment_id and ar.student_id = v_student_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_assignment.status <> 'PUBLISHED' then
    raise exception 'ASSIGNMENT_NOT_PUBLISHED';
  end if;

  if v_assignment.due_at is not null and now() > v_assignment.due_at and not v_assignment.allow_late_submission then
    raise exception 'DEADLINE_PASSED';
  end if;

  v_text := nullif(trim(coalesce(target_submission_text, '')), '');
  v_url := nullif(trim(coalesce(target_submission_url, '')), '');

  if v_text is null and v_url is null then
    raise exception 'VALIDATION_ERROR';
  end if;
  if v_text is not null and char_length(v_text) > 5000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if v_url is not null and v_url !~ '^https?://' then
    raise exception 'VALIDATION_ERROR';
  end if;

  select id, status into v_existing
  from public.assignment_submissions
  where assignment_id = target_assignment_id and student_id = v_student_id;

  if v_existing.id is null then
    insert into public.assignment_submissions (
      assignment_id, student_id, status, submission_text, submission_url, submitted_at, updated_at
    )
    values (
      target_assignment_id, v_student_id, 'SUBMITTED', v_text, v_url, now(), now()
    )
    returning id into v_submission_id;
    return v_submission_id;
  end if;

  if v_existing.status <> 'REVISION_REQUESTED' then
    raise exception 'SUBMISSION_NOT_EDITABLE';
  end if;

  update public.assignment_submissions
  set
    submission_text = v_text,
    submission_url = v_url,
    status = 'SUBMITTED',
    submitted_at = now(),
    reviewed_at = null,
    reviewed_by = null,
    coach_feedback = null,
    updated_at = now()
  where id = v_existing.id
    and status = 'REVISION_REQUESTED'
  returning id into v_submission_id;

  if v_submission_id is null then
    raise exception 'SUBMISSION_NOT_EDITABLE';
  end if;

  return v_submission_id;
end;
$$;

comment on function public.submit_assignment(uuid, text, text) is
  'The only path that writes assignment_submissions for a student. Verifies STUDENT + assignment_recipients membership (never live batch membership) + status=PUBLISHED + deadline/late-submission rule + content requirement + text length + URL protocol (https?:// only). Initial submission -> SUBMITTED; resubmission only permitted from REVISION_REQUESTED (resets review metadata); SUBMITTED/REVIEWED reject as SUBMISSION_NOT_EDITABLE. student_id/status/submitted_at/reviewed_by/reviewed_at are always server-derived. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Submit Assignment RPC".';

revoke all on function public.submit_assignment(uuid, text, text) from public;
grant execute on function public.submit_assignment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- review_assignment_submission — the ONLY way a coach reviews a submission
-- ---------------------------------------------------------------------------
-- AUTHOR-ONLY MUTATION (stricter than the coach historical read rule): a
-- coach may review a submission only when assignment.coach_id = current
-- coach AND coach_has_batch(assignment.batch_id) — a continuity-only coach
-- (assigned to the batch but not the assignment's author) can read the
-- assignment/submission under the historical read rule, but can never call
-- this RPC to overwrite the author's feedback. Coach may set only REVIEWED
-- or REVISION_REQUESTED — never SUBMITTED (rejected as VALIDATION_ERROR).
-- REVISION_REQUESTED requires non-empty feedback (REVISION_FEEDBACK_REQUIRED
-- otherwise); REVIEWED permits optional feedback. reviewed_by/reviewed_at
-- are always server-derived — never accepted as parameters.
create or replace function public.review_assignment_submission(
  target_submission_id uuid,
  target_status public.assignment_submission_status,
  target_feedback text
)
returns public.assignment_submission_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_row record;
  v_feedback text;
  v_updated_status public.assignment_submission_status;
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if target_status not in ('REVIEWED', 'REVISION_REQUESTED') then
    raise exception 'VALIDATION_ERROR';
  end if;

  select sub.id, sub.assignment_id, sub.status, a.coach_id, a.batch_id
  into v_row
  from public.assignment_submissions sub
  join public.assignments a on a.id = sub.assignment_id
  where sub.id = target_submission_id;

  if v_row.id is null then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  if v_row.coach_id is distinct from v_coach_id then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.coach_has_batch(v_row.batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  v_feedback := nullif(trim(coalesce(target_feedback, '')), '');
  if v_feedback is not null and char_length(v_feedback) > 3000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_status = 'REVISION_REQUESTED' and v_feedback is null then
    raise exception 'REVISION_FEEDBACK_REQUIRED';
  end if;

  update public.assignment_submissions
  set
    status = target_status,
    coach_feedback = v_feedback,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = target_submission_id
  returning status into v_updated_status;

  return v_updated_status;
end;
$$;

comment on function public.review_assignment_submission(uuid, public.assignment_submission_status, text) is
  'The only path that reviews an assignment_submissions row. Verifies submission''s assignment.coach_id = current coach (author-only — a continuity-only coach cannot overwrite the author''s feedback) and coach_has_batch(assignment.batch_id). Coach may set only REVIEWED/REVISION_REQUESTED, never SUBMITTED. REVISION_REQUESTED requires non-empty feedback. reviewed_by/reviewed_at always server-derived. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Review RPC".';

revoke all on function public.review_assignment_submission(uuid, public.assignment_submission_status, text) from public;
grant execute on function public.review_assignment_submission(uuid, public.assignment_submission_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_assignments — coach-wide list under the historical read rule
-- ---------------------------------------------------------------------------
create or replace function public.get_coach_assignments()
returns table (
  assignment_id uuid,
  title text,
  audience_type public.assignment_audience_type,
  batch_id uuid,
  batch_name text,
  student_id uuid,
  student_full_name text,
  student_code text,
  program_name text,
  due_at timestamptz,
  status public.assignment_status,
  published_at timestamptz,
  updated_at timestamptz,
  recipient_count integer,
  submission_count integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.title, a.audience_type,
    a.batch_id, b.name,
    a.student_id, s.full_name, s.student_code,
    p.name,
    a.due_at, a.status, a.published_at, a.updated_at,
    (select count(*)::int from public.assignment_recipients ar where ar.assignment_id = a.id),
    (select count(*)::int from public.assignment_submissions sub where sub.assignment_id = a.id)
  from public.assignments a
  join public.batches b on b.id = a.batch_id
  left join public.students s on s.id = a.student_id
  left join public.programs p on p.id = a.program_id
  where a.coach_id = public.current_coach_id() or public.coach_has_batch(a.batch_id)
  order by a.updated_at desc;
$$;

comment on function public.get_coach_assignments() is
  'Coach-wide assignment list under the coach historical read rule. Explicit recipient_count/submission_count (e.g. "12 submitted / 20 recipients") — never a fabricated completion percentage. No student contact PII. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Assignment List".';

revoke all on function public.get_coach_assignments() from public;
grant execute on function public.get_coach_assignments() to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_assignment — single assignment detail
-- ---------------------------------------------------------------------------
-- coach_can_manage: DRAFT + author + current batch (Edit/Publish shown).
-- coach_can_archive: DRAFT or PUBLISHED + author + current batch (Archive
-- shown). Neither exposes coach_id/created_by/published_by UUIDs — the
-- UI gates entirely on these two booleans, same pattern as
-- get_coach_progress_evaluation() (Phase 15).
create or replace function public.get_coach_assignment(target_assignment_id uuid)
returns table (
  assignment_id uuid,
  title text,
  description text,
  instructions text,
  audience_type public.assignment_audience_type,
  batch_id uuid,
  batch_name text,
  student_id uuid,
  student_full_name text,
  student_code text,
  program_name text,
  session_id uuid,
  session_date date,
  due_at timestamptz,
  allow_late_submission boolean,
  status public.assignment_status,
  author_name text,
  published_at timestamptz,
  created_at timestamptz,
  recipient_count integer,
  submission_count integer,
  coach_can_manage boolean,
  coach_can_archive boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.title, a.description, a.instructions, a.audience_type,
    a.batch_id, b.name,
    a.student_id, s.full_name, s.student_code,
    p.name,
    a.session_id, cs.session_date,
    a.due_at, a.allow_late_submission, a.status,
    c.full_name, a.published_at, a.created_at,
    (select count(*)::int from public.assignment_recipients ar where ar.assignment_id = a.id),
    (select count(*)::int from public.assignment_submissions sub where sub.assignment_id = a.id),
    (a.status = 'DRAFT' and a.coach_id = public.current_coach_id() and public.coach_has_batch(a.batch_id)),
    (a.status in ('DRAFT', 'PUBLISHED') and a.coach_id = public.current_coach_id() and public.coach_has_batch(a.batch_id))
  from public.assignments a
  join public.batches b on b.id = a.batch_id
  join public.coaches c on c.id = a.coach_id
  left join public.students s on s.id = a.student_id
  left join public.programs p on p.id = a.program_id
  left join public.class_sessions cs on cs.id = a.session_id
  where a.id = target_assignment_id
    and (a.coach_id = public.current_coach_id() or public.coach_has_batch(a.batch_id));
$$;

comment on function public.get_coach_assignment(uuid) is
  'Single assignment detail under the coach historical read rule. Returns coach_can_manage/coach_can_archive (never coach_id/created_by/published_by UUIDs) so the UI can gate Edit/Publish/Archive. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Assignment Detail".';

revoke all on function public.get_coach_assignment(uuid) from public;
grant execute on function public.get_coach_assignment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_batch_assignments — batch-scoped list (continuity)
-- ---------------------------------------------------------------------------
create or replace function public.get_coach_batch_assignments(target_batch_id uuid)
returns table (
  assignment_id uuid,
  title text,
  audience_type public.assignment_audience_type,
  student_full_name text,
  student_code text,
  program_name text,
  due_at timestamptz,
  status public.assignment_status,
  author_name text,
  updated_at timestamptz,
  recipient_count integer,
  submission_count integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.title, a.audience_type,
    s.full_name, s.student_code,
    p.name,
    a.due_at, a.status, c.full_name, a.updated_at,
    (select count(*)::int from public.assignment_recipients ar where ar.assignment_id = a.id),
    (select count(*)::int from public.assignment_submissions sub where sub.assignment_id = a.id)
  from public.assignments a
  join public.coaches c on c.id = a.coach_id
  left join public.students s on s.id = a.student_id
  left join public.programs p on p.id = a.program_id
  where a.batch_id = target_batch_id
    and public.coach_has_batch(target_batch_id)
  order by a.updated_at desc;
$$;

comment on function public.get_coach_batch_assignments(uuid) is
  'Batch-scoped assignment list. Requires coach_has_batch(target_batch_id); once satisfied, shows every assignment for that batch (continuity across coach handoffs), author display name only. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Batch Assignments Page".';

revoke all on function public.get_coach_batch_assignments(uuid) from public;
grant execute on function public.get_coach_batch_assignments(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_assignment_submissions — recipient roster + narrow submission state
-- ---------------------------------------------------------------------------
create or replace function public.get_coach_assignment_submissions(target_assignment_id uuid)
returns table (
  student_id uuid,
  student_code text,
  student_full_name text,
  submission_id uuid,
  status public.assignment_submission_status,
  submitted_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id, s.student_code, s.full_name,
    sub.id, sub.status, sub.submitted_at, sub.reviewed_at
  from public.assignments a
  join public.assignment_recipients ar on ar.assignment_id = a.id
  join public.students s on s.id = ar.student_id
  left join public.assignment_submissions sub on sub.assignment_id = a.id and sub.student_id = s.id
  where a.id = target_assignment_id
    and (a.coach_id = public.current_coach_id() or public.coach_has_batch(a.batch_id))
  order by s.full_name;
$$;

comment on function public.get_coach_assignment_submissions(uuid) is
  'Recipient roster (never the whole class, only this assignment''s recipients) merged with narrow submission state. null submission_id/status means "Not Submitted" — a UI-only label, never persisted. No student contact PII, no attendance, no progress-evaluation, no payment data. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Submissions Page".';

revoke all on function public.get_coach_assignment_submissions(uuid) from public;
grant execute on function public.get_coach_assignment_submissions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_assignment_submission — single submission detail
-- ---------------------------------------------------------------------------
-- Requires submission.assignment_id = target_assignment_id (route
-- resources must match each other, not just each be individually valid)
-- AND the assignment to be visible under the coach historical read rule.
-- coach_can_review mirrors review_assignment_submission()'s own
-- authorization (author + current batch) so the UI can safely hide the
-- review form for a continuity-only coach without a second round trip.
create or replace function public.get_coach_assignment_submission(
  target_assignment_id uuid,
  target_submission_id uuid
)
returns table (
  submission_id uuid,
  student_id uuid,
  student_code text,
  student_full_name text,
  assignment_title text,
  submission_text text,
  submission_url text,
  submitted_at timestamptz,
  status public.assignment_submission_status,
  coach_feedback text,
  reviewed_at timestamptz,
  coach_can_review boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    sub.id, s.id, s.student_code, s.full_name,
    a.title,
    sub.submission_text, sub.submission_url, sub.submitted_at, sub.status, sub.coach_feedback, sub.reviewed_at,
    (a.coach_id = public.current_coach_id() and public.coach_has_batch(a.batch_id))
  from public.assignment_submissions sub
  join public.assignments a on a.id = sub.assignment_id
  join public.students s on s.id = sub.student_id
  where sub.id = target_submission_id
    and sub.assignment_id = target_assignment_id
    and (a.coach_id = public.current_coach_id() or public.coach_has_batch(a.batch_id));
$$;

comment on function public.get_coach_assignment_submission(uuid, uuid) is
  'Single submission detail. Requires submission.assignment_id = target_assignment_id and assignment visibility under the coach historical read rule. coach_can_review mirrors review_assignment_submission()''s author-only + current-batch check. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Submission Detail".';

revoke all on function public.get_coach_assignment_submission(uuid, uuid) from public;
grant execute on function public.get_coach_assignment_submission(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_student_assignments — narrow, self-scoped list via assignment_recipients
-- ---------------------------------------------------------------------------
-- Zero-argument, always scoped to current_student_id() internally. Read
-- authorization derives ONLY from assignment_recipients — never from live
-- batch membership — so a student who has since left the batch still sees
-- their legitimate historical assignment, and a student who just joined
-- does not inherit a previously published assignment. DRAFT assignments
-- never appear (a DRAFT has no recipients yet); PUBLISHED and ARCHIVED
-- both appear (see "Archive Assignment RPC" — archiving preserves
-- historical visibility).
create or replace function public.get_student_assignments()
returns table (
  assignment_id uuid,
  title text,
  batch_name text,
  program_name text,
  due_at timestamptz,
  allow_late_submission boolean,
  status public.assignment_status,
  submission_status public.assignment_submission_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.title, b.name, p.name,
    a.due_at, a.allow_late_submission, a.status,
    sub.status
  from public.assignment_recipients ar
  join public.assignments a on a.id = ar.assignment_id
  join public.batches b on b.id = a.batch_id
  left join public.programs p on p.id = a.program_id
  left join public.assignment_submissions sub on sub.assignment_id = a.id and sub.student_id = ar.student_id
  where ar.student_id = public.current_student_id()
    and public.current_student_id() is not null
    and a.status in ('PUBLISHED', 'ARCHIVED')
  order by a.due_at nulls last, a.created_at desc;
$$;

comment on function public.get_student_assignments() is
  'Narrow, self-scoped assignment list for the current student only (no studentId parameter). Read authorization derives from assignment_recipients, never live batch membership. DRAFT never appears. null submission_status means Not Submitted (UI-only, never persisted). See docs/ASSIGNMENTS_ARCHITECTURE.md, "Student Assignment Privacy".';

revoke all on function public.get_student_assignments() from public;
grant execute on function public.get_student_assignments() to authenticated;

-- ---------------------------------------------------------------------------
-- get_student_assignment — single assignment detail + own submission only
-- ---------------------------------------------------------------------------
-- Never exposes other recipients, other submissions, other student names,
-- coach contact details, parent data, or internal coach/profile UUIDs.
create or replace function public.get_student_assignment(target_assignment_id uuid)
returns table (
  assignment_id uuid,
  title text,
  description text,
  instructions text,
  batch_name text,
  program_name text,
  session_date date,
  due_at timestamptz,
  allow_late_submission boolean,
  status public.assignment_status,
  submission_id uuid,
  submission_status public.assignment_submission_status,
  submission_text text,
  submission_url text,
  coach_feedback text,
  submitted_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.title, a.description, a.instructions,
    b.name, p.name, cs.session_date,
    a.due_at, a.allow_late_submission, a.status,
    sub.id, sub.status, sub.submission_text, sub.submission_url, sub.coach_feedback, sub.submitted_at
  from public.assignment_recipients ar
  join public.assignments a on a.id = ar.assignment_id
  join public.batches b on b.id = a.batch_id
  left join public.programs p on p.id = a.program_id
  left join public.class_sessions cs on cs.id = a.session_id
  left join public.assignment_submissions sub on sub.assignment_id = a.id and sub.student_id = ar.student_id
  where ar.assignment_id = target_assignment_id
    and ar.student_id = public.current_student_id()
    and public.current_student_id() is not null
    and a.status in ('PUBLISHED', 'ARCHIVED');
$$;

comment on function public.get_student_assignment(uuid) is
  'Single assignment detail + the current student''s own submission only. "Knowing assignmentId is not enough" — authorization requires an assignment_recipients row for the current student. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Student Assignment Detail".';

revoke all on function public.get_student_assignment(uuid) from public;
grant execute on function public.get_student_assignment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_parent_student_assignments / get_parent_student_assignment — relationship-scoped equivalents
-- ---------------------------------------------------------------------------
-- Both take target_student_id explicitly but authorization is enforced
-- INSIDE via parent_has_student() — an unauthorized target_student_id
-- yields zero rows, identical to an authorized student with no visible
-- assignments yet. Read-only: no parent mutation RPC exists anywhere.
create or replace function public.get_parent_student_assignments(target_student_id uuid)
returns table (
  assignment_id uuid,
  title text,
  batch_name text,
  program_name text,
  due_at timestamptz,
  allow_late_submission boolean,
  status public.assignment_status,
  submission_status public.assignment_submission_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.title, b.name, p.name,
    a.due_at, a.allow_late_submission, a.status,
    sub.status
  from public.assignment_recipients ar
  join public.assignments a on a.id = ar.assignment_id
  join public.batches b on b.id = a.batch_id
  left join public.programs p on p.id = a.program_id
  left join public.assignment_submissions sub on sub.assignment_id = a.id and sub.student_id = ar.student_id
  where public.parent_has_student(target_student_id)
    and ar.student_id = target_student_id
    and a.status in ('PUBLISHED', 'ARCHIVED')
  order by a.due_at nulls last, a.created_at desc;
$$;

comment on function public.get_parent_student_assignments(uuid) is
  'Relationship-scoped assignment list for one linked student. Authorization enforced inside via parent_has_student(), not by the caller. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Parent Assignment Privacy".';

revoke all on function public.get_parent_student_assignments(uuid) from public;
grant execute on function public.get_parent_student_assignments(uuid) to authenticated;

create or replace function public.get_parent_student_assignment(
  target_student_id uuid,
  target_assignment_id uuid
)
returns table (
  assignment_id uuid,
  title text,
  description text,
  instructions text,
  batch_name text,
  program_name text,
  session_date date,
  due_at timestamptz,
  allow_late_submission boolean,
  status public.assignment_status,
  submission_id uuid,
  submission_status public.assignment_submission_status,
  submission_text text,
  submission_url text,
  coach_feedback text,
  submitted_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.title, a.description, a.instructions,
    b.name, p.name, cs.session_date,
    a.due_at, a.allow_late_submission, a.status,
    sub.id, sub.status, sub.submission_text, sub.submission_url, sub.coach_feedback, sub.submitted_at
  from public.assignment_recipients ar
  join public.assignments a on a.id = ar.assignment_id
  join public.batches b on b.id = a.batch_id
  left join public.programs p on p.id = a.program_id
  left join public.class_sessions cs on cs.id = a.session_id
  left join public.assignment_submissions sub on sub.assignment_id = a.id and sub.student_id = ar.student_id
  where ar.assignment_id = target_assignment_id
    and ar.student_id = target_student_id
    and public.parent_has_student(target_student_id)
    and a.status in ('PUBLISHED', 'ARCHIVED');
$$;

comment on function public.get_parent_student_assignment(uuid, uuid) is
  'Relationship-scoped single assignment detail + the linked student''s own submission only. Authorization enforced inside via parent_has_student(). Read-only — no parent submit/edit/review RPC exists. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Parent Assignment Privacy".';

revoke all on function public.get_parent_student_assignment(uuid, uuid) from public;
grant execute on function public.get_parent_student_assignment(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No admin UI, certificate, payment, messaging, notification,
-- AI-generation, file-upload, PGN/engine-analysis, or tournament-
-- integration table, column, policy, or function is added anywhere in
-- Phase 16. Admin (service-role) access continues to bypass RLS entirely
-- and is unaffected. Assignment deletion does not exist — no DELETE
-- policy, no delete RPC, on any of the three tables.
