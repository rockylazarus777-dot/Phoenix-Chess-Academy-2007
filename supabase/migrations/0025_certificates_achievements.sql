-- =============================================================================
-- 0025_certificates_achievements.sql
-- =============================================================================
-- Phase 17 — Certificates + Achievement Records: schema only (enums,
-- tables, constraints, indexes). RLS policies and RPC functions are
-- deliberately split into 0026_certificates_achievements_rls.sql — the
-- same two-file pattern used in every prior phase since Phase 14
-- (0019/0020, 0021/0022, 0023/0024). Does not edit 0024 or any earlier
-- migration.
--
-- PHASE 17 IS A RECORD ARCHITECTURE PHASE ONLY. No PDF/image/QR/public-
-- verification/file-upload/R2/email/WhatsApp/AI/payment/messaging code or
-- column is added anywhere in this migration or 0026. See
-- docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md.
--
-- CORE DOMAIN DISTINCTION (mandatory — do not blur this):
--   certificate record = an official Phoenix Chess Academy certificate
--                         issued to a student (student_certificates).
--   achievement record  = a verified student accomplishment recorded by
--                         Phoenix Chess Academy (student_achievements).
-- The two are structurally separate tables. student_certificates MAY
-- optionally reference one student_achievements row (achievement_id) but
-- an achievement is never automatically turned into a certificate, and a
-- certificate is never treated as itself an achievement.

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- Certificate lifecycle only. Deliberately excludes ACTIVE/COMPLETED/
-- EXPIRED/DOWNLOADED/VERIFIED/PENDING — none of those are this phase's
-- concern (no file generation, no download tracking, no public
-- verification exists yet).
create type public.certificate_status as enum ('DRAFT', 'ISSUED', 'REVOKED');

-- A closed, curated set — NOT unlimited arbitrary certificate type
-- strings. Deliberately excludes PAYMENT/ATTENDANCE/ASSIGNMENT/PROGRESS
-- certificate types unless a future approved phase explicitly requires
-- them.
create type public.certificate_type as enum (
  'PROGRAM_COMPLETION',
  'PARTICIPATION',
  'TOURNAMENT_PARTICIPATION',
  'TOURNAMENT_ACHIEVEMENT',
  'SPECIAL_RECOGNITION'
);

-- Achievement lifecycle only. Deliberately excludes VERIFIED/APPROVED/
-- ACTIVE/COMPLETED — DRAFT/PUBLISHED/ARCHIVED mirrors the same shape
-- already used by assignments (Phase 16) and progress evaluations
-- (Phase 15) for a coach/admin-authored record with a publish gate.
create type public.achievement_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- A closed, curated set. Deliberately excludes GOOD_STUDENT/
-- BEST_STUDENT/SMART_STUDENT/IMPROVED_STUDENT — subjective, unsafe
-- labels that do not belong in a permanent academy record.
create type public.achievement_type as enum (
  'TOURNAMENT_WINNER',
  'TOURNAMENT_RUNNER_UP',
  'TOURNAMENT_PLACEMENT',
  'CHESS_MILESTONE',
  'ACADEMY_RECOGNITION',
  'EXTERNAL_CHESS_ACHIEVEMENT'
);

