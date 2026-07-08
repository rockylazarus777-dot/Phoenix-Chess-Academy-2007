-- =============================================================================
-- 0028_certificate_documents_rls.sql
-- =============================================================================
-- Phase 18 — RLS policy and RPC functions for certificate_documents
-- (schema created in 0027_certificate_documents.sql). Does not edit
-- 0025, 0026, 0027, or any earlier migration.
--
-- Reuses current_admin_profile_id() (0026), current_student_id()
-- (0016), parent_has_student() (0017) as-is — no redefinition. Follows
-- the same architecture decision as 0026: every RPC below resolves
-- auth.uid() and independently verifies role/ownership itself
-- (SECURITY DEFINER + REVOKE ALL FROM PUBLIC + GRANT EXECUTE TO
-- authenticated), rather than relying on the service-role client. This
-- keeps certificate document mutation entirely inside RLS-visible,
-- auth.uid()-scoped functions, consistent with student_certificates/
-- student_achievements. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md,
-- "RPC Security".

-- ---------------------------------------------------------------------------
-- RLS — ADMIN backstop SELECT only, no mutation policy, no Student/
-- Parent/Coach policy of any kind
-- ---------------------------------------------------------------------------
-- certificate_documents is private infrastructure metadata (storage key/
-- checksum/bucket). The primary read path for every role is the narrow
-- RPCs below (availability booleans / resolve_certificate_download),
-- never a direct table SELECT. No Student/Parent/Coach policy exists —
-- they can never see a storage_key or checksum by any path.
create policy "certificate_documents_select_for_admin"
  on public.certificate_documents
  for select
  to authenticated
  using (public.current_admin_profile_id() is not null);

