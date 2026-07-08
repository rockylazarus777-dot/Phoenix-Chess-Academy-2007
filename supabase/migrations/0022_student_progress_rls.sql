-- =============================================================================
-- 0022_student_progress_rls.sql
-- =============================================================================
-- Phase 15 — RLS policies and RPC functions for student_progress_evaluations /
-- student_progress_area_ratings (schema created in
-- 0021_student_progress_evaluations.sql). Does not edit 0021 or any earlier
-- migration.
--
-- Reuses current_coach_id() / coach_has_batch() (0018), current_student_id()
-- (0016), and current_parent_id() / parent_has_student() (0017) as-is — no
-- redefinition.
--
-- SCOPE: STUDENT and PARENT get NO direct RLS SELECT policy on either table
-- at all — both access only through narrow SECURITY DEFINER RPCs
-- (get_student_progress_evaluations / get_parent_student_progress_evaluations),
-- mirroring the exact Phase 14 attendance decision. This is what makes the
-- DRAFT/ARCHIVED privacy boundary enforceable in one place instead of a
-- fragile row-level USING clause per role. See
-- docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Student Progress Privacy" and
-- "Parent Progress Privacy".

-- ---------------------------------------------------------------------------
-- HELPER: student_in_batch_roster(target_student_id, target_batch_id)
-- ---------------------------------------------------------------------------
-- CURRENT (not historical/date-aware) dual-path membership check — the spec
-- for Phase 15 evaluation creation explicitly calls for "current batch
-- assignment" rather than the session-date-aware historical rule Phase 14
-- uses for attendance eligibility (evaluations are not tied to a single
-- dated occurrence the way a class session is). A student is considered a
-- member of a batch if EITHER a batch_enrollments row OR a
-- student_program_enrollments row links them to it, with no additional
-- status/date filter — this intentionally matches the least restrictive
-- reading of "the student is legitimately connected to that batch" rather
-- than re-deriving a stricter rule Phase 10 never confirmed.
--
-- ACCESS: intentionally NOT granted to authenticated — same enumeration-
-- prevention rationale as session_eligible_student_ids() (0020). Only
-- called from inside other SECURITY DEFINER functions below.
create or replace function public.student_in_batch_roster(
  target_student_id uuid,
  target_batch_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.batch_enrollments be
    where be.student_id = target_student_id and be.batch_id = target_batch_id
  )
  or exists (
    select 1 from public.student_program_enrollments spe
    where spe.student_id = target_student_id and spe.batch_id = target_batch_id
  );
$$;

comment on function public.student_in_batch_roster(uuid, uuid) is
  'Internal-only current (non-historical) dual-path batch membership check — NOT granted to authenticated. Called only from within other SECURITY DEFINER functions that perform their own authorization first. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Student/Batch Eligibility".';

revoke all on function public.student_in_batch_roster(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- STUDENT_PROGRESS_EVALUATIONS / STUDENT_PROGRESS_AREA_RATINGS RLS
-- ---------------------------------------------------------------------------
-- COACH HISTORICAL READ RULE (applied uniformly across every coach-facing
-- read path — direct RLS SELECT here, and every get_coach_* RPC below):
-- a coach may read an evaluation when evaluation.coach_id = current_coach_id()
-- OR the coach currently manages evaluation.batch_id (coach_has_batch()).
-- This lets a coach retain access to evaluations they authored even after
-- their own batch assignment ends, AND lets any coach CURRENTLY assigned to
-- a batch read every evaluation tied to that batch (including another
-- coach's DRAFT) — a deliberate continuity decision supporting
-- PRIMARY/ASSISTANT/GUEST coach handoffs on the same batch. This is strictly
-- a Coach<->Coach visibility question; it never extends DRAFT/ARCHIVED
-- visibility to Student or Parent, which remains hard-blocked by the "no
-- direct RLS policy, RPC-only, PUBLISHED-only" architecture below. See
-- docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Historical Read Decision".
--
-- No INSERT/UPDATE/DELETE policy exists for COACH on either table — RLS is
-- row-level, not column-level, and a broad policy would let a coach mutate
-- student_id/batch_id/coach_id/created_by/published_at/published_by/status,
-- not just the intended editable fields. All writes go exclusively through
-- the four RPCs below. See "Evaluation Write Architecture" in the
-- architecture doc.
create policy "student_progress_evaluations_select_for_coach"
  on public.student_progress_evaluations
  for select
  to authenticated
  using (coach_id = public.current_coach_id() or public.coach_has_batch(batch_id));

create policy "student_progress_area_ratings_select_for_coach"
  on public.student_progress_area_ratings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.student_progress_evaluations spe
      where spe.id = student_progress_area_ratings.evaluation_id
        and (spe.coach_id = public.current_coach_id() or public.coach_has_batch(spe.batch_id))
    )
  );

