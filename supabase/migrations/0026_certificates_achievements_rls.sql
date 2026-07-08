-- =============================================================================
-- 0026_certificates_achievements_rls.sql
-- =============================================================================
-- Phase 17 — RLS policies and RPC functions for student_certificates /
-- student_achievements (schema created in
-- 0025_certificates_achievements.sql). Does not edit 0025 or any earlier
-- migration.
--
-- ARCHITECTURE DECISION — ADMIN MUTATION VIA auth.uid()-SCOPED RPCS, NOT
-- THE SERVICE-ROLE CLIENT:
-- Every other Phase 10 admin entity (students/parents/coaches/batches/
-- schedules/enrollments/accounts) is written through
-- `getAdminSupabaseClient()` (the service-role client, which bypasses RLS
-- entirely) gated purely by the application-layer `requirePermission()`
-- check — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Service-Role
-- Security Boundary". Phase 17 deliberately does NOT extend that
-- service-role pattern to certificates/achievements. Instead, every
-- certificate/achievement RPC below resolves `auth.uid()` and
-- independently verifies the caller is an active ADMIN/SUPER_ADMIN
-- profile via the new `current_admin_profile_id()` helper — the exact
-- same `SECURITY DEFINER` + `auth.uid()` + `REVOKE ALL FROM PUBLIC` /
-- `GRANT EXECUTE TO authenticated` pattern already used for Coach/
-- Student/Parent RPCs in Phases 14-16. This is a deliberate, documented
-- divergence: it keeps certificate/achievement mutation entirely inside
-- RLS-visible, auth.uid()-scoped functions rather than widening the
-- service-role bypass to a new sensitive record type, and it gives these
-- two tables genuine database-level enforcement (not just app-layer
-- `requirePermission()`) as an independent second layer. The `/admin`
-- route-level gate is unchanged — pages still call `requirePermission()`
-- first (see "Admin Permission Layer" below) — this is additive
-- defense-in-depth, not a replacement. See
-- docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin-Only Mutation
-- Decision".
--
-- Reuses current_student_id() (0016), current_parent_id() /
-- parent_has_student() (0017) as-is — no redefinition.

-- ---------------------------------------------------------------------------
-- HELPER: current_admin_profile_id()
-- ---------------------------------------------------------------------------
-- Resolves to the caller's own profiles.id (which by construction equals
-- auth.uid()) only when that profile's role is ADMIN or SUPER_ADMIN and
-- the profile is active. STAFF is deliberately excluded — certificates
-- and achievements are official academy records, and mutation authority
-- for them is kept to the same ADMIN/SUPER_ADMIN tier already used for
-- MANAGE_COACHES/MANAGE_BATCHES/MANAGE_ACCOUNTS in
-- src/lib/auth/permissions.ts (Phase 10), not the broader STAFF tier.
-- Returns null for any other caller (including an inactive ADMIN
-- profile) — every RPC below treats null as "not authorized," never
-- "authorized by default."
create or replace function public.current_admin_profile_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.profiles
  where id = auth.uid()
    and role in ('ADMIN', 'SUPER_ADMIN')
    and active = true;
$$;

comment on function public.current_admin_profile_id() is
  'Resolves the current auth.uid() to its own profiles.id only when role is ADMIN or SUPER_ADMIN and active=true, else null. STAFF is deliberately excluded. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin-Only Mutation Decision".';

revoke all on function public.current_admin_profile_id() from public;
grant execute on function public.current_admin_profile_id() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — ADMIN backstop SELECT only, no broad mutation policy, no
-- Student/Parent/Coach policy of any kind
-- ---------------------------------------------------------------------------
-- These two policies are a defense-in-depth backstop, not the primary
-- read path — the primary path for every role is the narrow RPCs below
-- (SECURITY DEFINER functions bypass RLS internally). No INSERT/UPDATE/
-- DELETE policy exists for ADMIN on either table — all writes go
-- exclusively through the nine write RPCs. Coach gets no policy of any
-- kind in Phase 17 (see "Coach Certificate/Achievement Access Decision" —
-- no access at all, not even read).
create policy "student_certificates_select_for_admin"
  on public.student_certificates
  for select
  to authenticated
  using (public.current_admin_profile_id() is not null);

create policy "student_achievements_select_for_admin"
  on public.student_achievements
  for select
  to authenticated
  using (public.current_admin_profile_id() is not null);

-- ---------------------------------------------------------------------------
-- search_students_for_admin_record — narrow, ADMIN-only student search
-- ---------------------------------------------------------------------------
-- Never returns contact PII (email/phone/WhatsApp/address/DOB/parent
-- data) — only id/full_name/student_code. Requires a minimum 2-character
-- normalized query and caps results at 20 — no 5,000-student payload is
-- ever possible through this function. Not exposed to Coach/Student/
-- Parent: the internal role check makes any non-admin caller receive
-- zero rows even though GRANT EXECUTE TO authenticated is required by
-- Postgres for any authenticated-role caller to invoke it at all.
create or replace function public.search_students_for_admin_record(target_query text)
returns table (
  student_id uuid,
  student_name text,
  student_code text
)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.full_name, s.student_code
  from public.students s
  where public.current_admin_profile_id() is not null
    and char_length(trim(coalesce(target_query, ''))) >= 2
    and (
      s.full_name ilike '%' || trim(target_query) || '%'
      or s.student_code ilike '%' || trim(target_query) || '%'
    )
  order by s.full_name
  limit 20;
