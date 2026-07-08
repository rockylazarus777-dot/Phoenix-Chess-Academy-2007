-- =============================================================================
-- 0014_admin_audit_and_functions.sql
-- =============================================================================
-- Admin audit log table + atomic multi-table admin RPC functions.
--
-- SECURITY-CRITICAL DIFFERENCE FROM 0009_submission_functions.sql: the
-- functions in 0009 are PUBLIC entry points, deliberately granted to
-- `anon, authenticated`. The functions in THIS file are the opposite —
-- privileged admin operations that must be callable ONLY by the
-- service-role client (`src/lib/supabase/admin.ts`), after
-- `requirePermission()` has already authorized the caller in the
-- application layer. Because these are SECURITY DEFINER (they bypass
-- RLS by design, same mechanism as 0009's functions), granting EXECUTE
-- to `anon`/`authenticated` would let ANY authenticated user — including
-- a STUDENT — call `create_student_with_audit()` directly via the
-- Supabase client and bypass every application-layer permission check.
-- PostgreSQL grants EXECUTE to PUBLIC by default on new functions, so
-- every function below explicitly REVOKEs that default and grants only
-- to `service_role`. See docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
-- "Service-Role Security Boundary".

create type public.admin_audit_action as enum (
  'STUDENT_CREATED',
  'STUDENT_UPDATED',
  'STUDENT_STATUS_CHANGED',
  'PARENT_CREATED',
  'PARENT_UPDATED',
  'PARENT_LINKED',
  'PARENT_UNLINKED',
  'COACH_CREATED',
  'COACH_UPDATED',
  'BATCH_CREATED',
  'BATCH_UPDATED',
  'BATCH_COACH_ASSIGNED',
  'BATCH_COACH_UNASSIGNED',
  'SCHEDULE_CREATED',
  'SCHEDULE_UPDATED',
  'ENROLLMENT_CREATED',
  'ENROLLMENT_UPDATED',
  'BATCH_ENROLLMENT_CREATED',
  'BATCH_ENROLLMENT_ENDED',
  'ACCOUNT_INVITED',
  'ACCOUNT_CREATED',
  'ACCOUNT_DEACTIVATED',
  'ACCOUNT_REACTIVATED',
  'ROLE_CHANGED',
  'BULK_IMPORT_COMPLETED'
);

-- ---------------------------------------------------------------------------
-- ADMIN AUDIT LOG
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  actor_role public.user_role not null,
  action public.admin_audit_action not null,
  entity_type text not null,
  entity_id uuid,
  -- Short, human-readable line — e.g. "Student PCA-2026-00001 created".
  -- NEVER a dump of a full row. See "Audit Log" instructions: no
  -- passwords, no tokens, no full before/after PII objects.
  summary text not null,
  -- Minimal structured metadata only (e.g. {"status_from":"ACTIVE",
  -- "status_to":"ON_HOLD"}) — never a full entity payload.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_entity_type_check check (
    entity_type in ('student', 'parent', 'coach', 'batch', 'schedule', 'enrollment', 'batch_enrollment', 'account', 'role', 'import')
  )
);

comment on table public.admin_audit_log is
  'Minimal admin action audit trail. Insert-only from application code; entries are never created directly by a browser client — every insert happens through a SECURITY DEFINER RPC (this file) or a server-only service-role query, both gated by requirePermission() first.';

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_action_idx on public.admin_audit_log (action);
create index admin_audit_log_entity_type_idx on public.admin_audit_log (entity_type);

alter table public.admin_audit_log enable row level security;
-- No anon/authenticated policies — read access is via VIEW_AUDIT_LOG
-- (requirePermission) through the service-role client only, exactly
-- like every other Phase 10 table (see 0013_admin_operations_rls.sql).