-- ---------------------------------------------------------------------------
-- create_student_progress_evaluation — the ONLY way a new evaluation is created
-- ---------------------------------------------------------------------------
-- area_ratings shape: a JSON array of objects, each
-- { "area": "<development_area value>", "rating": 1-5, "comment": "<optional, <=500 chars>" }.
-- Requires at least one area rating even for DRAFT creation — a deliberate
-- choice to avoid ever persisting a completely empty evaluation shell (see
-- "Development Area Form" in the architecture doc for the rationale).
-- target_program_id, if supplied, must equal the target batch's own
-- program_id (batches.program_id is NOT NULL in this schema, so program
-- context is always the assigned batch's own program — never an
-- independently selected, potentially unrelated program). Inserts
-- atomically: the evaluation row and every area rating row are written in
-- the same function invocation, or nothing is written at all.
create or replace function public.create_student_progress_evaluation(
  target_student_id uuid,
  target_batch_id uuid,
  target_program_id uuid,
  period_start date,
  period_end date,
  summary text,
  strengths_text text,
  development_focus_text text,
  recommendation_text text,
  area_ratings jsonb
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
  v_evaluation_id uuid;
  v_entry jsonb;
  v_area text;
  v_rating integer;
  v_comment text;
  v_areas text[] := '{}';
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select status into v_coach_status from public.coaches where id = v_coach_id;
  if v_coach_status is distinct from 'ACTIVE' then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.coach_has_batch(target_batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.student_in_batch_roster(target_student_id, target_batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if period_end < period_start then
    raise exception 'VALIDATION_ERROR';
  end if;

  select program_id into v_batch_program_id from public.batches where id = target_batch_id;
  if target_program_id is not null and target_program_id is distinct from v_batch_program_id then
    raise exception 'VALIDATION_ERROR';
  end if;

  if summary is not null and char_length(summary) > 2000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if strengths_text is not null and char_length(strengths_text) > 1500 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if development_focus_text is not null and char_length(development_focus_text) > 1500 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if recommendation_text is not null and char_length(recommendation_text) > 1500 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if jsonb_typeof(area_ratings) is distinct from 'array' then
    raise exception 'VALIDATION_ERROR';
  end if;
  if jsonb_array_length(area_ratings) < 1 or jsonb_array_length(area_ratings) > 20 then
    raise exception 'VALIDATION_ERROR';
  end if;

  for v_entry in select * from jsonb_array_elements(area_ratings)
  loop
    if not (v_entry ? 'area') or not (v_entry ? 'rating') then
      raise exception 'VALIDATION_ERROR';
    end if;

    v_area := v_entry ->> 'area';
    if v_area is null or v_area not in (
      'OPENING', 'MIDDLEGAME', 'ENDGAME', 'TACTICS', 'CALCULATION',
      'POSITIONAL_PLAY', 'TIME_MANAGEMENT', 'CONCENTRATION',
      'DECISION_MAKING', 'TOURNAMENT_PREPARATION'
    ) then
      raise exception 'VALIDATION_ERROR';
    end if;

    if v_area = any(v_areas) then
      raise exception 'VALIDATION_ERROR';
    end if;
    v_areas := array_append(v_areas, v_area);

    begin
      v_rating := (v_entry ->> 'rating')::integer;
    exception when others then
      raise exception 'VALIDATION_ERROR';
    end;
    if v_rating < 1 or v_rating > 5 then
      raise exception 'VALIDATION_ERROR';
    end if;

    v_comment := v_entry ->> 'comment';
    if v_comment is not null and char_length(v_comment) > 500 then
      raise exception 'VALIDATION_ERROR';
    end if;
  end loop;

  insert into public.student_progress_evaluations (
    student_id, batch_id, program_id, coach_id,
    evaluation_period_start, evaluation_period_end, status,
    overall_summary, strengths, development_focus, coach_recommendation,
    created_by
  )
  values (
    target_student_id, target_batch_id, v_batch_program_id, v_coach_id,
    period_start, period_end, 'DRAFT',
    summary, strengths_text, development_focus_text, recommendation_text,
    auth.uid()
  )
  returning id into v_evaluation_id;

  for v_entry in select * from jsonb_array_elements(area_ratings)
  loop
    insert into public.student_progress_area_ratings (evaluation_id, area, rating, comment)
    values (
      v_evaluation_id,
      (v_entry ->> 'area')::public.development_area,
      (v_entry ->> 'rating')::integer,
      v_entry ->> 'comment'
    );
  end loop;

  return v_evaluation_id;
end;
$$;

comment on function public.create_student_progress_evaluation(uuid, uuid, uuid, date, date, text, text, text, text, jsonb) is
  'The only path that creates student_progress_evaluations. Verifies COACH + ACTIVE status + coach_has_batch(target_batch_id) + student_in_batch_roster(), validates period/text-lengths/area-ratings (1-20, no duplicates, enum-valid, rating 1-5, comment<=500), derives coach_id/created_by/program_id server-side, inserts evaluation+ratings atomically as DRAFT. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Create Evaluation RPC".';

revoke all on function public.create_student_progress_evaluation(uuid, uuid, uuid, date, date, text, text, text, text, jsonb) from public;
grant execute on function public.create_student_progress_evaluation(uuid, uuid, uuid, date, date, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- update_student_progress_evaluation — the ONLY way an existing DRAFT is edited
-- ---------------------------------------------------------------------------
-- student_id/batch_id/program_id/coach_id/created_by/status/published_at/
-- published_by are never parameters here and are never changed by this
-- function. Area ratings use atomic replacement: full payload validated
-- first (identical rules to create), then existing ratings deleted and the
-- new set inserted, all inside this single function call — no partial
-- update if one area is invalid.
create or replace function public.update_student_progress_evaluation(
  target_evaluation_id uuid,
  period_start date,
  period_end date,
  summary text,
  strengths_text text,
  development_focus_text text,
  recommendation_text text,
  area_ratings jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_row record;
  v_entry jsonb;
  v_area text;
  v_rating integer;
  v_comment text;
  v_areas text[] := '{}';
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, coach_id, batch_id, status into v_row
  from public.student_progress_evaluations
  where id = target_evaluation_id;

  if v_row.id is null then
    raise exception 'EVALUATION_NOT_FOUND';
  end if;

  if v_row.coach_id is distinct from v_coach_id then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.coach_has_batch(v_row.batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_row.status <> 'DRAFT' then
    raise exception 'EVALUATION_NOT_EDITABLE';
  end if;

  if period_end < period_start then
    raise exception 'VALIDATION_ERROR';
  end if;

  if summary is not null and char_length(summary) > 2000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if strengths_text is not null and char_length(strengths_text) > 1500 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if development_focus_text is not null and char_length(development_focus_text) > 1500 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if recommendation_text is not null and char_length(recommendation_text) > 1500 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if jsonb_typeof(area_ratings) is distinct from 'array' then
    raise exception 'VALIDATION_ERROR';
  end if;
  if jsonb_array_length(area_ratings) < 1 or jsonb_array_length(area_ratings) > 20 then
    raise exception 'VALIDATION_ERROR';
  end if;

  for v_entry in select * from jsonb_array_elements(area_ratings)
  loop
    if not (v_entry ? 'area') or not (v_entry ? 'rating') then
      raise exception 'VALIDATION_ERROR';
    end if;

    v_area := v_entry ->> 'area';
    if v_area is null or v_area not in (
      'OPENING', 'MIDDLEGAME', 'ENDGAME', 'TACTICS', 'CALCULATION',
      'POSITIONAL_PLAY', 'TIME_MANAGEMENT', 'CONCENTRATION',
      'DECISION_MAKING', 'TOURNAMENT_PREPARATION'
    ) then
      raise exception 'VALIDATION_ERROR';
    end if;

    if v_area = any(v_areas) then
      raise exception 'VALIDATION_ERROR';
    end if;
    v_areas := array_append(v_areas, v_area);

    begin
      v_rating := (v_entry ->> 'rating')::integer;
    exception when others then
      raise exception 'VALIDATION_ERROR';
    end;
    if v_rating < 1 or v_rating > 5 then
      raise exception 'VALIDATION_ERROR';
    end if;

    v_comment := v_entry ->> 'comment';
    if v_comment is not null and char_length(v_comment) > 500 then
      raise exception 'VALIDATION_ERROR';
    end if;
  end loop;

  update public.student_progress_evaluations
  set
    evaluation_period_start = period_start,
    evaluation_period_end = period_end,
    overall_summary = summary,
    strengths = strengths_text,
    development_focus = development_focus_text,
    coach_recommendation = recommendation_text,
    updated_at = now()
  where id = target_evaluation_id
    and status = 'DRAFT';

  delete from public.student_progress_area_ratings where evaluation_id = target_evaluation_id;

  for v_entry in select * from jsonb_array_elements(area_ratings)
  loop
    insert into public.student_progress_area_ratings (evaluation_id, area, rating, comment)
    values (
      target_evaluation_id,
      (v_entry ->> 'area')::public.development_area,
      (v_entry ->> 'rating')::integer,
      v_entry ->> 'comment'
    );
  end loop;

  return true;
end;
$$;

comment on function public.update_student_progress_evaluation(uuid, date, date, text, text, text, text, jsonb) is
  'The only path that edits an existing DRAFT evaluation. Verifies evaluation.coach_id = current coach, status = DRAFT, and coach_has_batch(evaluation.batch_id); never changes student_id/batch_id/program_id/coach_id/created_by/status/published fields; replaces area ratings atomically (validate-all-then-delete-then-insert). See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Update Evaluation RPC".';

revoke all on function public.update_student_progress_evaluation(uuid, date, date, text, text, text, text, jsonb) from public;
grant execute on function public.update_student_progress_evaluation(uuid, date, date, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- publish_student_progress_evaluation — the ONLY path DRAFT -> PUBLISHED
-- ---------------------------------------------------------------------------
-- Requires at least one area rating (always true post-creation, since
-- create_student_progress_evaluation already enforces >=1) AND a non-empty
-- overall_summary — publishing an evaluation with no summary at all is
-- rejected as EMPTY_EVALUATION. The final UPDATE is conditioned atomically
-- on status = 'DRAFT' in its own WHERE clause, exactly like
-- transition_class_session_status() (0020), so a concurrent double-publish
-- cannot both succeed.
create or replace function public.publish_student_progress_evaluation(
  target_evaluation_id uuid
)
returns public.progress_evaluation_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_row record;
  v_area_count integer;
  v_updated_status public.progress_evaluation_status;
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, coach_id, batch_id, status, overall_summary into v_row
  from public.student_progress_evaluations
  where id = target_evaluation_id;

  if v_row.id is null then
    raise exception 'EVALUATION_NOT_FOUND';
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

  select count(*) into v_area_count
  from public.student_progress_area_ratings
  where evaluation_id = target_evaluation_id;

  if v_area_count < 1 or v_row.overall_summary is null or char_length(trim(v_row.overall_summary)) = 0 then
    raise exception 'EMPTY_EVALUATION';
  end if;

  update public.student_progress_evaluations
  set
    status = 'PUBLISHED',
    published_at = now(),
    published_by = auth.uid(),
    updated_at = now()
  where id = target_evaluation_id
    and status = 'DRAFT'
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.publish_student_progress_evaluation(uuid) is
  'The only path DRAFT -> PUBLISHED. Verifies evaluation.coach_id = current coach and coach_has_batch(evaluation.batch_id), requires >=1 area rating and a non-empty overall_summary (EMPTY_EVALUATION otherwise), sets published_at/published_by server-side, conditions the UPDATE atomically on status=DRAFT. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Publish Evaluation RPC" and "Published Evaluation Immutability".';

revoke all on function public.publish_student_progress_evaluation(uuid) from public;
grant execute on function public.publish_student_progress_evaluation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- archive_student_progress_evaluation — the ONLY path DRAFT -> ARCHIVED (coach scope)
-- ---------------------------------------------------------------------------
-- Coach may archive only their own DRAFT evaluation — never a PUBLISHED one
-- (published correction/unpublish workflows are deferred to a future Admin
-- architecture; see "Published Evaluation Immutability"). Atomic, same
-- pattern as publish above.
create or replace function public.archive_student_progress_evaluation(
  target_evaluation_id uuid
)
returns public.progress_evaluation_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_row record;
  v_updated_status public.progress_evaluation_status;
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, coach_id, batch_id, status into v_row
  from public.student_progress_evaluations
  where id = target_evaluation_id;

  if v_row.id is null then
    raise exception 'EVALUATION_NOT_FOUND';
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

  update public.student_progress_evaluations
  set status = 'ARCHIVED', updated_at = now()
  where id = target_evaluation_id
    and status = 'DRAFT'
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.archive_student_progress_evaluation(uuid) is
  'The only Coach Portal path DRAFT -> ARCHIVED. Never allows archiving a PUBLISHED evaluation. Verifies evaluation.coach_id = current coach and coach_has_batch(evaluation.batch_id). See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Archive Draft RPC".';

revoke all on function public.archive_student_progress_evaluation(uuid) from public;
grant execute on function public.archive_student_progress_evaluation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_progress_evaluations — coach-wide list under the historical read rule
-- ---------------------------------------------------------------------------
create or replace function public.get_coach_progress_evaluations()
returns table (
  evaluation_id uuid,
  student_id uuid,
  student_code text,
  student_full_name text,
  batch_id uuid,
  batch_name text,
  program_name text,
  evaluation_period_start date,
  evaluation_period_end date,
  status public.progress_evaluation_status,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    spe.id, spe.student_id, s.student_code, s.full_name,
    spe.batch_id, b.name, p.name,
    spe.evaluation_period_start, spe.evaluation_period_end, spe.status, spe.updated_at
  from public.student_progress_evaluations spe
  join public.students s on s.id = spe.student_id
  join public.batches b on b.id = spe.batch_id
  left join public.programs p on p.id = spe.program_id
  where spe.coach_id = public.current_coach_id() or public.coach_has_batch(spe.batch_id)
  order by spe.updated_at desc;
$$;

comment on function public.get_coach_progress_evaluations() is
  'Coach-wide evaluation list under the coach historical read rule (coach_id = current coach OR coach_has_batch(batch_id)). No fabricated overall/percentage score. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Read RPCs".';

revoke all on function public.get_coach_progress_evaluations() from public;
grant execute on function public.get_coach_progress_evaluations() to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_progress_evaluation — single evaluation detail + area ratings
-- ---------------------------------------------------------------------------
-- coach_can_manage tells the UI whether to render Edit/Publish/Archive
-- controls (status=DRAFT AND evaluation.coach_id=current coach AND
-- coach_has_batch(batch_id)) without ever exposing coach_id/created_by/
-- published_by UUIDs to the client. author_name is a display name only
-- (coaches.full_name) — never coach email/phone/whatsapp.
create or replace function public.get_coach_progress_evaluation(target_evaluation_id uuid)
returns table (
  evaluation_id uuid,
  student_id uuid,
  student_code text,
  student_full_name text,
  student_current_level text,
  batch_id uuid,
  batch_name text,
  program_id uuid,
  program_name text,
  evaluation_period_start date,
  evaluation_period_end date,
  status public.progress_evaluation_status,
  overall_summary text,
  strengths text,
  development_focus text,
  coach_recommendation text,
  author_name text,
  created_at timestamptz,
  published_at timestamptz,
  coach_can_manage boolean,
  area_ratings jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    spe.id, spe.student_id, s.student_code, s.full_name, s.current_level,
    spe.batch_id, b.name, spe.program_id, p.name,
    spe.evaluation_period_start, spe.evaluation_period_end, spe.status,
    spe.overall_summary, spe.strengths, spe.development_focus, spe.coach_recommendation,
    c.full_name,
    spe.created_at, spe.published_at,
    (spe.status = 'DRAFT' and spe.coach_id = public.current_coach_id() and public.coach_has_batch(spe.batch_id)),
    (
      select jsonb_agg(jsonb_build_object('area', par.area, 'rating', par.rating, 'comment', par.comment) order by par.area)
      from public.student_progress_area_ratings par
      where par.evaluation_id = spe.id
    )
  from public.student_progress_evaluations spe
  join public.students s on s.id = spe.student_id
  join public.batches b on b.id = spe.batch_id
  join public.coaches c on c.id = spe.coach_id
  left join public.programs p on p.id = spe.program_id
  where spe.id = target_evaluation_id
    and (spe.coach_id = public.current_coach_id() or public.coach_has_batch(spe.batch_id));
$$;

comment on function public.get_coach_progress_evaluation(uuid) is
  'Single evaluation detail + aggregated area ratings, under the coach historical read rule. Returns coach_can_manage (never coach_id/created_by/published_by UUIDs) so the UI can gate Edit/Publish/Archive. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Read RPCs".';

revoke all on function public.get_coach_progress_evaluation(uuid) from public;
grant execute on function public.get_coach_progress_evaluation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_batch_progress — batch-scoped list (continuity across PRIMARY/ASSISTANT/GUEST)
-- ---------------------------------------------------------------------------
-- Requires coach_has_batch(target_batch_id) up front; once satisfied, every
-- evaluation for that batch is visible regardless of which coach authored
-- it (the same historical read rule, applied batch-wide) — this is the
-- documented continuity decision described in the architecture doc.
create or replace function public.get_coach_batch_progress(target_batch_id uuid)
returns table (
  evaluation_id uuid,
  student_id uuid,
  student_code text,
  student_full_name text,
  program_name text,
  evaluation_period_start date,
  evaluation_period_end date,
  status public.progress_evaluation_status,
  author_name text,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    spe.id, spe.student_id, s.student_code, s.full_name,
    p.name,
    spe.evaluation_period_start, spe.evaluation_period_end, spe.status,
    c.full_name, spe.updated_at
  from public.student_progress_evaluations spe
  join public.students s on s.id = spe.student_id
  join public.coaches c on c.id = spe.coach_id
  left join public.programs p on p.id = spe.program_id
  where spe.batch_id = target_batch_id
    and public.coach_has_batch(target_batch_id)
  order by spe.updated_at desc;
$$;

comment on function public.get_coach_batch_progress(uuid) is
  'Batch-scoped evaluation list. Requires coach_has_batch(target_batch_id); once satisfied, shows every evaluation for that batch (continuity across PRIMARY/ASSISTANT/GUEST coach handoffs), author display name only (never coach contact details). See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Batch Progress Page".';

revoke all on function public.get_coach_batch_progress(uuid) from public;
grant execute on function public.get_coach_batch_progress(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_student_progress — one student's evaluation history within one batch
-- ---------------------------------------------------------------------------
-- Requires coach_has_batch(target_batch_id) AND student_in_batch_roster()
-- up front. PUBLISHED/ARCHIVED rows for the batch are visible under the same
-- continuity rule as get_coach_batch_progress; a DRAFT row is included only
-- when authored by the current coach (draft privacy is preserved even
-- within this batch-scoped history view).
create or replace function public.get_coach_student_progress(
  target_batch_id uuid,
  target_student_id uuid
)
returns table (
  evaluation_id uuid,
  evaluation_period_start date,
  evaluation_period_end date,
  status public.progress_evaluation_status,
  overall_summary text,
  strengths text,
  development_focus text,
  coach_recommendation text,
  author_name text,
  published_at timestamptz,
  area_ratings jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    spe.id,
    spe.evaluation_period_start, spe.evaluation_period_end, spe.status,
    spe.overall_summary, spe.strengths, spe.development_focus, spe.coach_recommendation,
    c.full_name, spe.published_at,
    (
      select jsonb_agg(jsonb_build_object('area', par.area, 'rating', par.rating, 'comment', par.comment) order by par.area)
      from public.student_progress_area_ratings par
      where par.evaluation_id = spe.id
    )
  from public.student_progress_evaluations spe
  join public.coaches c on c.id = spe.coach_id
  where spe.batch_id = target_batch_id
    and spe.student_id = target_student_id
    and public.coach_has_batch(target_batch_id)
    and public.student_in_batch_roster(target_student_id, target_batch_id)
    and (spe.status <> 'DRAFT' or spe.coach_id = public.current_coach_id())
  order by spe.evaluation_period_start desc;
$$;

comment on function public.get_coach_student_progress(uuid, uuid) is
  'One students evaluation history within one batch. Requires coach_has_batch(target_batch_id) + student_in_batch_roster(); DRAFT rows only shown when authored by the current coach, PUBLISHED/ARCHIVED shown under the batch continuity rule. Never shows attendance/parent/contact data. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Student Progress History".';

revoke all on function public.get_coach_student_progress(uuid, uuid) from public;
grant execute on function public.get_coach_student_progress(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_student_progress_evaluations — narrow, self-scoped PUBLISHED-only list
-- ---------------------------------------------------------------------------
-- Zero-argument, always scoped to current_student_id() internally — no
-- studentId is ever accepted as a parameter. Only status = PUBLISHED rows
-- are ever returned; DRAFT/ARCHIVED never reach this function's result set.
create or replace function public.get_student_progress_evaluations()
returns table (
  evaluation_id uuid,
  batch_id uuid,
  batch_name text,
  program_name text,
  evaluation_period_start date,
  evaluation_period_end date,
  overall_summary text,
  strengths text,
  development_focus text,
  coach_recommendation text,
  coach_display_name text,
  published_at timestamptz,
  area_ratings jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    spe.id, spe.batch_id, b.name, p.name,
    spe.evaluation_period_start, spe.evaluation_period_end,
    spe.overall_summary, spe.strengths, spe.development_focus, spe.coach_recommendation,
    c.full_name, spe.published_at,
    (
      select jsonb_agg(jsonb_build_object('area', par.area, 'rating', par.rating, 'comment', par.comment) order by par.area)
      from public.student_progress_area_ratings par
      where par.evaluation_id = spe.id
    )
  from public.student_progress_evaluations spe
  join public.batches b on b.id = spe.batch_id
  join public.coaches c on c.id = spe.coach_id
  left join public.programs p on p.id = spe.program_id
  where public.current_student_id() is not null
    and spe.student_id = public.current_student_id()
    and spe.status = 'PUBLISHED'
  order by spe.published_at desc;
$$;

comment on function public.get_student_progress_evaluations() is
  'Narrow, self-scoped PUBLISHED-only evaluation list for the current student only (no studentId parameter, no DRAFT/ARCHIVED). Never exposes created_by/published_by/coach contact details. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Student Progress Privacy".';

revoke all on function public.get_student_progress_evaluations() from public;
grant execute on function public.get_student_progress_evaluations() to authenticated;

-- ---------------------------------------------------------------------------
-- get_parent_student_progress_evaluations — relationship-scoped equivalent
-- ---------------------------------------------------------------------------
-- Takes target_student_id explicitly but authorization is enforced INSIDE
-- via parent_has_student() — an unauthorized target_student_id yields zero
-- rows, identical to an authorized student with no published evaluations
-- yet. Only status = PUBLISHED rows are ever returned.
create or replace function public.get_parent_student_progress_evaluations(target_student_id uuid)
returns table (
  evaluation_id uuid,
  batch_id uuid,
  batch_name text,
  program_name text,
  evaluation_period_start date,
  evaluation_period_end date,
  overall_summary text,
  strengths text,
  development_focus text,
  coach_recommendation text,
  coach_display_name text,
  published_at timestamptz,
  area_ratings jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    spe.id, spe.batch_id, b.name, p.name,
    spe.evaluation_period_start, spe.evaluation_period_end,
    spe.overall_summary, spe.strengths, spe.development_focus, spe.coach_recommendation,
    c.full_name, spe.published_at,
    (
      select jsonb_agg(jsonb_build_object('area', par.area, 'rating', par.rating, 'comment', par.comment) order by par.area)
      from public.student_progress_area_ratings par
      where par.evaluation_id = spe.id
    )
  from public.student_progress_evaluations spe
  join public.batches b on b.id = spe.batch_id
  join public.coaches c on c.id = spe.coach_id
  left join public.programs p on p.id = spe.program_id
  where public.parent_has_student(target_student_id)
    and spe.student_id = target_student_id
    and spe.status = 'PUBLISHED'
  order by spe.published_at desc;
$$;

comment on function public.get_parent_student_progress_evaluations(uuid) is
  'Relationship-scoped PUBLISHED-only evaluation list for one linked student. Authorization enforced inside via parent_has_student(), not by the caller. Never exposes created_by/published_by/coach contact details. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Parent Progress Privacy".';

revoke all on function public.get_parent_student_progress_evaluations(uuid) from public;
grant execute on function public.get_parent_student_progress_evaluations(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No admin UI, assignment, homework, certificate, payment, messaging,
-- notification, AI-generation, PGN/engine-analysis, or tournament-
-- integration table, column, policy, or function is added anywhere in
-- Phase 15. Admin (service-role) access continues to bypass RLS entirely
-- and is unaffected.