-- ---------------------------------------------------------------------------
-- STUDENT_CERTIFICATES
-- ---------------------------------------------------------------------------
-- created_by/issued_by/revoked_by are the authenticated profile
-- (public.profiles.id); none are ever accepted from browser input — all
-- three are server/RPC-derived from auth.uid() at the relevant lifecycle
-- transition (see 0026). certificate_number is nullable at DRAFT and is
-- generated server-side only at issuance (see 0026, issue_student_
-- certificate) — never accepted as a parameter from the caller.
--
-- INTENTIONALLY ABSENT (see "No Certificate File Generation" /
-- "No Public Verification" in docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md):
-- no pdf_url, image_url, qr_code, verification_token, download_count, or
-- certificate_html/generated-file-metadata column exists anywhere on this
-- table. Those belong to a future certificate-generation/media phase.
create table public.student_certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  certificate_type public.certificate_type not null,
  title text not null,
  description text,
  program_id uuid references public.programs (id),
  tournament_id uuid references public.tournaments (id),
  -- FK added at the end of this migration once student_achievements
  -- exists (see "Add the foreign key after both tables exist" in the
  -- spec) — the column itself is declared here so the table's own shape
  -- is complete and self-documenting.
  achievement_id uuid,
  certificate_number text unique,
  status public.certificate_status not null default 'DRAFT',
  issued_on date,
  issued_by uuid references public.profiles (id),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  revocation_reason text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_certificates_title_length_check check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  constraint student_certificates_description_length_check check (description is null or char_length(description) <= 3000),
  constraint student_certificates_revocation_reason_length_check check (revocation_reason is null or char_length(revocation_reason) <= 2000),
  -- CERTIFICATE CONTEXT VALIDATION: PROGRAM_COMPLETION requires
  -- program_id; TOURNAMENT_PARTICIPATION/TOURNAMENT_ACHIEVEMENT require
  -- tournament_id; PARTICIPATION/SPECIAL_RECOGNITION have no required
  -- context field (program_id/tournament_id remain optional for those
  -- two). See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Certificate
  -- Context Validation".
  constraint student_certificates_context_check check (
    (certificate_type = 'PROGRAM_COMPLETION' and program_id is not null)
    or (certificate_type = 'PARTICIPATION')
    or (certificate_type = 'TOURNAMENT_PARTICIPATION' and tournament_id is not null)
    or (certificate_type = 'TOURNAMENT_ACHIEVEMENT' and tournament_id is not null)
    or (certificate_type = 'SPECIAL_RECOGNITION')
  ),
  -- CERTIFICATE-ACHIEVEMENT RELATIONSHIP: if achievement_id is supplied,
  -- the certificate type must be one of the two compatible types.
  -- Cross-row ownership (achievement.student_id = certificate.student_id)
  -- cannot be expressed as a single-table CHECK constraint and is instead
  -- enforced inside create_student_certificate()/update_student_
  -- certificate() (see 0026).
  constraint student_certificates_achievement_type_check check (
    achievement_id is null or certificate_type in ('TOURNAMENT_ACHIEVEMENT', 'SPECIAL_RECOGNITION')
  ),
  -- CERTIFICATE ISSUE DATE: never a future date once set. Evaluated at
  -- write time (current_date), same convention as other date-vs-now
  -- checks in this project.
  constraint student_certificates_issued_on_not_future_check check (issued_on is null or issued_on <= current_date),
  -- CERTIFICATE LIFECYCLE CONSISTENCY: certificate_number/issued_on/
  -- issued_by are only ever set together, and only from ISSUED or REVOKED
  -- (a REVOKED certificate keeps its issuance data permanently — "Do not
  -- remove certificate_number. Do not remove issued_on."). A DRAFT
  -- certificate has none of the three.
  constraint student_certificates_issuance_consistency_check check (
    (status = 'DRAFT' and certificate_number is null and issued_on is null and issued_by is null)
    or (status in ('ISSUED', 'REVOKED') and certificate_number is not null and issued_on is not null and issued_by is not null)
  ),
  -- REVOCATION CONSISTENCY: revoked_at/revoked_by/revocation_reason are
  -- set together only when status = REVOKED; a DRAFT or ISSUED row always
  -- has all three null.
  constraint student_certificates_revocation_consistency_check check (
    (status <> 'REVOKED' and revoked_at is null and revoked_by is null and revocation_reason is null)
    or (status = 'REVOKED' and revoked_at is not null and revoked_by is not null and revocation_reason is not null and char_length(trim(revocation_reason)) > 0)
  )
);

comment on table public.student_certificates is
  'Official Phoenix Chess Academy certificate record. Never stores a PDF/image/QR/verification token/download count/generated file — record architecture only (Phase 17). No certificate is ever auto-issued; every row requires an explicit ADMIN action. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md.';
comment on column public.student_certificates.certificate_number is
  'Stable academy identifier (format PCA-YYYY-XXXXXXXX), generated server-side ONLY at issuance (issue_student_certificate). Null for DRAFT. Never accepted from browser input. An identifier, not a secret — does not grant read access on its own (no public verification route exists in Phase 17).';
comment on column public.student_certificates.achievement_id is
  'Optional reference to student_achievements(id) — only valid for TOURNAMENT_ACHIEVEMENT/SPECIAL_RECOGNITION certificate types. Cross-student ownership is enforced in the write RPCs, not by a DB constraint. Publishing an achievement never auto-creates a certificate.';
comment on column public.student_certificates.created_by is
  'The authenticated profile (public.profiles.id) that created this DRAFT. Server/RPC-derived only — never accepted from browser input.';
comment on column public.student_certificates.issued_by is
  'The authenticated profile (public.profiles.id) that issued this certificate. Server/RPC-derived only — never accepted from browser input.';
comment on column public.student_certificates.revoked_by is
  'The authenticated profile (public.profiles.id) that revoked this certificate. Server/RPC-derived only — never accepted from browser input.';

create index student_certificates_student_idx on public.student_certificates (student_id);
create index student_certificates_status_idx on public.student_certificates (status);
create index student_certificates_program_idx on public.student_certificates (program_id);
create index student_certificates_tournament_idx on public.student_certificates (tournament_id);
create index student_certificates_achievement_idx on public.student_certificates (achievement_id);

create trigger set_student_certificates_updated_at
  before update on public.student_certificates
  for each row
  execute function public.set_updated_at();

alter table public.student_certificates enable row level security;