-- ---------------------------------------------------------------------------
-- SHARED AUDIT HELPER
-- ---------------------------------------------------------------------------
create or replace function public.record_admin_audit(
  p_actor_profile_id uuid,
  p_actor_role public.user_role,
  p_action public.admin_audit_action,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.admin_audit_log (actor_profile_id, actor_role, action, entity_type, entity_id, summary, metadata)
  values (p_actor_profile_id, p_actor_role, p_action, p_entity_type, p_entity_id, p_summary, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_admin_audit(uuid, public.user_role, public.admin_audit_action, text, uuid, text, jsonb) from public;
grant execute on function public.record_admin_audit(uuid, public.user_role, public.admin_audit_action, text, uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- create_student_with_audit
-- ---------------------------------------------------------------------------
create or replace function public.create_student_with_audit(
  p_full_name text,
  p_date_of_birth date,
  p_gender text,
  p_email text,
  p_phone text,
  p_whatsapp text,
  p_country text,
  p_state text,
  p_city text,
  p_address text,
  p_fide_id text,
  p_fide_rating integer,
  p_chess_association_id text,
  p_current_level text,
  p_joined_on date,
  p_notes text,
  p_actor_profile_id uuid,
  p_actor_role public.user_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_student_code text;
begin
  insert into public.students (
    full_name, date_of_birth, gender, email, phone, whatsapp,
    country, state, city, address, fide_id, fide_rating, chess_association_id,
    current_level, joined_on, notes
  ) values (
    p_full_name, p_date_of_birth, nullif(p_gender, ''), nullif(p_email, ''), nullif(p_phone, ''), nullif(p_whatsapp, ''),
    p_country, nullif(p_state, ''), nullif(p_city, ''), nullif(p_address, ''), nullif(p_fide_id, ''), p_fide_rating, nullif(p_chess_association_id, ''),
    nullif(p_current_level, ''), p_joined_on, nullif(p_notes, '')
  )
  returning id, student_code into v_id, v_student_code;

  perform public.record_admin_audit(
    p_actor_profile_id, p_actor_role, 'STUDENT_CREATED', 'student', v_id,
    'Student ' || v_student_code || ' created.',
    jsonb_build_object('student_code', v_student_code)
  );

  return v_id;
end;
$$;

comment on function public.create_student_with_audit(text, date, text, text, text, text, text, text, text, text, text, integer, text, text, date, text, uuid, public.user_role) is
  'Atomically creates a students row and its audit log entry. Called only from the service-only admin Server Action after requirePermission(MANAGE_STUDENTS).';

revoke all on function public.create_student_with_audit(text, date, text, text, text, text, text, text, text, text, text, integer, text, text, date, text, uuid, public.user_role) from public;
grant execute on function public.create_student_with_audit(text, date, text, text, text, text, text, text, text, text, text, integer, text, text, date, text, uuid, public.user_role) to service_role;

-- ---------------------------------------------------------------------------
-- link_parent_to_student_with_audit
-- ---------------------------------------------------------------------------
create or replace function public.link_parent_to_student_with_audit(
  p_student_id uuid,
  p_parent_id uuid,
  p_relationship public.parent_relationship,
  p_is_primary boolean,
  p_can_receive_updates boolean,
  p_can_manage_student boolean,
  p_actor_profile_id uuid,
  p_actor_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_parents (student_id, parent_id, relationship, is_primary, can_receive_updates, can_manage_student)
  values (p_student_id, p_parent_id, p_relationship, coalesce(p_is_primary, false), coalesce(p_can_receive_updates, true), coalesce(p_can_manage_student, false))
  on conflict (student_id, parent_id) do update
    set relationship = excluded.relationship,
        is_primary = excluded.is_primary,
        can_receive_updates = excluded.can_receive_updates,
        can_manage_student = excluded.can_manage_student;

  perform public.record_admin_audit(
    p_actor_profile_id, p_actor_role, 'PARENT_LINKED', 'student', p_student_id,
    'Parent linked to student.',
    jsonb_build_object('parent_id', p_parent_id, 'relationship', p_relationship)
  );
end;
$$;

comment on function public.link_parent_to_student_with_audit(uuid, uuid, public.parent_relationship, boolean, boolean, boolean, uuid, public.user_role) is
  'Atomically upserts a student_parents link and its audit log entry. Called only from the service-only admin Server Action after requirePermission(MANAGE_PARENTS or MANAGE_STUDENTS).';

revoke all on function public.link_parent_to_student_with_audit(uuid, uuid, public.parent_relationship, boolean, boolean, boolean, uuid, public.user_role) from public;
grant execute on function public.link_parent_to_student_with_audit(uuid, uuid, public.parent_relationship, boolean, boolean, boolean, uuid, public.user_role) to service_role;

-- ---------------------------------------------------------------------------
-- create_batch_with_audit
-- ---------------------------------------------------------------------------
create or replace function public.create_batch_with_audit(
  p_batch_code text,
  p_name text,
  p_program_id uuid,
  p_location_id uuid,
  p_training_mode public.training_mode,
  p_level text,
  p_primary_coach_id uuid,
  p_capacity integer,
  p_start_date date,
  p_end_date date,
  p_actor_profile_id uuid,
  p_actor_role public.user_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.batches (
    batch_code, name, program_id, location_id, training_mode, level,
    primary_coach_id, capacity, start_date, end_date
  ) values (
    p_batch_code, p_name, p_program_id, p_location_id, p_training_mode, nullif(p_level, ''),
    p_primary_coach_id, p_capacity, p_start_date, p_end_date
  )
  returning id into v_id;

  if p_primary_coach_id is not null then
    insert into public.batch_coaches (batch_id, coach_id, role)
    values (v_id, p_primary_coach_id, 'PRIMARY');
  end if;

  perform public.record_admin_audit(
    p_actor_profile_id, p_actor_role, 'BATCH_CREATED', 'batch', v_id,
    'Batch ' || p_batch_code || ' created.',
    jsonb_build_object('batch_code', p_batch_code)
  );

  return v_id;
end;
$$;

comment on function public.create_batch_with_audit(text, text, uuid, uuid, public.training_mode, text, uuid, integer, date, date, uuid, public.user_role) is
  'Atomically creates a batches row (plus its PRIMARY batch_coaches assignment when a coach is given) and its audit log entry. Called only from the service-only admin Server Action after requirePermission(MANAGE_BATCHES).';

revoke all on function public.create_batch_with_audit(text, text, uuid, uuid, public.training_mode, text, uuid, integer, date, date, uuid, public.user_role) from public;
grant execute on function public.create_batch_with_audit(text, text, uuid, uuid, public.training_mode, text, uuid, integer, date, date, uuid, public.user_role) to service_role;

-- ---------------------------------------------------------------------------
-- create_enrollment_with_audit
-- ---------------------------------------------------------------------------
create or replace function public.create_enrollment_with_audit(
  p_student_id uuid,
  p_program_id uuid,
  p_batch_id uuid,
  p_notes text,
  p_actor_profile_id uuid,
  p_actor_role public.user_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.student_program_enrollments (student_id, program_id, batch_id, notes)
  values (p_student_id, p_program_id, p_batch_id, nullif(p_notes, ''))
  returning id into v_id;

  if p_batch_id is not null then
    insert into public.batch_enrollments (student_id, batch_id)
    values (p_student_id, p_batch_id)
    on conflict do nothing;
  end if;

  perform public.record_admin_audit(
    p_actor_profile_id, p_actor_role, 'ENROLLMENT_CREATED', 'enrollment', v_id,
    'Enrollment created.',
    jsonb_build_object('student_id', p_student_id, 'program_id', p_program_id, 'batch_id', p_batch_id)
  );

  return v_id;
end;
$$;

comment on function public.create_enrollment_with_audit(uuid, uuid, uuid, text, uuid, public.user_role) is
  'Atomically creates a student_program_enrollments row (plus a batch_enrollments membership row when a batch is given) and its audit log entry. Called only from the service-only admin Server Action after requirePermission(MANAGE_ENROLLMENTS).';

revoke all on function public.create_enrollment_with_audit(uuid, uuid, uuid, text, uuid, public.user_role) from public;
grant execute on function public.create_enrollment_with_audit(uuid, uuid, uuid, text, uuid, public.user_role) to service_role;