$$;

comment on function public.search_students_for_admin_record(text) is
  'ADMIN-only narrow student search for certificate/achievement creation forms. Returns only id/full_name/student_code, minimum 2-character query, max 20 rows. Never returns contact PII. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Student Search Architecture".';

revoke all on function public.search_students_for_admin_record(text) from public;
grant execute on function public.search_students_for_admin_record(text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_student_certificate — the ONLY way a new certificate is created
-- ---------------------------------------------------------------------------
-- Always inserted as DRAFT. created_by is always server-derived from
-- auth.uid() — never accepted as a parameter. certificate_number/
-- issued_on/issued_by/status are never parameters here.
create or replace function public.create_student_certificate(
  target_student_id uuid,
  target_certificate_type public.certificate_type,
  target_title text,
  target_description text,
  target_program_id uuid,
  target_tournament_id uuid,
  target_achievement_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_title text;
  v_achievement_student_id uuid;
  v_certificate_id uuid;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not exists (select 1 from public.students where id = target_student_id) then
    raise exception 'VALIDATION_ERROR';
  end if;

  v_title := trim(target_title);
  if v_title is null or char_length(v_title) = 0 or char_length(v_title) > 200 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_description is not null and char_length(target_description) > 3000 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_certificate_type = 'PROGRAM_COMPLETION' and target_program_id is null then
    raise exception 'INVALID_CERTIFICATE_CONTEXT';
  end if;
  if target_certificate_type in ('TOURNAMENT_PARTICIPATION', 'TOURNAMENT_ACHIEVEMENT') and target_tournament_id is null then
    raise exception 'INVALID_CERTIFICATE_CONTEXT';
  end if;

  if target_program_id is not null and not exists (select 1 from public.programs where id = target_program_id) then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_tournament_id is not null and not exists (select 1 from public.tournaments where id = target_tournament_id) then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_achievement_id is not null then
    if target_certificate_type not in ('TOURNAMENT_ACHIEVEMENT', 'SPECIAL_RECOGNITION') then
      raise exception 'INVALID_CERTIFICATE_CONTEXT';
    end if;

    select student_id into v_achievement_student_id
    from public.student_achievements
    where id = target_achievement_id;

    if v_achievement_student_id is null then
      raise exception 'VALIDATION_ERROR';
    end if;
    if v_achievement_student_id <> target_student_id then
      raise exception 'INVALID_CERTIFICATE_CONTEXT';
    end if;
  end if;

  insert into public.student_certificates (
    student_id, certificate_type, title, description, program_id, tournament_id, achievement_id, status, created_by
  )
  values (
    target_student_id, target_certificate_type, v_title, nullif(trim(coalesce(target_description, '')), ''),
    target_program_id, target_tournament_id, target_achievement_id, 'DRAFT', auth.uid()
  )
  returning id into v_certificate_id;

  return v_certificate_id;
end;
$$;

comment on function public.create_student_certificate(uuid, public.certificate_type, text, text, uuid, uuid, uuid) is
  'The only path that creates certificate records. ADMIN only. Validates student existence, certificate context (program/tournament required per type), achievement ownership (achievement.student_id must equal target_student_id), and text lengths; always inserts as DRAFT with server-derived created_by. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Create Certificate RPC".';

revoke all on function public.create_student_certificate(uuid, public.certificate_type, text, text, uuid, uuid, uuid) from public;
grant execute on function public.create_student_certificate(uuid, public.certificate_type, text, text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_student_certificate — the ONLY way an existing DRAFT is edited
-- ---------------------------------------------------------------------------
-- student_id/status/certificate_number/created_by/issued_on/issued_by/
-- revoked_at/revoked_by are never parameters here and are never changed
-- by this function. If the wrong student was selected, the documented
-- path is: this DRAFT has no delete/archive path in Phase 17 (see
-- "Certificate Draft Correction Limitation") — student_id can never be
-- mutated, only the certificate's content/context fields.
create or replace function public.update_student_certificate(
  target_certificate_id uuid,
  target_certificate_type public.certificate_type,
  target_title text,
  target_description text,
  target_program_id uuid,
  target_tournament_id uuid,
  target_achievement_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_row record;
  v_title text;
  v_achievement_student_id uuid;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, student_id, status into v_row
  from public.student_certificates
  where id = target_certificate_id;

  if v_row.id is null then
    raise exception 'CERTIFICATE_NOT_FOUND';
  end if;

  if v_row.status <> 'DRAFT' then
    raise exception 'CERTIFICATE_NOT_EDITABLE';
  end if;

  v_title := trim(target_title);
  if v_title is null or char_length(v_title) = 0 or char_length(v_title) > 200 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_description is not null and char_length(target_description) > 3000 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_certificate_type = 'PROGRAM_COMPLETION' and target_program_id is null then
    raise exception 'INVALID_CERTIFICATE_CONTEXT';
  end if;
  if target_certificate_type in ('TOURNAMENT_PARTICIPATION', 'TOURNAMENT_ACHIEVEMENT') and target_tournament_id is null then
    raise exception 'INVALID_CERTIFICATE_CONTEXT';
  end if;

  if target_program_id is not null and not exists (select 1 from public.programs where id = target_program_id) then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_tournament_id is not null and not exists (select 1 from public.tournaments where id = target_tournament_id) then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_achievement_id is not null then
    if target_certificate_type not in ('TOURNAMENT_ACHIEVEMENT', 'SPECIAL_RECOGNITION') then
      raise exception 'INVALID_CERTIFICATE_CONTEXT';
    end if;

    select student_id into v_achievement_student_id
    from public.student_achievements
    where id = target_achievement_id;

    if v_achievement_student_id is null then
      raise exception 'VALIDATION_ERROR';
    end if;
    if v_achievement_student_id <> v_row.student_id then
      raise exception 'INVALID_CERTIFICATE_CONTEXT';
    end if;
  end if;

  update public.student_certificates
  set
    certificate_type = target_certificate_type,
    title = v_title,
    description = nullif(trim(coalesce(target_description, '')), ''),
    program_id = target_program_id,
    tournament_id = target_tournament_id,
    achievement_id = target_achievement_id,
    updated_at = now()
  where id = target_certificate_id
    and status = 'DRAFT';

  return true;
end;
$$;

comment on function public.update_student_certificate(uuid, public.certificate_type, text, text, uuid, uuid, uuid) is
  'The only path that edits an existing DRAFT certificate. ADMIN only, DRAFT only. Never changes student_id/status/certificate_number/created_by/issued_on/issued_by/revoked_at/revoked_by. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Update Certificate RPC".';

revoke all on function public.update_student_certificate(uuid, public.certificate_type, text, text, uuid, uuid, uuid) from public;
grant execute on function public.update_student_certificate(uuid, public.certificate_type, text, text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- issue_student_certificate — the ONLY path DRAFT -> ISSUED
-- ---------------------------------------------------------------------------
-- CERTIFICATE ISSUE TRANSACTION: certificate_number is generated
-- server-side (format PCA-YYYY-XXXXXXXX, YYYY = current year, XXXXXXXX =
-- 8 uppercase hex characters drawn from gen_random_uuid() — 32 bits of
-- randomness per year) and never accepted from the caller. Uniqueness is
-- handled database-safely: the UPDATE is attempted inside an exception
-- block that catches unique_violation and retries with a freshly
-- generated number, up to 10 attempts, before raising
-- CERTIFICATE_NUMBER_GENERATION_FAILED — this is a genuine
-- catch-and-retry guarantee (relying on the table's own UNIQUE
-- constraint as the source of truth), not just a check-then-hope. See
-- docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Certificate Number
-- Generation Decision".
create or replace function public.issue_student_certificate(
  target_certificate_id uuid,
  target_issued_on date
)
returns public.certificate_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_row record;
  v_certificate_number text;
  v_attempt integer := 0;
  v_updated_status public.certificate_status;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, status, certificate_type, program_id, tournament_id, title
  into v_row
  from public.student_certificates
  where id = target_certificate_id;

  if v_row.id is null then
    raise exception 'CERTIFICATE_NOT_FOUND';
  end if;

  if v_row.status <> 'DRAFT' then
    raise exception 'INVALID_TRANSITION';
  end if;

  if v_row.title is null or char_length(trim(v_row.title)) = 0 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if v_row.certificate_type = 'PROGRAM_COMPLETION' and v_row.program_id is null then
    raise exception 'INVALID_CERTIFICATE_CONTEXT';
  end if;
  if v_row.certificate_type in ('TOURNAMENT_PARTICIPATION', 'TOURNAMENT_ACHIEVEMENT') and v_row.tournament_id is null then
    raise exception 'INVALID_CERTIFICATE_CONTEXT';
  end if;

  if target_issued_on is null then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_issued_on > current_date then
    raise exception 'VALIDATION_ERROR';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_certificate_number := 'PCA-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    begin
      update public.student_certificates
      set
        status = 'ISSUED',
        certificate_number = v_certificate_number,
        issued_on = target_issued_on,
        issued_by = auth.uid(),
        updated_at = now()
      where id = target_certificate_id
        and status = 'DRAFT'
      returning status into v_updated_status;

      exit;
    exception when unique_violation then
      if v_attempt >= 10 then
        raise exception 'CERTIFICATE_NUMBER_GENERATION_FAILED';
      end if;
      -- loop again with a freshly generated number
    end;
  end loop;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.issue_student_certificate(uuid, date) is
  'The only path DRAFT -> ISSUED. ADMIN only. Revalidates certificate context, requires an explicit non-future issued_on date, generates a unique certificate_number server-side with catch-and-retry uniqueness handling, sets issued_by=auth.uid(). Never allows ISSUED->DRAFT, REVOKED->ISSUED, or DRAFT->REVOKED. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Issue Certificate RPC" and "Certificate Issue Transaction".';

revoke all on function public.issue_student_certificate(uuid, date) from public;
grant execute on function public.issue_student_certificate(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_student_certificate — the ONLY path ISSUED -> REVOKED
-- ---------------------------------------------------------------------------
-- certificate_number and issued_on are never cleared — a revoked
-- certificate remains a permanent historical record, never deleted.
create or replace function public.revoke_student_certificate(
  target_certificate_id uuid,
  target_revocation_reason text
)
returns public.certificate_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_row record;
  v_reason text;
  v_updated_status public.certificate_status;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, status into v_row
  from public.student_certificates
  where id = target_certificate_id;

  if v_row.id is null then
    raise exception 'CERTIFICATE_NOT_FOUND';
  end if;

  if v_row.status <> 'ISSUED' then
    raise exception 'INVALID_TRANSITION';
  end if;

  v_reason := nullif(trim(coalesce(target_revocation_reason, '')), '');
  if v_reason is null then
    raise exception 'REVOCATION_REASON_REQUIRED';
  end if;
  if char_length(v_reason) > 2000 then
    raise exception 'VALIDATION_ERROR';
  end if;

  update public.student_certificates
  set
    status = 'REVOKED',
    revoked_at = now(),
    revoked_by = auth.uid(),
    revocation_reason = v_reason,
    updated_at = now()
  where id = target_certificate_id
    and status = 'ISSUED'
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.revoke_student_certificate(uuid, text) is
  'The only path ISSUED -> REVOKED. ADMIN only. Requires non-empty revocation reason (<=2000 chars). Never clears certificate_number/issued_on. Never allows DRAFT->REVOKED or REVOKED->ISSUED. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Revoke Certificate RPC".';

revoke all on function public.revoke_student_certificate(uuid, text) from public;
grant execute on function public.revoke_student_certificate(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_student_achievement — the ONLY way a new achievement is created
-- ---------------------------------------------------------------------------
create or replace function public.create_student_achievement(
  target_student_id uuid,
  target_achievement_type public.achievement_type,
  target_title text,
  target_description text,
  target_achievement_date date,
  target_program_id uuid,
  target_tournament_id uuid,
  target_placement integer,
  target_external_organization text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_title text;
  v_external_org text;
  v_achievement_id uuid;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not exists (select 1 from public.students where id = target_student_id) then
    raise exception 'VALIDATION_ERROR';
  end if;

  v_title := trim(target_title);
  if v_title is null or char_length(v_title) = 0 or char_length(v_title) > 200 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_description is not null and char_length(target_description) > 3000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  v_external_org := nullif(trim(coalesce(target_external_organization, '')), '');
  if v_external_org is not null and char_length(v_external_org) > 300 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_achievement_type in ('TOURNAMENT_WINNER', 'TOURNAMENT_RUNNER_UP', 'TOURNAMENT_PLACEMENT') and target_tournament_id is null then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;
  if target_tournament_id is not null and not exists (select 1 from public.tournaments where id = target_tournament_id) then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_program_id is not null and not exists (select 1 from public.programs where id = target_program_id) then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_achievement_type = 'TOURNAMENT_WINNER' and target_placement is distinct from 1 then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;
  if target_achievement_type = 'TOURNAMENT_RUNNER_UP' and target_placement is distinct from 2 then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;
  if target_achievement_type = 'TOURNAMENT_PLACEMENT' and (target_placement is null or target_placement < 1) then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;
  if target_achievement_type not in ('TOURNAMENT_WINNER', 'TOURNAMENT_RUNNER_UP', 'TOURNAMENT_PLACEMENT') and target_placement is not null then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;

  insert into public.student_achievements (
    student_id, achievement_type, title, description, achievement_date,
    program_id, tournament_id, placement, external_organization, status, created_by
  )
  values (
    target_student_id, target_achievement_type, v_title, nullif(trim(coalesce(target_description, '')), ''),
    target_achievement_date, target_program_id, target_tournament_id, target_placement, v_external_org, 'DRAFT', auth.uid()
  )
  returning id into v_achievement_id;

  return v_achievement_id;
end;
$$;

comment on function public.create_student_achievement(uuid, public.achievement_type, text, text, date, uuid, uuid, integer, text) is
  'The only path that creates achievement records. ADMIN only. Validates student existence, tournament context, placement-per-type rules, and text lengths; always inserts as DRAFT with server-derived created_by. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Create Achievement RPC".';

revoke all on function public.create_student_achievement(uuid, public.achievement_type, text, text, date, uuid, uuid, integer, text) from public;
grant execute on function public.create_student_achievement(uuid, public.achievement_type, text, text, date, uuid, uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_student_achievement — the ONLY way an existing DRAFT is edited
-- ---------------------------------------------------------------------------
create or replace function public.update_student_achievement(
  target_achievement_id uuid,
  target_achievement_type public.achievement_type,
  target_title text,
  target_description text,
  target_achievement_date date,
  target_program_id uuid,
  target_tournament_id uuid,
  target_placement integer,
  target_external_organization text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_row record;
  v_title text;
  v_external_org text;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, student_id, status into v_row
  from public.student_achievements
  where id = target_achievement_id;

  if v_row.id is null then
    raise exception 'ACHIEVEMENT_NOT_FOUND';
  end if;

  if v_row.status <> 'DRAFT' then
    raise exception 'ACHIEVEMENT_NOT_EDITABLE';
  end if;

  v_title := trim(target_title);
  if v_title is null or char_length(v_title) = 0 or char_length(v_title) > 200 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_description is not null and char_length(target_description) > 3000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  v_external_org := nullif(trim(coalesce(target_external_organization, '')), '');
  if v_external_org is not null and char_length(v_external_org) > 300 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_achievement_type in ('TOURNAMENT_WINNER', 'TOURNAMENT_RUNNER_UP', 'TOURNAMENT_PLACEMENT') and target_tournament_id is null then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;
  if target_tournament_id is not null and not exists (select 1 from public.tournaments where id = target_tournament_id) then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_program_id is not null and not exists (select 1 from public.programs where id = target_program_id) then
    raise exception 'VALIDATION_ERROR';
  end if;

  if target_achievement_type = 'TOURNAMENT_WINNER' and target_placement is distinct from 1 then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;
  if target_achievement_type = 'TOURNAMENT_RUNNER_UP' and target_placement is distinct from 2 then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;
  if target_achievement_type = 'TOURNAMENT_PLACEMENT' and (target_placement is null or target_placement < 1) then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;
  if target_achievement_type not in ('TOURNAMENT_WINNER', 'TOURNAMENT_RUNNER_UP', 'TOURNAMENT_PLACEMENT') and target_placement is not null then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;

  update public.student_achievements
  set
    achievement_type = target_achievement_type,
    title = v_title,
    description = nullif(trim(coalesce(target_description, '')), ''),
    achievement_date = target_achievement_date,
    program_id = target_program_id,
    tournament_id = target_tournament_id,
    placement = target_placement,
    external_organization = v_external_org,
    updated_at = now()
  where id = target_achievement_id
    and status = 'DRAFT';

  return true;
end;
$$;

comment on function public.update_student_achievement(uuid, public.achievement_type, text, text, date, uuid, uuid, integer, text) is
  'The only path that edits an existing DRAFT achievement. ADMIN only, DRAFT only. Never changes student_id/status/created_by/published_at/published_by. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Update Achievement RPC".';

revoke all on function public.update_student_achievement(uuid, public.achievement_type, text, text, date, uuid, uuid, integer, text) from public;
grant execute on function public.update_student_achievement(uuid, public.achievement_type, text, text, date, uuid, uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- publish_student_achievement — the ONLY path DRAFT -> PUBLISHED
-- ---------------------------------------------------------------------------
-- Never automatically creates a certificate — publishing an achievement
-- and issuing a certificate remain two entirely separate, explicit ADMIN
-- actions.
create or replace function public.publish_student_achievement(target_achievement_id uuid)
returns public.achievement_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_row record;
  v_updated_status public.achievement_status;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, status, title, achievement_type, tournament_id
  into v_row
  from public.student_achievements
  where id = target_achievement_id;

  if v_row.id is null then
    raise exception 'ACHIEVEMENT_NOT_FOUND';
  end if;

  if v_row.status <> 'DRAFT' then
    raise exception 'INVALID_TRANSITION';
  end if;

  if v_row.title is null or char_length(trim(v_row.title)) = 0 then
    raise exception 'VALIDATION_ERROR';
  end if;

  if v_row.achievement_type in ('TOURNAMENT_WINNER', 'TOURNAMENT_RUNNER_UP', 'TOURNAMENT_PLACEMENT') and v_row.tournament_id is null then
    raise exception 'INVALID_ACHIEVEMENT_CONTEXT';
  end if;

  update public.student_achievements
  set
    status = 'PUBLISHED',
    published_at = now(),
    published_by = auth.uid(),
    updated_at = now()
  where id = target_achievement_id
    and status = 'DRAFT'
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.publish_student_achievement(uuid) is
  'The only path DRAFT -> PUBLISHED. ADMIN only. Revalidates context, requires non-empty title, sets published_at/published_by server-side. Never automatically creates a certificate. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Publish Achievement RPC".';

revoke all on function public.publish_student_achievement(uuid) from public;
grant execute on function public.publish_student_achievement(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- archive_student_achievement — the ONLY path DRAFT|PUBLISHED -> ARCHIVED
-- ---------------------------------------------------------------------------
create or replace function public.archive_student_achievement(target_achievement_id uuid)
returns public.achievement_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_row record;
  v_updated_status public.achievement_status;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, status into v_row
  from public.student_achievements
  where id = target_achievement_id;

  if v_row.id is null then
    raise exception 'ACHIEVEMENT_NOT_FOUND';
  end if;

  if v_row.status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.student_achievements
  set status = 'ARCHIVED', updated_at = now()
  where id = target_achievement_id
    and status in ('DRAFT', 'PUBLISHED')
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return v_updated_status;
end;
$$;

comment on function public.archive_student_achievement(uuid) is
  'The only path DRAFT|PUBLISHED -> ARCHIVED. ADMIN only. Never allows ARCHIVED -> anything. Preserves the record and any certificate reference. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Archive Achievement RPC".';

revoke all on function public.archive_student_achievement(uuid) from public;
grant execute on function public.archive_student_achievement(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_certificates / get_admin_certificate — Admin read RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_certificates()
returns table (
  certificate_id uuid,
  certificate_number text,
  student_id uuid,
  student_name text,
  student_code text,
  certificate_type public.certificate_type,
  title text,
  program_name text,
  tournament_name text,
  status public.certificate_status,
  issued_on date,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id, c.certificate_number,
    c.student_id, s.full_name, s.student_code,
    c.certificate_type, c.title,
    p.name, t.name,
    c.status, c.issued_on, c.created_at
  from public.student_certificates c
  join public.students s on s.id = c.student_id
  left join public.programs p on p.id = c.program_id
  left join public.tournaments t on t.id = c.tournament_id
  where public.current_admin_profile_id() is not null
  order by c.created_at desc;
$$;

comment on function public.get_admin_certificates() is
  'Admin-wide certificate list. Never exposes created_by/issued_by/revoked_by or student contact PII. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Certificate List".';

revoke all on function public.get_admin_certificates() from public;
grant execute on function public.get_admin_certificates() to authenticated;

create or replace function public.get_admin_certificate(target_certificate_id uuid)
returns table (
  certificate_id uuid,
  certificate_number text,
  student_id uuid,
  student_name text,
  student_code text,
  certificate_type public.certificate_type,
  title text,
  description text,
  program_id uuid,
  program_name text,
  tournament_id uuid,
  tournament_name text,
  achievement_id uuid,
  achievement_title text,
  status public.certificate_status,
  issued_on date,
  created_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id, c.certificate_number,
    c.student_id, s.full_name, s.student_code,
    c.certificate_type, c.title, c.description,
    c.program_id, p.name,
    c.tournament_id, t.name,
    c.achievement_id, a.title,
    c.status, c.issued_on, c.created_at, c.revoked_at, c.revocation_reason
  from public.student_certificates c
  join public.students s on s.id = c.student_id
  left join public.programs p on p.id = c.program_id
  left join public.tournaments t on t.id = c.tournament_id
  left join public.student_achievements a on a.id = c.achievement_id
  where c.id = target_certificate_id
    and public.current_admin_profile_id() is not null;
$$;

comment on function public.get_admin_certificate(uuid) is
  'Single certificate detail for /admin/certificates/[certificateId]. Never exposes created_by/issued_by/revoked_by UUIDs or student contact PII. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Certificate Detail".';

revoke all on function public.get_admin_certificate(uuid) from public;
grant execute on function public.get_admin_certificate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_achievements / get_admin_achievement — Admin read RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_achievements()
returns table (
  achievement_id uuid,
  student_id uuid,
  student_name text,
  student_code text,
  achievement_type public.achievement_type,
  title text,
  achievement_date date,
  tournament_name text,
  placement integer,
  status public.achievement_status,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ach.id,
    ach.student_id, s.full_name, s.student_code,
    ach.achievement_type, ach.title, ach.achievement_date,
    t.name, ach.placement, ach.status, ach.created_at
  from public.student_achievements ach
  join public.students s on s.id = ach.student_id
  left join public.tournaments t on t.id = ach.tournament_id
  where public.current_admin_profile_id() is not null
  order by ach.created_at desc;
$$;

comment on function public.get_admin_achievements() is
  'Admin-wide achievement list. Never exposes created_by/published_by or student contact PII. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Achievement List".';

revoke all on function public.get_admin_achievements() from public;
grant execute on function public.get_admin_achievements() to authenticated;

create or replace function public.get_admin_achievement(target_achievement_id uuid)
returns table (
  achievement_id uuid,
  student_id uuid,
  student_name text,
  student_code text,
  achievement_type public.achievement_type,
  title text,
  description text,
  achievement_date date,
  program_id uuid,
  program_name text,
  tournament_id uuid,
  tournament_name text,
  placement integer,
  external_organization text,
  status public.achievement_status,
  published_at timestamptz,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ach.id,
    ach.student_id, s.full_name, s.student_code,
    ach.achievement_type, ach.title, ach.description, ach.achievement_date,
    ach.program_id, p.name,
    ach.tournament_id, t.name,
    ach.placement, ach.external_organization,
    ach.status, ach.published_at, ach.created_at
  from public.student_achievements ach
  join public.students s on s.id = ach.student_id
  left join public.programs p on p.id = ach.program_id
  left join public.tournaments t on t.id = ach.tournament_id
  where ach.id = target_achievement_id
    and public.current_admin_profile_id() is not null;
$$;

comment on function public.get_admin_achievement(uuid) is
  'Single achievement detail for /admin/achievements/[achievementId]. Never exposes created_by/published_by UUIDs or student contact PII. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Achievement Detail".';

revoke all on function public.get_admin_achievement(uuid) from public;
grant execute on function public.get_admin_achievement(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_student_certificates / get_student_certificate — Student read RPCs
-- ---------------------------------------------------------------------------
-- Zero/single-argument, always scoped to current_student_id() internally
-- — no studentId parameter exists anywhere. DRAFT never appears (status
-- filtered to ISSUED/REVOKED only).
create or replace function public.get_student_certificates()
returns table (
  certificate_id uuid,
  certificate_number text,
  certificate_type public.certificate_type,
  title text,
  program_name text,
  tournament_name text,
  issued_on date,
  status public.certificate_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id, c.certificate_number, c.certificate_type, c.title,
    p.name, t.name, c.issued_on, c.status
  from public.student_certificates c
  left join public.programs p on p.id = c.program_id
  left join public.tournaments t on t.id = c.tournament_id
  where c.student_id = public.current_student_id()
    and public.current_student_id() is not null
    and c.status in ('ISSUED', 'REVOKED')
  order by c.issued_on desc nulls last, c.created_at desc;
$$;

comment on function public.get_student_certificates() is
  'Narrow, self-scoped certificate list for the current student only (no studentId parameter). DRAFT never appears. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Certificate Privacy".';

revoke all on function public.get_student_certificates() from public;
grant execute on function public.get_student_certificates() to authenticated;

create or replace function public.get_student_certificate(target_certificate_id uuid)
returns table (
  certificate_id uuid,
  certificate_number text,
  certificate_type public.certificate_type,
  title text,
  description text,
  program_name text,
  tournament_name text,
  achievement_id uuid,
  achievement_title text,
  issued_on date,
  status public.certificate_status,
  revocation_reason text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id, c.certificate_number, c.certificate_type, c.title, c.description,
    p.name, t.name,
    c.achievement_id, a.title,
    c.issued_on, c.status, c.revocation_reason
  from public.student_certificates c
  left join public.programs p on p.id = c.program_id
  left join public.tournaments t on t.id = c.tournament_id
  left join public.student_achievements a on a.id = c.achievement_id
  where c.id = target_certificate_id
    and c.student_id = public.current_student_id()
    and public.current_student_id() is not null
    and c.status in ('ISSUED', 'REVOKED');
$$;

comment on function public.get_student_certificate(uuid) is
  'Single certificate detail + the current students own row only. "Knowing certificateId is not enough." Never exposes revoked_by. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Certificate Detail".';

revoke all on function public.get_student_certificate(uuid) from public;
grant execute on function public.get_student_certificate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_student_achievements / get_student_achievement — Student read RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_student_achievements()
returns table (
  achievement_id uuid,
  achievement_type public.achievement_type,
  title text,
  achievement_date date,
  program_name text,
  tournament_name text,
  placement integer,
  external_organization text,
  status public.achievement_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ach.id, ach.achievement_type, ach.title, ach.achievement_date,
    p.name, t.name, ach.placement, ach.external_organization, ach.status
  from public.student_achievements ach
  left join public.programs p on p.id = ach.program_id
  left join public.tournaments t on t.id = ach.tournament_id
  where ach.student_id = public.current_student_id()
    and public.current_student_id() is not null
    and ach.status in ('PUBLISHED', 'ARCHIVED')
  order by ach.achievement_date desc nulls last, ach.created_at desc;
$$;

comment on function public.get_student_achievements() is
  'Narrow, self-scoped achievement list for the current student only. DRAFT never appears. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Achievement Privacy".';

revoke all on function public.get_student_achievements() from public;
grant execute on function public.get_student_achievements() to authenticated;

create or replace function public.get_student_achievement(target_achievement_id uuid)
returns table (
  achievement_id uuid,
  achievement_type public.achievement_type,
  title text,
  description text,
  achievement_date date,
  program_name text,
  tournament_name text,
  placement integer,
  external_organization text,
  status public.achievement_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ach.id, ach.achievement_type, ach.title, ach.description, ach.achievement_date,
    p.name, t.name, ach.placement, ach.external_organization, ach.status
  from public.student_achievements ach
  left join public.programs p on p.id = ach.program_id
  left join public.tournaments t on t.id = ach.tournament_id
  where ach.id = target_achievement_id
    and ach.student_id = public.current_student_id()
    and public.current_student_id() is not null
    and ach.status in ('PUBLISHED', 'ARCHIVED');
$$;

comment on function public.get_student_achievement(uuid) is
  'Single achievement detail + the current students own row only. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Achievement Detail".';

revoke all on function public.get_student_achievement(uuid) from public;
grant execute on function public.get_student_achievement(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_parent_student_certificates / get_parent_student_certificate
-- ---------------------------------------------------------------------------
-- Both take target_student_id explicitly but authorization is enforced
-- INSIDE via parent_has_student() — an unauthorized target_student_id
-- yields zero rows, identical to an authorized student with no visible
-- certificates yet. Read-only: no parent mutation RPC exists anywhere.
create or replace function public.get_parent_student_certificates(target_student_id uuid)
returns table (
  certificate_id uuid,
  certificate_number text,
  certificate_type public.certificate_type,
  title text,
  program_name text,
  tournament_name text,
  issued_on date,
  status public.certificate_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id, c.certificate_number, c.certificate_type, c.title,
    p.name, t.name, c.issued_on, c.status
  from public.student_certificates c
  left join public.programs p on p.id = c.program_id
  left join public.tournaments t on t.id = c.tournament_id
  where public.parent_has_student(target_student_id)
    and c.student_id = target_student_id
    and c.status in ('ISSUED', 'REVOKED')
  order by c.issued_on desc nulls last, c.created_at desc;
$$;

comment on function public.get_parent_student_certificates(uuid) is
  'Relationship-scoped certificate list for one linked student. Authorization enforced inside via parent_has_student(). See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent Certificate Privacy".';

revoke all on function public.get_parent_student_certificates(uuid) from public;
grant execute on function public.get_parent_student_certificates(uuid) to authenticated;

create or replace function public.get_parent_student_certificate(
  target_student_id uuid,
  target_certificate_id uuid
)
returns table (
  certificate_id uuid,
  certificate_number text,
  certificate_type public.certificate_type,
  title text,
  description text,
  program_name text,
  tournament_name text,
  achievement_id uuid,
  achievement_title text,
  issued_on date,
  status public.certificate_status,
  revocation_reason text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id, c.certificate_number, c.certificate_type, c.title, c.description,
    p.name, t.name,
    c.achievement_id, a.title,
    c.issued_on, c.status, c.revocation_reason
  from public.student_certificates c
  left join public.programs p on p.id = c.program_id
  left join public.tournaments t on t.id = c.tournament_id
  left join public.student_achievements a on a.id = c.achievement_id
  where c.id = target_certificate_id
    and c.student_id = target_student_id
    and public.parent_has_student(target_student_id)
    and c.status in ('ISSUED', 'REVOKED');
$$;

comment on function public.get_parent_student_certificate(uuid, uuid) is
  'Relationship-scoped single certificate detail. Authorization enforced inside via parent_has_student(). Read-only. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent Certificate Privacy".';

revoke all on function public.get_parent_student_certificate(uuid, uuid) from public;
grant execute on function public.get_parent_student_certificate(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_parent_student_achievements / get_parent_student_achievement
-- ---------------------------------------------------------------------------
create or replace function public.get_parent_student_achievements(target_student_id uuid)
returns table (
  achievement_id uuid,
  achievement_type public.achievement_type,
  title text,
  achievement_date date,
  program_name text,
  tournament_name text,
  placement integer,
  external_organization text,
  status public.achievement_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ach.id, ach.achievement_type, ach.title, ach.achievement_date,
    p.name, t.name, ach.placement, ach.external_organization, ach.status
  from public.student_achievements ach
  left join public.programs p on p.id = ach.program_id
  left join public.tournaments t on t.id = ach.tournament_id
  where public.parent_has_student(target_student_id)
    and ach.student_id = target_student_id
    and ach.status in ('PUBLISHED', 'ARCHIVED')
  order by ach.achievement_date desc nulls last, ach.created_at desc;
$$;

comment on function public.get_parent_student_achievements(uuid) is
  'Relationship-scoped achievement list for one linked student. Authorization enforced inside via parent_has_student(). See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent Achievement Privacy".';

revoke all on function public.get_parent_student_achievements(uuid) from public;
grant execute on function public.get_parent_student_achievements(uuid) to authenticated;

create or replace function public.get_parent_student_achievement(
  target_student_id uuid,
  target_achievement_id uuid
)
returns table (
  achievement_id uuid,
  achievement_type public.achievement_type,
  title text,
  description text,
  achievement_date date,
  program_name text,
  tournament_name text,
  placement integer,
  external_organization text,
  status public.achievement_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ach.id, ach.achievement_type, ach.title, ach.description, ach.achievement_date,
    p.name, t.name, ach.placement, ach.external_organization, ach.status
  from public.student_achievements ach
  left join public.programs p on p.id = ach.program_id
  left join public.tournaments t on t.id = ach.tournament_id
  where ach.id = target_achievement_id
    and ach.student_id = target_student_id
    and public.parent_has_student(target_student_id)
    and ach.status in ('PUBLISHED', 'ARCHIVED');
$$;

comment on function public.get_parent_student_achievement(uuid, uuid) is
  'Relationship-scoped single achievement detail. Authorization enforced inside via parent_has_student(). Read-only — no parent submit/edit/publish/archive RPC exists. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent Achievement Privacy".';

revoke all on function public.get_parent_student_achievement(uuid, uuid) from public;
grant execute on function public.get_parent_student_achievement(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No Coach RLS policy or RPC exists on either table — Coach has no
-- access, not even read, in Phase 17 (see "Coach Certificate/Achievement
-- Access Decision"). No admin UI, certificate, payment, messaging,
-- notification, AI-generation, file-upload, PDF/QR/public-verification,
-- or tournament-result-import table, column, policy, or function is
-- added anywhere in Phase 17. No certificate or achievement deletion
-- exists — no DELETE policy, no delete RPC, on either table.
