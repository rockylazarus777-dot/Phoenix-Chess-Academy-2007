-- =============================================================================
-- 0020_attendance_rls.sql
-- =============================================================================
-- Phase 14 — RLS policies and RPC functions for class_sessions /
-- attendance_records (schema created in 0019_class_sessions_attendance.sql).
-- Does not edit 0019 or any earlier migration.
--
-- Reuses `current_coach_id()` / `coach_has_batch()` (0018),
-- `current_student_id()` (0016), and `current_parent_id()` /
-- `parent_has_student()` (0017) as-is — no redefinition.
--
-- SCOPE: this migration intentionally gives STUDENT and PARENT roles NO
-- direct RLS SELECT policy on class_sessions or attendance_records at
-- all. Historical batch-membership eligibility (see
-- "session_eligible_student_ids" below) is too date-aware/complex to
-- express cleanly as a row-level USING clause reused across both roles,
-- so all student/parent access goes through narrow SECURITY DEFINER RPCs
-- instead (get_student_attendance / get_parent_student_attendance) — see
-- docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Read RPC Decision".

-- ---------------------------------------------------------------------------
-- HELPER: session_eligible_student_ids(target_batch_id, target_session_date)
-- ---------------------------------------------------------------------------
-- HISTORICAL ROSTER DECISION (dual-path, session-date-aware): a student
-- is eligible for a given batch on a given date if EITHER:
--   (a) a batch_enrollments row exists with assigned_at on/before that
--       date AND (ended_at is null OR ended_at on/after that date), OR
--   (b) a student_program_enrollments row for that batch exists with
--       status NOT IN ('WITHDRAWN','CANCELLED'), enrolled_on on/before
--       that date, AND (completed_on is null OR completed_on on/after
--       that date).
-- WITHDRAWN/CANCELLED program enrollments are excluded outright rather
-- than date-checked: neither has a precise "ended on" date column in the
-- Phase 10 schema, so this project does not fabricate one — excluding
-- them is the conservative choice the spec calls for ("prefer
-- conservative eligibility... do not fabricate historical membership
-- when dates are unavailable"). This is a documented, deliberate
-- limitation: a student withdrawn from a program enrollment on the same
-- day as a session may be treated as ineligible even if they attended
-- earlier that day; Phase 14 has no data to distinguish that case.
--
-- ACCESS: intentionally NOT granted to `authenticated`. This function
-- returns real student UUIDs for an arbitrary target_batch_id — if any
-- authenticated user could call it directly, it would let a coach/
-- student/parent enumerate the membership of a batch they have no
-- relationship to. It is only ever invoked from inside other SECURITY
-- DEFINER functions below (which each perform their own authorization
-- check first), where it runs under the calling function owner's
-- privileges regardless of grants on this function itself.
create or replace function public.session_eligible_student_ids(
  target_batch_id uuid,
  target_session_date date
)
returns table (student_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select be.student_id
  from public.batch_enrollments be
  where be.batch_id = target_batch_id
    and be.assigned_at::date <= target_session_date
    and (be.ended_at is null or be.ended_at::date >= target_session_date)
  union
  select spe.student_id
  from public.student_program_enrollments spe
  where spe.batch_id = target_batch_id
    and spe.status not in ('WITHDRAWN', 'CANCELLED')
    and spe.enrolled_on <= target_session_date
    and (spe.completed_on is null or spe.completed_on >= target_session_date);
$$;

comment on function public.session_eligible_student_ids(uuid, date) is
  'Internal-only dual-path, session-date-aware eligibility helper — NOT granted to authenticated (would allow arbitrary batch-roster enumeration). Called only from within other SECURITY DEFINER functions that perform their own authorization first. See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Historical Roster Decision".';

revoke all on function public.session_eligible_student_ids(uuid, date) from public;

-- ---------------------------------------------------------------------------
-- CLASS_SESSIONS RLS — coach read/create only, no update/delete policy
-- ---------------------------------------------------------------------------
-- No UPDATE policy exists for class_sessions: RLS is row-level, not
-- column-level, and a broad "coach can update sessions on assigned
-- batches" policy would let a coach rewrite batch_id/session_date/times/
-- location/created_by, not just transition status. Status transitions
-- go exclusively through transition_class_session_status() below (see
-- "Session Status RPC" / "Direct Table Write Decision" in the
-- architecture doc). No DELETE policy exists for any role — sessions are
-- never deleted in Phase 14.
create policy "class_sessions_select_for_assigned_coach"
  on public.class_sessions
  for select
  to authenticated
  using (public.coach_has_batch(batch_id));

create policy "class_sessions_insert_for_assigned_coach"
  on public.class_sessions
  for insert
  to authenticated
  with check (public.coach_has_batch(batch_id) and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- ATTENDANCE_RECORDS RLS — coach read only, no insert/update/delete policy
-- ---------------------------------------------------------------------------
-- Same reasoning as class_sessions: a bulk attendance submission needs an
-- atomic all-or-nothing authorization/eligibility check across every
-- submitted student, which a row-level INSERT/UPDATE policy cannot
-- express. Writes go exclusively through mark_session_attendance()
-- below. See "Attendance Write Decision" in the architecture doc.
create policy "attendance_records_select_for_assigned_coach"
  on public.attendance_records
  for select
  to authenticated
  using (
    exists (
      select 1 from public.class_sessions cs
      where cs.id = attendance_records.session_id
        and public.coach_has_batch(cs.batch_id)
    )
  );

-- ---------------------------------------------------------------------------
-- transition_class_session_status — the ONLY way a session's status changes
-- ---------------------------------------------------------------------------
-- Allowed transitions: SCHEDULED -> COMPLETED, SCHEDULED -> CANCELLED.
-- Everything else (COMPLETED -> anything, CANCELLED -> anything,
-- SCHEDULED -> SCHEDULED) is rejected as INVALID_TRANSITION. The final
-- UPDATE is conditioned atomically on `status = 'SCHEDULED'` in its own
-- WHERE clause (not just checked earlier in the function), so a
-- concurrent double-submission cannot both succeed.
create or replace function public.transition_class_session_status(
  target_session_id uuid,
  target_status public.session_status
)
returns public.session_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_batch_id uuid;
  v_current_status public.session_status;
  v_updated_status public.session_status;
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if target_status not in ('COMPLETED', 'CANCELLED') then
    raise exception 'INVALID_TRANSITION';
  end if;

  select batch_id, status into v_batch_id, v_current_status
  from public.class_sessions
  where id = target_session_id;

  if v_batch_id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if not public.coach_has_batch(v_batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_current_status <> 'SCHEDULED' then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.class_sessions
  set
    status = target_status,
    cancelled_at = case when target_status = 'CANCELLED' then now() else null end,
    cancelled_by = case when target_status = 'CANCELLED' then auth.uid() else null end,
    updated_at = now()
  where id = target_session_id
    and status = 'SCHEDULED'
  returning status into v_updated_status;

  if v_updated_status is null then
    -- Lost a race to a concurrent transition — the atomic WHERE
    -- condition above is what actually prevents a double-transition;
    -- this branch just reports it safely.
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.transition_class_session_status(uuid, public.session_status) is
  'The only path that changes class_sessions.status. Verifies the caller is COACH, resolves current_coach_id(), verifies coach_has_batch(session.batch_id), allows only SCHEDULED->COMPLETED/CANCELLED, and conditions the UPDATE atomically on status=SCHEDULED. See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Session Status Transition Architecture".';

revoke all on function public.transition_class_session_status(uuid, public.session_status) from public;
grant execute on function public.transition_class_session_status(uuid, public.session_status) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_session_attendance — the ONLY way attendance_records is written
-- ---------------------------------------------------------------------------
-- attendance_payload shape: a JSON array of objects, each
-- { "student_id": "<uuid>", "status": "PRESENT"|"ABSENT"|"LATE"|"EXCUSED",
--   "notes": "<optional string, <=500 chars>" }.
--
-- ATOMIC REJECTION BEHAVIOUR: every entry is validated (shape, UUID,
-- enum membership, note length, no duplicate student_id) AND every
-- submitted student_id is checked against
-- session_eligible_student_ids(batch_id, session_date) BEFORE any write
-- happens. If validation fails, or even ONE submitted student is outside
-- the eligible roster, the entire call raises an exception and NOTHING
-- is written — there is no partial/mixed success.
create or replace function public.mark_session_attendance(
  target_session_id uuid,
  attendance_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_batch_id uuid;
  v_session_date date;
  v_status public.session_status;
  v_entry jsonb;
  v_student_id uuid;
  v_att_status text;
  v_notes text;
  v_count integer := 0;
  v_seen uuid[] := '{}';
  v_eligible_seen uuid[];
begin
  v_coach_id := public.current_coach_id();
  if v_coach_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select batch_id, session_date, status into v_batch_id, v_session_date, v_status
  from public.class_sessions
  where id = target_session_id;

  if v_batch_id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if not public.coach_has_batch(v_batch_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_status = 'CANCELLED' then
    raise exception 'SESSION_CANCELLED';
  end if;

  if jsonb_typeof(attendance_payload) is distinct from 'array' then
    raise exception 'VALIDATION_ERROR';
  end if;

  if jsonb_array_length(attendance_payload) = 0 then
    raise exception 'VALIDATION_ERROR';
  end if;

  -- Recommended maximum: 500 entries per call.
  if jsonb_array_length(attendance_payload) > 500 then
    raise exception 'VALIDATION_ERROR';
  end if;

  -- PASS 1 — validate every entry's shape/enum/note-length and reject
  -- duplicate student IDs within the same payload. Nothing is written
  -- in this pass.
  for v_entry in select * from jsonb_array_elements(attendance_payload)
  loop
    if not (v_entry ? 'student_id') or not (v_entry ? 'status') then
      raise exception 'VALIDATION_ERROR';
    end if;

    begin
      v_student_id := (v_entry ->> 'student_id')::uuid;
    exception when others then
      raise exception 'VALIDATION_ERROR';
    end;

    v_att_status := v_entry ->> 'status';
    if v_att_status is null or v_att_status not in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED') then
      raise exception 'VALIDATION_ERROR';
    end if;

    v_notes := v_entry ->> 'notes';
    if v_notes is not null and char_length(v_notes) > 500 then
      raise exception 'VALIDATION_ERROR';
    end if;

    if v_student_id = any(v_seen) then
      raise exception 'VALIDATION_ERROR';
    end if;
    v_seen := array_append(v_seen, v_student_id);
  end loop;

  -- PASS 2 — every submitted student must be session-date-eligible for
  -- this session's batch. Reject the WHOLE payload if even one is not
  -- (no partial marking of a malicious mixed roster).
  select array_agg(student_id) into v_eligible_seen
  from public.session_eligible_student_ids(v_batch_id, v_session_date)
  where student_id = any(v_seen);

  if coalesce(array_length(v_eligible_seen, 1), 0) <> array_length(v_seen, 1) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  -- PASS 3 — all validated; upsert atomically. marked_by/marked_at are
  -- always server-derived — never accepted from the payload.
  for v_entry in select * from jsonb_array_elements(attendance_payload)
  loop
    insert into public.attendance_records (session_id, student_id, status, marked_by, marked_at, notes, updated_at)
    values (
      target_session_id,
      (v_entry ->> 'student_id')::uuid,
      (v_entry ->> 'status')::public.attendance_status,
      auth.uid(),
      now(),
      v_entry ->> 'notes',
      now()
    )
    on conflict (session_id, student_id)
    do update set
      status = excluded.status,
      marked_by = excluded.marked_by,
      marked_at = excluded.marked_at,
      notes = excluded.notes,
      updated_at = now();
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.mark_session_attendance(uuid, jsonb) is
  'The only path that writes attendance_records. Verifies COACH + coach_has_batch(session.batch_id), rejects CANCELLED sessions, validates the entire payload (shape/uuid/enum/note-length/no-duplicates) and every students session-date eligibility BEFORE writing anything, then upserts atomically (one row per session+student). marked_by/marked_at are always server-derived. See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Bulk Attendance RPC" and "Atomic Rejection Behaviour".';

revoke all on function public.mark_session_attendance(uuid, jsonb) from public;
grant execute on function public.mark_session_attendance(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- get_coach_session_attendance — narrow, PII-safe roster+attendance merge
-- ---------------------------------------------------------------------------
-- Same privacy rationale as get_coach_batch_roster() (0018): a direct
-- SELECT policy on `students` would expose every PII column regardless
-- of what the UI selects. This RPC returns only the seven columns the
-- attendance-marking page needs, merged with any EXISTING attendance
-- row (null status/notes/marked_at when the student has not been marked
-- yet — never fabricated). Unauthorized/nonexistent target_session_id
-- yields zero rows.
create or replace function public.get_coach_session_attendance(target_session_id uuid)
returns table (
  student_id uuid,
  student_code text,
  full_name text,
  current_level text,
  attendance_status public.attendance_status,
  notes text,
  marked_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.student_code, s.full_name, s.current_level, ar.status, ar.notes, ar.marked_at
  from public.class_sessions cs
  join public.session_eligible_student_ids(cs.batch_id, cs.session_date) eid on true
  join public.students s on s.id = eid.student_id
  left join public.attendance_records ar on ar.session_id = cs.id and ar.student_id = s.id
  where cs.id = target_session_id
    and public.coach_has_batch(cs.batch_id);
$$;

comment on function public.get_coach_session_attendance(uuid) is
  'Narrow, self-scoped roster+attendance merge for one of the callers assigned sessions (student_code/full_name/current_level/attendance_status/notes/marked_at only — no DOB/address/email/phone/whatsapp/parent data). null attendance_status means Not Marked, never fabricated. See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Attendance Marking Page".';

revoke all on function public.get_coach_session_attendance(uuid) from public;
grant execute on function public.get_coach_session_attendance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_student_attendance — narrow, self-scoped dated session+attendance list
-- ---------------------------------------------------------------------------
-- Zero-argument, always scoped to current_student_id() internally (same
-- convention as get_student_batch_coaches() in 0016) — no studentId is
-- ever accepted as a parameter. A student sees a session only if they
-- were session-date-eligible for that session's batch.
create or replace function public.get_student_attendance()
returns table (
  session_id uuid,
  session_date date,
  start_time time,
  end_time time,
  timezone text,
  batch_id uuid,
  batch_name text,
  session_status public.session_status,
  attendance_status public.attendance_status
)
language sql
security definer
stable
set search_path = public
as $$
  select cs.id, cs.session_date, cs.start_time, cs.end_time, cs.timezone, cs.batch_id, b.name, cs.status, ar.status
  from public.class_sessions cs
  join public.batches b on b.id = cs.batch_id
  left join public.attendance_records ar
    on ar.session_id = cs.id and ar.student_id = public.current_student_id()
  where public.current_student_id() is not null
    and public.current_student_id() in (
      select student_id from public.session_eligible_student_ids(cs.batch_id, cs.session_date)
    )
  order by cs.session_date desc, cs.start_time desc;
$$;

comment on function public.get_student_attendance() is
  'Narrow, self-scoped dated-session + attendance list for the current student only (no studentId parameter). Never exposes attendance_records.notes (coach-only). See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Student Attendance Privacy Boundary".';

revoke all on function public.get_student_attendance() from public;
grant execute on function public.get_student_attendance() to authenticated;

-- ---------------------------------------------------------------------------
-- get_parent_student_attendance — narrow, relationship-scoped equivalent
-- ---------------------------------------------------------------------------
-- Takes target_student_id explicitly (a parent may have more than one
-- linked student) but authorization is enforced INSIDE the function via
-- parent_has_student(), not by trusting the caller — an unauthorized
-- target_student_id yields zero rows, identical to an authorized student
-- with no visible sessions yet.
create or replace function public.get_parent_student_attendance(target_student_id uuid)
returns table (
  session_id uuid,
  session_date date,
  start_time time,
  end_time time,
  timezone text,
  batch_id uuid,
  batch_name text,
  session_status public.session_status,
  attendance_status public.attendance_status
)
language sql
security definer
stable
set search_path = public
as $$
  select cs.id, cs.session_date, cs.start_time, cs.end_time, cs.timezone, cs.batch_id, b.name, cs.status, ar.status
  from public.class_sessions cs
  join public.batches b on b.id = cs.batch_id
  left join public.attendance_records ar
    on ar.session_id = cs.id and ar.student_id = target_student_id
  where public.parent_has_student(target_student_id)
    and target_student_id in (
      select student_id from public.session_eligible_student_ids(cs.batch_id, cs.session_date)
    )
  order by cs.session_date desc, cs.start_time desc;
$$;

comment on function public.get_parent_student_attendance(uuid) is
  'Narrow, relationship-scoped dated-session + attendance list for one linked student. Authorization enforced inside via parent_has_student(), not by the caller. Never exposes attendance_records.notes (coach-only). See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Parent Attendance Privacy Boundary".';

revoke all on function public.get_parent_student_attendance(uuid) from public;
grant execute on function public.get_parent_student_attendance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No progress/evaluation/assignment/certificate/payment table or policy
-- is touched by this migration. Admin (service-role) access continues to
-- bypass RLS entirely and is unaffected — no Admin Portal UI for
-- sessions/attendance is built in Phase 14 (see
-- docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Admin Architecture
-- Decision").
