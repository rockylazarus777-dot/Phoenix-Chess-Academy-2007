-- =============================================================================
-- 0027_certificate_documents.sql
-- =============================================================================
-- Phase 18 — Certificate PDF Generation + Private R2 Storage + Secure
-- Download: schema only (enum, table, constraints, indexes). RLS
-- policies and RPC functions are deliberately split into
-- 0028_certificate_documents_rls.sql — the same two-file pattern used
-- in every prior phase since Phase 14. Does not edit 0025, 0026, or any
-- earlier migration.
--
-- CORE DOCUMENT ARCHITECTURE (mandatory — do not blur this): a
-- CERTIFICATE RECORD (student_certificates, Phase 17) is the official
-- business record; a CERTIFICATE DOCUMENT (certificate_documents, this
-- phase) is one generated PDF file for that record. A certificate may
-- be regenerated — every generation creates a NEW certificate_documents
-- row (a new version), never an in-place mutation of a previous one. No
-- pdf_url/file_url/r2_url/download_url column is ever added to
-- student_certificates — see docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md,
-- "Certificate Record vs Document Distinction".

-- ---------------------------------------------------------------------------
-- ENUM
-- ---------------------------------------------------------------------------
-- Document lifecycle only — a SEPARATE domain from certificate_status
-- (DRAFT/ISSUED/REVOKED, Phase 17). Deliberately excludes ACTIVE/
-- PUBLISHED/ISSUED/REVOKED/DOWNLOADED — those are either certificate-
-- record concepts or do not exist as a concern of this phase (no
-- download-count tracking exists — see "Download Audit Decision").
create type public.certificate_document_status as enum ('GENERATING', 'AVAILABLE', 'FAILED', 'SUPERSEDED');

-- ---------------------------------------------------------------------------
-- CERTIFICATE_DOCUMENTS
-- ---------------------------------------------------------------------------
-- generated_by is the authenticated ADMIN/SUPER_ADMIN profile
-- (public.profiles.id) that finalized generation — server/RPC-derived
-- only, never accepted from browser input. version is server-derived
-- (max(version)+1 for the certificate, computed inside
-- begin_certificate_document_generation) — never accepted as a
-- parameter from the caller. storage_key is server-derived (see "R2
-- Storage Key Architecture") — never accepted from the caller.
--
-- INTENTIONALLY ABSENT: no public URL, signed URL, presigned URL,
-- download URL, R2 account secret, R2 API token, AWS secret key, PDF
-- binary, certificate HTML, or QR code column exists anywhere on this
-- table. storage_bucket stores a LOGICAL identifier
-- ("CERTIFICATES_PRIVATE"), not the physical R2 bucket name — see
-- "Logical Bucket Identifier Decision" in
-- docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md. The physical bucket name
-- lives only in server environment configuration
-- (CLOUDFLARE_R2_CERTIFICATES_BUCKET).
create table public.certificate_documents (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.student_certificates (id),
  version integer not null,
  status public.certificate_document_status not null default 'GENERATING',
  storage_provider text not null,
  storage_bucket text not null,
  storage_key text,
  mime_type text,
  file_size_bytes bigint,
  sha256_checksum text,
  generated_at timestamptz,
  generated_by uuid references public.profiles (id),
  generation_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificate_documents_version_positive_check check (version >= 1),
  constraint certificate_documents_unique_version unique (certificate_id, version),
  constraint certificate_documents_storage_provider_check check (storage_provider = 'CLOUDFLARE_R2'),
  constraint certificate_documents_file_size_check check (file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 10485760)),
  constraint certificate_documents_checksum_format_check check (sha256_checksum is null or sha256_checksum ~ '^[0-9a-f]{64}$'),
  constraint certificate_documents_mime_type_check check (mime_type is null or mime_type = 'application/pdf'),
  -- AVAILABILITY CONSISTENCY: an AVAILABLE document must have every
  -- storage/integrity field populated; GENERATING/FAILED/SUPERSEDED do
  -- not require them (SUPERSEDED retains whatever it had while
  -- AVAILABLE, since it is never re-nulled on transition — see
  -- "Previous AVAILABLE Supersede Rule").
  constraint certificate_documents_available_consistency_check check (
    status <> 'AVAILABLE'
    or (
      storage_key is not null and char_length(trim(storage_key)) > 0
      and mime_type = 'application/pdf'
      and file_size_bytes is not null
      and sha256_checksum is not null
      and generated_at is not null
      and generated_by is not null
    )
  ),
  -- FAILED documents must carry a safe internal error code.
  constraint certificate_documents_failed_consistency_check check (
    status <> 'FAILED' or generation_error_code is not null
  ),
  constraint certificate_documents_error_code_check check (
    generation_error_code is null or generation_error_code in (
      'CERTIFICATE_CONTEXT_INVALID',
      'CERTIFICATE_CONTENT_TOO_LONG',
      'PDF_GENERATION_FAILED',
      'PDF_TOO_LARGE',
      'R2_UPLOAD_FAILED',
      'DOCUMENT_FINALIZATION_FAILED'
    )
  )
);