-- ---------------------------------------------------------------------------
-- STUDENT_ACHIEVEMENTS
-- ---------------------------------------------------------------------------
-- created_by/published_by are the authenticated profile
-- (public.profiles.id); never accepted from browser input. No score,
-- percentage, rating change, FIDE rating, Chess.com rating, Lichess
-- rating, or prize-money column exists anywhere on this table — none of
-- that has authoritative architecture in this phase.
create table public.student_achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  achievement_type public.achievement_type not null,
  title text not null,
  description text,
  achievement_date date,
  program_id uuid references public.programs (id),
  tournament_id uuid references public.tournaments (id),
  placement integer,
  external_organization text,
  status public.achievement_status not null default 'DRAFT',
  published_at timestamptz,
  published_by uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_achievements_title_length_check check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  constraint student_achievements_description_length_check check (description is null or char_length(description) <= 3000),
  constraint student_achievements_external_org_length_check check (external_organization is null or char_length(external_organization) <= 300),
  -- ACHIEVEMENT PLACEMENT VALIDATION: placement is allowed only for the
  -- three placement-shaped achievement types, with an exact/minimum value
  -- per type; every other achievement type requires placement IS NULL.
  constraint student_achievements_placement_check check (
    (achievement_type = 'TOURNAMENT_WINNER' and placement = 1)
    or (achievement_type = 'TOURNAMENT_RUNNER_UP' and placement = 2)
    or (achievement_type = 'TOURNAMENT_PLACEMENT' and placement >= 1)
    or (achievement_type not in ('TOURNAMENT_WINNER', 'TOURNAMENT_RUNNER_UP', 'TOURNAMENT_PLACEMENT') and placement is null)
  ),
  -- TOURNAMENT CONTEXT VALIDATION: the three placement-shaped types
  -- require a real tournament_id. EXTERNAL_CHESS_ACHIEVEMENT and the
  -- other non-tournament types may leave tournament_id null.
  constraint student_achievements_tournament_context_check check (
    achievement_type not in ('TOURNAMENT_WINNER', 'TOURNAMENT_RUNNER_UP', 'TOURNAMENT_PLACEMENT')
    or tournament_id is not null
  ),
  -- PUBLISHED_CONSISTENCY: published_at/published_by are both set
  -- together, only when status = PUBLISHED — same pattern as assignments
  -- (Phase 16) and student_progress_evaluations (Phase 15).
  constraint student_achievements_published_consistency_check check (
    (status = 'PUBLISHED' and published_at is not null and published_by is not null)
    or (status <> 'PUBLISHED' and published_at is null and published_by is null)
  )
);

comment on table public.student_achievements is
  'Verified student accomplishment recorded by Phoenix Chess Academy. Structurally separate from student_certificates — an achievement is never automatically turned into a certificate. No score/percentage/rating-change/FIDE-rating/Chess.com-rating/Lichess-rating/prize-money column exists. No achievement is ever auto-created from tournament results, progress ratings, attendance, assignments, or coach feedback — every row requires an explicit ADMIN action. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md.';
comment on column public.student_achievements.external_organization is
  'Free-text name of an external organizer for EXTERNAL_CHESS_ACHIEVEMENT records only. The application never implies Phoenix organized or endorsed the external event.';
comment on column public.student_achievements.created_by is
  'The authenticated profile (public.profiles.id) that created this DRAFT. Server/RPC-derived only — never accepted from browser input.';
comment on column public.student_achievements.published_by is
  'The authenticated profile (public.profiles.id) that published this achievement. Server/RPC-derived only — never accepted from browser input.';

create index student_achievements_student_idx on public.student_achievements (student_id);
create index student_achievements_status_idx on public.student_achievements (status);
create index student_achievements_tournament_idx on public.student_achievements (tournament_id);
create index student_achievements_program_idx on public.student_achievements (program_id);

create trigger set_student_achievements_updated_at
  before update on public.student_achievements
  for each row
  execute function public.set_updated_at();

alter table public.student_achievements enable row level security;

-- ---------------------------------------------------------------------------
-- CERTIFICATE-ACHIEVEMENT FOREIGN KEY (added now that both tables exist)
-- ---------------------------------------------------------------------------
alter table public.student_certificates
  add constraint student_certificates_achievement_id_fkey
  foreign key (achievement_id) references public.student_achievements (id);

-- ---------------------------------------------------------------------------
-- DEFERRED (documented, not implemented this phase)
-- ---------------------------------------------------------------------------
-- No RLS policy or RPC function is created in this migration — see
-- 0026_certificates_achievements_rls.sql. No PDF/PNG/JPG/SVG/HTML/canvas
-- certificate generation, QR/barcode generation, public certificate
-- verification route/table, Cloudflare R2/file-upload column, email/
-- WhatsApp delivery, AI-generated summary, tournament-result-import,
-- FIDE/Chess.com/Lichess integration, payment/invoice/subscription, or
-- messaging/notification table or column is added anywhere in Phase 17.
-- No certificate or achievement DELETE policy or RPC exists.