-- ---------------------------------------------------------------------------
-- begin_certificate_document_generation — the ONLY way a new document
-- generation is started
-- ---------------------------------------------------------------------------
-- DRAFT CERTIFICATE GENERATION RULE / REVOKED CERTIFICATE GENERATION
-- RULE: only an ISSUED certificate (with certificate_number and
-- issued_on already set) may generate a document — enforced here, not
-- just in the UI. Version is server-derived (max(version)+1). The
-- partial unique index certificate_documents_one_generating_idx (0027)
-- is the authoritative concurrency guard: a second concurrent call for
-- the same certificate hits unique_violation and is mapped to
-- GENERATION_IN_PROGRESS, never creating two simultaneous generation
-- jobs. See "One Generating Document Constraint" /
-- "Generation Double-Click Protection".
create or replace function public.begin_certificate_document_generation(target_certificate_id uuid)
returns table (
  document_id uuid,
  certificate_id uuid,
  version integer,
  certificate_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_cert record;
  v_next_version integer;
  v_document_id uuid;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, status, certificate_number, issued_on
  into v_cert
  from public.student_certificates
  where id = target_certificate_id;

  if v_cert.id is null then
    raise exception 'CERTIFICATE_NOT_FOUND';
  end if;

  if v_cert.status <> 'ISSUED' or v_cert.certificate_number is null or v_cert.issued_on is null then
    raise exception 'CERTIFICATE_NOT_ISSUED';
  end if;

  select coalesce(max(d.version), 0) + 1 into v_next_version
  from public.certificate_documents d
  where d.certificate_id = target_certificate_id;

  begin
    insert into public.certificate_documents (
      certificate_id, version, status, storage_provider, storage_bucket
    )
    values (
      target_certificate_id, v_next_version, 'GENERATING', 'CLOUDFLARE_R2', 'CERTIFICATES_PRIVATE'
    )
    returning id into v_document_id;
  exception when unique_violation then
    raise exception 'GENERATION_IN_PROGRESS';
  end;

  return query
  select v_document_id, target_certificate_id, v_next_version, v_cert.certificate_number;
end;
$$;

comment on function public.begin_certificate_document_generation(uuid) is
  'The only path that starts certificate document generation. ADMIN only. Requires certificate.status = ISSUED with certificate_number/issued_on already set. Version is server-derived. Concurrent calls for the same certificate are rejected with GENERATION_IN_PROGRESS via the partial unique index. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Begin Generation RPC".';

revoke all on function public.begin_certificate_document_generation(uuid) from public;
grant execute on function public.begin_certificate_document_generation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_certificate_generation_context — narrow Admin-only PDF generation
-- input
-- ---------------------------------------------------------------------------
-- Returns ONLY the fields the PDF generator is allowed to consume — no
-- student email/phone/WhatsApp/address/DOB, no parent data, no payment
-- data, no profile IDs, no created_by/issued_by/revoked_by. See
-- "Certificate Generation Input Boundary" in
-- docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md.
create or replace function public.get_certificate_generation_context(target_certificate_id uuid)
returns table (
  certificate_id uuid,
  certificate_number text,
  certificate_type public.certificate_type,
  title text,
  description text,
  issued_on date,
  student_name text,
  program_name text,
  tournament_name text,
  achievement_title text,
  status public.certificate_status
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id, c.certificate_number, c.certificate_type, c.title, c.description, c.issued_on,
    s.full_name,
    p.name, t.name, a.title,
    c.status
  from public.student_certificates c
  join public.students s on s.id = c.student_id
  left join public.programs p on p.id = c.program_id
  left join public.tournaments t on t.id = c.tournament_id
  left join public.student_achievements a on a.id = c.achievement_id
  where c.id = target_certificate_id
    and public.current_admin_profile_id() is not null;
$$;

comment on function public.get_certificate_generation_context(uuid) is
  'ADMIN-only narrow PDF generation input. Never returns student contact PII, parent data, payment data, or internal profile UUIDs (created_by/issued_by/revoked_by). See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Generation Context RPC".';

revoke all on function public.get_certificate_generation_context(uuid) from public;
grant execute on function public.get_certificate_generation_context(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- finalize_certificate_document_generation — the ONLY way GENERATING ->
-- AVAILABLE
-- ---------------------------------------------------------------------------
-- Validates storage_key/mime_type/file_size_bytes/sha256_checksum, sets
-- generated_at/generated_by server-side, then supersedes any other
-- AVAILABLE document for the same certificate — ONLY after this new
-- document is confirmed AVAILABLE (never supersedes before the new row
-- is safely committed to AVAILABLE, and never supersedes the new
-- document itself). See "Finalize Generation RPC" /
-- "Previous AVAILABLE Supersede Rule".
create or replace function public.finalize_certificate_document_generation(
  target_document_id uuid,
  target_storage_key text,
  target_mime_type text,
  target_file_size_bytes bigint,
  target_sha256_checksum text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_row record;
  v_key text;
  v_checksum text;
  v_updated_status public.certificate_document_status;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select id, certificate_id, status into v_row
  from public.certificate_documents
  where id = target_document_id;

  if v_row.id is null then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;

  if v_row.status <> 'GENERATING' then
    raise exception 'INVALID_TRANSITION';
  end if;

  v_key := trim(coalesce(target_storage_key, ''));
  if char_length(v_key) = 0 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_mime_type is distinct from 'application/pdf' then
    raise exception 'VALIDATION_ERROR';
  end if;
  if target_file_size_bytes is null or target_file_size_bytes <= 0 or target_file_size_bytes > 10485760 then
    raise exception 'PDF_TOO_LARGE';
  end if;
  v_checksum := lower(coalesce(target_sha256_checksum, ''));
  if v_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'VALIDATION_ERROR';
  end if;

  update public.certificate_documents
  set
    status = 'AVAILABLE',
    storage_key = v_key,
    mime_type = target_mime_type,
    file_size_bytes = target_file_size_bytes,
    sha256_checksum = v_checksum,
    generated_at = now(),
    generated_by = auth.uid(),
    updated_at = now()
  where id = target_document_id
    and status = 'GENERATING'
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.certificate_documents
  set status = 'SUPERSEDED', updated_at = now()
  where certificate_id = v_row.certificate_id
    and status = 'AVAILABLE'
    and id <> target_document_id;

  return true;
end;
$$;

comment on function public.finalize_certificate_document_generation(uuid, text, text, bigint, text) is
  'The only path GENERATING -> AVAILABLE. ADMIN only. Validates storage_key/mime_type/file_size_bytes/checksum format, sets generated_at/generated_by server-side, then supersedes prior AVAILABLE documents for the same certificate. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Finalize Generation RPC".';

revoke all on function public.finalize_certificate_document_generation(uuid, text, text, bigint, text) from public;
grant execute on function public.finalize_certificate_document_generation(uuid, text, text, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- fail_certificate_document_generation — the ONLY way GENERATING ->
-- FAILED
-- ---------------------------------------------------------------------------
-- Accepts only a closed set of safe error codes (matches the CHECK
-- constraint on certificate_documents.generation_error_code). Never
-- supersedes any AVAILABLE document — a failed regeneration must never
-- remove access to a previously valid certificate document. See
-- "Fail Generation RPC" / "Failed Regeneration Decision".
create or replace function public.fail_certificate_document_generation(
  target_document_id uuid,
  target_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_row record;
  v_updated_status public.certificate_document_status;
begin
  v_admin_id := public.current_admin_profile_id();
  if v_admin_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if target_error_code not in (
    'CERTIFICATE_CONTEXT_INVALID', 'CERTIFICATE_CONTENT_TOO_LONG', 'PDF_GENERATION_FAILED',
    'PDF_TOO_LARGE', 'R2_UPLOAD_FAILED', 'DOCUMENT_FINALIZATION_FAILED'
  ) then
    raise exception 'VALIDATION_ERROR';
  end if;

  select id, status into v_row
  from public.certificate_documents
  where id = target_document_id;

  if v_row.id is null then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;

  if v_row.status <> 'GENERATING' then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.certificate_documents
  set status = 'FAILED', generation_error_code = target_error_code, updated_at = now()
  where id = target_document_id
    and status = 'GENERATING'
  returning status into v_updated_status;

  if v_updated_status is null then
    raise exception 'INVALID_TRANSITION';
  end if;

  return true;
end;
$$;

comment on function public.fail_certificate_document_generation(uuid, text) is
  'The only path GENERATING -> FAILED. ADMIN only. Accepts only a closed set of safe internal error codes. Never supersedes a previous AVAILABLE document. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Fail Generation RPC".';

revoke all on function public.fail_certificate_document_generation(uuid, text) from public;
grant execute on function public.fail_certificate_document_generation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_certificate_documents — Admin document history
-- ---------------------------------------------------------------------------
-- Never returns storage_key/storage_bucket/sha256_checksum/generated_by
-- UUID — those stay server-only. generation_error_code is returned so
-- the application layer can map it to a single safe sentence
-- ("Certificate document generation failed."); it is still never a raw
-- AWS/R2/Postgres error string. See "Admin Document History".
create or replace function public.get_admin_certificate_documents(target_certificate_id uuid)
returns table (
  document_id uuid,
  version integer,
  status public.certificate_document_status,
  generated_at timestamptz,
  file_size_bytes bigint,
  generation_error_code text
)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.version, d.status, d.generated_at, d.file_size_bytes, d.generation_error_code
  from public.certificate_documents d
  where d.certificate_id = target_certificate_id
    and public.current_admin_profile_id() is not null
  order by d.version desc;
$$;

comment on function public.get_admin_certificate_documents(uuid) is
  'Admin certificate document version history for /admin/certificates/[certificateId]. Never exposes storage_key/storage_bucket/checksum/generated_by. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Admin Document History".';

revoke all on function public.get_admin_certificate_documents(uuid) from public;
grant execute on function public.get_admin_certificate_documents(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_student_certificate_document_availability — Student availability
-- check
-- ---------------------------------------------------------------------------
-- A single boolean, never storage metadata. True only when the caller
-- owns the certificate, the certificate is ISSUED, and a document is
-- AVAILABLE. See "Student Document Availability".
create or replace function public.get_student_certificate_document_availability(target_certificate_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.student_certificates c
    join public.certificate_documents d on d.certificate_id = c.id
    where c.id = target_certificate_id
      and public.current_student_id() is not null
      and c.student_id = public.current_student_id()
      and c.status = 'ISSUED'
      and d.status = 'AVAILABLE'
  );
$$;

comment on function public.get_student_certificate_document_availability(uuid) is
  'True only if the current student owns an ISSUED certificate with an AVAILABLE document. Returns a boolean only — never storage metadata. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Student Document Availability".';

revoke all on function public.get_student_certificate_document_availability(uuid) from public;
grant execute on function public.get_student_certificate_document_availability(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_parent_student_certificate_document_availability — Parent
-- availability check
-- ---------------------------------------------------------------------------
create or replace function public.get_parent_student_certificate_document_availability(
  target_student_id uuid,
  target_certificate_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.student_certificates c
    join public.certificate_documents d on d.certificate_id = c.id
    where c.id = target_certificate_id
      and c.student_id = target_student_id
      and public.parent_has_student(target_student_id)
      and c.status = 'ISSUED'
      and d.status = 'AVAILABLE'
  );
$$;

comment on function public.get_parent_student_certificate_document_availability(uuid, uuid) is
  'True only if the current parent is linked to the target student AND that student owns an ISSUED certificate with an AVAILABLE document. Authorization enforced inside via parent_has_student(). See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Parent Document Availability".';

revoke all on function public.get_parent_student_certificate_document_availability(uuid, uuid) from public;
grant execute on function public.get_parent_student_certificate_document_availability(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- resolve_certificate_download — the ONLY source of truth for the
-- download route
-- ---------------------------------------------------------------------------
-- SERVER-ONLY in application usage — called exclusively from
-- /api/certificates/[certificateId]/download (a Route Handler), never
-- from a Client Component, never serialized into browser HTML. Requires
-- certificate.status = ISSUED (REVOKED is blocked even if an AVAILABLE
-- document still exists in R2 — "Revoked Certificate Download Rule").
-- Authorizes ADMIN/SUPER_ADMIN, the owning Student, or a linked Parent;
-- rejects Coach and any other caller by construction (none of the three
-- OR branches can be satisfied). Returns zero rows for every
-- unauthorized/not-found/not-available case — the calling route
-- collapses all of those into one generic "unavailable" response, never
-- revealing which specific reason applied (see "Download Resource
-- Existence Privacy").
create or replace function public.resolve_certificate_download(target_certificate_id uuid)
returns table (
  certificate_id uuid,
  certificate_number text,
  storage_key text,
  mime_type text,
  file_size_bytes bigint,
  document_id uuid
)
language sql
security definer
stable
set search_path = public
as $$
  select c.id, c.certificate_number, d.storage_key, d.mime_type, d.file_size_bytes, d.id
  from public.student_certificates c
  join public.certificate_documents d on d.certificate_id = c.id
  where c.id = target_certificate_id
    and c.status = 'ISSUED'
    and d.status = 'AVAILABLE'
    and (
      public.current_admin_profile_id() is not null
      or (public.current_student_id() is not null and c.student_id = public.current_student_id())
      or public.parent_has_student(c.student_id)
    )
  order by d.version desc
  limit 1;
$$;

comment on function public.resolve_certificate_download(uuid) is
  'Single authorization+resolution point for certificate download. Requires certificate.status = ISSUED and a document.status = AVAILABLE. Authorizes ADMIN/SUPER_ADMIN, the owning Student, or a linked Parent only — Coach and unauthenticated callers always get zero rows. Server-only usage — never called from a Client Component. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Resolve Certificate Download RPC".';

revoke all on function public.resolve_certificate_download(uuid) from public;
grant execute on function public.resolve_certificate_download(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No Coach RLS policy or RPC exists on certificate_documents — Coach has
-- no access, not even read, in Phase 18 (same decision as Phase 17). No
-- download-count/IP/user-agent tracking table or column. No public
-- verification route, QR code, or public certificate search RPC. No
-- certificate_documents DELETE policy or RPC.