comment on table public.certificate_documents is
  'One generated certificate PDF file (one version) for a student_certificates row. Structurally separate from student_certificates — the certificate business record never stores a pdf_url/file_url/r2_url/download_url. A certificate may be regenerated; every generation is a new row (new version), never an in-place overwrite. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md.';
comment on column public.certificate_documents.version is
  'Server-derived only (max(version)+1 for this certificate_id, computed inside begin_certificate_document_generation). Never accepted as a parameter from the browser.';
comment on column public.certificate_documents.storage_bucket is
  'A LOGICAL bucket identifier ("CERTIFICATES_PRIVATE"), not the physical R2 bucket name. The physical bucket lives only in server environment configuration. See "Logical Bucket Identifier Decision".';
comment on column public.certificate_documents.storage_key is
  'Server-derived R2 object key (certificates/<certificate-id>/v<version>/<certificate-number>.pdf). Never accepted from the browser. Never a public/signed/presigned URL.';
comment on column public.certificate_documents.sha256_checksum is
  'Lowercase 64-character hex SHA-256 of the final PDF bytes, for integrity/audit only. Not a public verification mechanism — no verification route reads this column.';
comment on column public.certificate_documents.generated_by is
  'The authenticated ADMIN/SUPER_ADMIN profile (public.profiles.id) that finalized this generation. Server/RPC-derived only — never accepted from browser input.';
comment on column public.certificate_documents.generation_error_code is
  'A closed set of safe internal codes (see constraint). Never a raw AWS/R2/Postgres exception message, stack trace, or SQL error. Student/Parent never see this value even indirectly.';

-- ONE GENERATING DOCUMENT CONSTRAINT: at most one GENERATING row may
-- exist per certificate at any time — this is the authoritative,
-- database-level guard against double-click / concurrent generation,
-- not just a disabled UI button. begin_certificate_document_generation
-- (0028) catches the resulting unique_violation and raises
-- GENERATION_IN_PROGRESS.
create unique index certificate_documents_one_generating_idx
  on public.certificate_documents (certificate_id)
  where status = 'GENERATING';

create index certificate_documents_certificate_idx on public.certificate_documents (certificate_id);
create index certificate_documents_status_idx on public.certificate_documents (status);

create trigger set_certificate_documents_updated_at
  before update on public.certificate_documents
  for each row
  execute function public.set_updated_at();

alter table public.certificate_documents enable row level security;

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No RLS policy or RPC function is created in this migration — see
-- 0028_certificate_documents_rls.sql. No public certificate
-- verification, QR code, public certificate search/lookup/API,
-- certificate sharing link, email/WhatsApp delivery, generic/student/
-- coach file upload, download-count/IP/user-agent tracking table or
-- column, payment/messaging/notification, or AI-generated content is
-- added anywhere in Phase 18. No certificate_documents DELETE policy or
-- RPC exists.
