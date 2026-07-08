# Certificates + Achievement Records Architecture (Phase 17)

Phase 17 adds the academy-issued certificate record and verified student
achievement record foundation on top of Admin Operations (Phase 10),
Student Portal (Phase 11), Parent Portal (Phase 12), and every subsequent
phase. This document is the authoritative reference for the domain model,
security architecture, and privacy boundaries introduced in this phase. It
complements, and does not replace, `docs/ADMIN_OPERATIONS_ARCHITECTURE.md`,
`docs/STUDENT_PORTAL_ARCHITECTURE.md`, and
`docs/PARENT_PORTAL_ARCHITECTURE.md`.

Phase 17 is a **record architecture phase only**. It does not build PDF
generation, certificate image generation, Canva integration, Cloudflare R2
uploads, file uploads, QR-code generation, public certificate verification,
email/WhatsApp delivery, automatic certificate issuance, AI achievement
summaries, tournament result imports, FIDE/Chess.com/Lichess integration,
payments, invoices, subscriptions, messaging, or notifications. Those are
explicitly future, unapproved phases.

## Certificate vs Achievement Domain Distinction

A **certificate record** represents an official Phoenix Chess Academy
certificate issued to a student (Program Completion, Participation,
Tournament Participation, Tournament Achievement, Special Recognition). An
**achievement record** represents a verified student accomplishment
recorded by the academy (Tournament Winner, Tournament Runner-Up,
Tournament Placement, Chess Milestone, Academy Recognition, External Chess
Achievement). The two domains are structurally separate tables
(`student_certificates`, `student_achievements`) with separate status
enums, separate type enums, and separate write/read RPCs. Not every
achievement produces a certificate and not every certificate reflects an
achievement — they may optionally reference each other (see
"Certificate-Achievement Relationship" below), but publishing an
achievement never auto-creates a certificate, and issuing a certificate
never requires an achievement.

## Certificate Status Enum + Semantics

`public.certificate_status`: `DRAFT`, `ISSUED`, `REVOKED`.

- **DRAFT** — internal preparation. Invisible to Student and Parent
  Portals; visible only in `/admin/certificates*`.
- **ISSUED** — the official, academy-issued certificate. Visible to the
  certificate's student and every parent linked to that student.
- **REVOKED** — formally revoked. The record is never deleted; Student and
  Parent continue to see it with a clearly labeled REVOKED status and the
  revocation reason.

Deliberately excludes `ACTIVE`/`COMPLETED`/`EXPIRED`/`DOWNLOADED`/
`VERIFIED`/`PENDING` — none of those concepts exist in this phase's
architecture (no download tracking, no expiry, no public verification).

## Certificate Type Enum + Semantics

`public.certificate_type`: `PROGRAM_COMPLETION`, `PARTICIPATION`,
`TOURNAMENT_PARTICIPATION`, `TOURNAMENT_ACHIEVEMENT`,
`SPECIAL_RECOGNITION`. A closed, curated set — never an unlimited
arbitrary string. `PAYMENT`/`ATTENDANCE`/`ASSIGNMENT`/`PROGRESS` types are
deliberately absent; nothing in this phase issues a certificate from those
signals (see "No Automatic Certificate Issuance").

## student_certificates Schema

Mirrors `supabase/migrations/0025_certificates_achievements.sql` exactly:
`id`, `student_id` (not null, references `students`), `certificate_type`
(not null), `title` (not null), `description` (nullable), `program_id`
(nullable, references `programs`), `tournament_id` (nullable, references
`tournaments`), `achievement_id` (nullable, references
`student_achievements`, FK added at the end of the migration file after
both tables exist), `certificate_number` (nullable, unique), `status`
(not null, default `DRAFT`), `issued_on` (nullable date), `issued_by`
(nullable, references `profiles`), `revoked_at` (nullable timestamptz),
`revoked_by` (nullable, references `profiles`), `revocation_reason`
(nullable), `created_by` (not null, references `profiles`), `created_at`/
`updated_at`. Deliberately does **not** store a PDF URL, image URL, QR
code, public verification token, download count, certificate HTML, or any
generated-file metadata — those belong to a future, unapproved
certificate-generation phase.

## Certificate Number Architecture + Generation Decision + Security Semantics

`certificate_number` is `text unique nullable`. A `DRAFT` certificate
always has `certificate_number = null`. The number is generated **only**
inside `issue_student_certificate()`, in the format `PCA-<year>-<8
uppercase hex characters>` (e.g. `PCA-2026-A1B2C3D4`), derived from
`gen_random_uuid()`. Generation uses a genuine catch-and-retry loop around
the actual `UPDATE` statement (up to 10 attempts, catching
`unique_violation`) rather than a race-prone check-then-insert pattern —
this is database-safe under concurrent issuance, not just "check and
hope." If all 10 attempts collide, the RPC raises
`CERTIFICATE_NUMBER_GENERATION_FAILED` and the transaction rolls back
(no partial issuance). The certificate number is a stable, human-readable
**identifier only** — it is never treated as a secret, never grants read
access on its own (all certificate reads still require RLS/RPC-level
`auth.uid()` authorization), and no public lookup-by-number endpoint exists
anywhere in this phase (see "No Public Verification").

## Certificate Text Limits

`title` ≤ 200, `description` ≤ 3000, `revocation_reason` ≤ 2000. Enforced
at three layers: Postgres `CHECK` constraints in migration 0025, Zod
schemas in `src/lib/validation/certificates.ts`, and re-validated inside
every write RPC in migration 0026.

## Certificate Context Validation

`PROGRAM_COMPLETION` requires `program_id`. `TOURNAMENT_PARTICIPATION` and
`TOURNAMENT_ACHIEVEMENT` require `tournament_id`. `PARTICIPATION` and
`SPECIAL_RECOGNITION` have no required context field (both `program_id`
and `tournament_id` remain optional). Enforced via
`student_certificates_context_check` (DB), `withCertificateContextRefinements()`
(Zod), and re-validated inside `create_student_certificate()`/
`update_student_certificate()`. No certificate context is ever
auto-inferred from program completion, tournament date, attendance,
assignment status, or progress evaluation.

## Certificate-Achievement Relationship + Student Ownership Validation

`student_certificates.achievement_id` may optionally reference
`student_achievements(id)` (compatible certificate types: recommended
`TOURNAMENT_ACHIEVEMENT`, `SPECIAL_RECOGNITION`, though not DB-enforced as
a hard rule). If supplied, the certificate's `student_id` must equal the
referenced achievement's `student_id` — a certificate can never reference
another student's achievement. Because a single-table `CHECK` constraint
cannot reference another table's row, this ownership validation is
implemented only inside `create_student_certificate()`/
`update_student_certificate()` (RPC-level, not DB-level) — the same
pattern used for cross-table context validation in Phase 16's assignments.
The admin certificate form additionally never *offers* another student's
achievement as an option: `listAdminAchievementsForStudent()` filters
server-side to the selected student before the option list ever reaches
the browser. Publishing an achievement never auto-creates a certificate.

## Certificate Lifecycle + Draft/Issuance/Revocation Semantics

`DRAFT -> ISSUED -> REVOKED` is the only forward path.
`DRAFT` is an admin working copy, invisible to Student/Parent.
`ISSUED` is the only path from `DRAFT`, atomic, and generates
`certificate_number`/`issued_on`/`issued_by` together. `REVOKED` is the
only path from `ISSUED`, and requires a non-empty `revocation_reason`.
Never allowed: `ISSUED -> DRAFT`, `REVOKED -> ISSUED`, `DRAFT -> REVOKED`,
`REVOKED -> DRAFT`. Every transition RPC conditions its final `UPDATE` on
the expected current status in the `WHERE` clause and raises
`INVALID_TRANSITION` if zero rows update — preventing concurrent
double-transitions.

## Certificate Issue Date Decision

`issued_on` is explicit and admin-selected via `IssueCertificateForm`,
defaulting the date input to today but never silently substituting it
server-side. It is never auto-inferred from program completion date,
tournament date, achievement date, or `created_at`. The server rejects
malformed dates (regex-validated ISO format) and rejects future dates
(`issuedOn <= today` in `issueCertificateSchema`).

## Certificate Delete Decision + Draft Correction Limitation

No certificate delete RPC exists and no Admin `DELETE` policy exists on
`student_certificates`. Issued and revoked certificates are permanent
historical records. If an admin selects the wrong student on a `DRAFT`
certificate, the form deliberately does not allow mutating `student_id` —
the documented correction path is to leave the incorrect draft as-is (it
remains invisible to Student/Parent) and create a new, correct draft.
There is no hidden/undocumented delete workflow.

## Achievement Status Enum + Semantics

`public.achievement_status`: `DRAFT`, `PUBLISHED`, `ARCHIVED`.

- **DRAFT** — internal preparation, invisible to Student/Parent.
- **PUBLISHED** — verified academy achievement, visible to the student and
  linked parents.
- **ARCHIVED** — historical, still visible to Student/Parent (unlike
  certificates, achievements are never "revoked" — there is no negative
  achievement lifecycle state).

Deliberately excludes `VERIFIED`/`APPROVED`/`ACTIVE`/`COMPLETED`.

## Achievement Type Enum + Semantics

`public.achievement_type`: `TOURNAMENT_WINNER`, `TOURNAMENT_RUNNER_UP`,
`TOURNAMENT_PLACEMENT`, `CHESS_MILESTONE`, `ACADEMY_RECOGNITION`,
`EXTERNAL_CHESS_ACHIEVEMENT`. Deliberately excludes
`GOOD_STUDENT`/`BEST_STUDENT`/`SMART_STUDENT`/`IMPROVED_STUDENT` — those
are subjective, unsafe labels that this architecture never introduces.

## student_achievements Schema

Mirrors migration 0025 exactly: `id`, `student_id` (not null),
`achievement_type` (not null), `title` (not null), `description`
(nullable), `achievement_date` (nullable date), `program_id` (nullable),
`tournament_id` (nullable), `placement` (nullable integer),
`external_organization` (nullable), `status` (default `DRAFT`),
`published_at`/`published_by` (nullable), `created_by` (not null),
`created_at`/`updated_at`. Never adds a score, percentage, rating change,
FIDE rating, Chess.com rating, Lichess rating, or prize money column —
none of those have an authoritative source in this project.

## Achievement Text Limits

`title` ≤ 200, `description` ≤ 3000, `external_organization` ≤ 300.
Enforced in DB `CHECK` constraints, Zod, and RPC re-validation.

## Achievement Placement Validation + Tournament Achievement Context

`placement` is allowed only for `TOURNAMENT_WINNER` (must equal 1),
`TOURNAMENT_RUNNER_UP` (must equal 2), and `TOURNAMENT_PLACEMENT` (must be
≥ 1). Every other achievement type requires `placement IS NULL`. The same
three placement types additionally require `tournament_id` (the tournament
must exist; it is never accepted as an arbitrary UUID and never derived
from a tournament-result table — only explicit authorized creation).
Enforced via `student_achievements_placement_check` +
`student_achievements_tournament_context_check` (DB),
`withAchievementContextRefinements()` (Zod), and re-validated inside
`create_student_achievement()`/`update_student_achievement()`.

## External Achievement Semantics

`EXTERNAL_CHESS_ACHIEVEMENT` may have `tournament_id = null` and may use
`external_organization` to name the outside body that recognized the
achievement. Phoenix Chess Academy is never presented as having organized
an external event — the admin form's context hint text makes this
explicit, and no UI copy anywhere implies academy organization of an
external achievement.

## Admin-Only Mutation Decision + Coach Access Decisions

Phase 17 uses the existing ADMIN permission architecture
(`src/lib/auth/permissions.ts`) for every certificate and achievement
mutation. Only `ADMIN`/`SUPER_ADMIN` may create/update/issue/revoke a
certificate or create/update/publish/archive an achievement — `STAFF` is
deliberately excluded (new permissions `VIEW_CERTIFICATES`,
`MANAGE_CERTIFICATES`, `VIEW_ACHIEVEMENTS`, `MANAGE_ACHIEVEMENTS` are added
only to `ADMIN_PERMISSIONS`, mirroring the existing precedent that reserves
`MANAGE_COACHES`/`MANAGE_BATCHES`/`MANAGE_ACCOUNTS`/`VIEW_AUDIT_LOG` for
ADMIN/SUPER_ADMIN only). Coaches have **no** certificate or achievement
access in Phase 17 — no Coach certificate routes, no Coach achievement
routes, no Coach read RPC. Rationale: certificates are official academy
records and achievement publication is academy-level recognition;
mutation authority is kept centralized rather than distributed, and this
decision is revisitable in a future phase.

### Admin Mutation Client Architecture Divergence

Every other Phase 10 admin entity (students/parents/coaches/batches/etc.)
writes through the **service-role client**
(`getAdminSupabaseClient()`, which bypasses RLS entirely) gated solely by
the application-layer `requirePermission()` check — RLS on those tables is
a deliberate zero-policy deny-by-default backstop. Certificates and
achievements instead use the **normal per-request session client**
(`getServerSupabaseClient()`), because every Phase 17 RPC is written to
resolve `auth.uid()` internally (consistent with the Coach/Student/Parent
RPC convention established in Phases 14-16) — a service-role connection
has no `auth.uid()` and would break that check. `requirePermission()` at
the route/action layer remains as an additional, first-layer gate
(defense-in-depth), not a replacement for the RPC's own `auth.uid()`
verification. A new SQL helper, `current_admin_profile_id()`, resolves to
the caller's own `profiles.id` only when
`role IN ('ADMIN','SUPER_ADMIN') AND active = true` (STAFF deliberately
excluded, matching Phase 10 precedent).

## Admin Routes + Navigation

Routes: `/admin/certificates`, `/admin/certificates/new`,
`/admin/certificates/[certificateId]`, `/admin/achievements`,
`/admin/achievements/new`, `/admin/achievements/[achievementId]`. The
admin sidebar (`src/config/adminNavigation.ts`) gains "Certificates" and
"Achievements" entries, gated on `VIEW_CERTIFICATES`/`VIEW_ACHIEVEMENTS`
respectively — no Certificate Templates/Designer/QR Verification/
Certificate Files/Downloads entries exist, since none of those systems are
built.

## Admin Certificate List + Detail

`/admin/certificates` groups records into Draft/Issued/Revoked sections,
showing certificate number (issued/revoked only), student name + code,
certificate type (via `certificateTypeLabel()`), title, program,
tournament, status, issue date, created date. Never shows student contact
PII, parent details, or payment data. `/admin/certificates/[certificateId]`
shows the same fields plus description, linked achievement, and
revocation info when revoked. `DRAFT` renders the edit form + Issue
Certificate control; `ISSUED` renders the Revoke Certificate control;
`REVOKED` is read-only. Never exposes `created_by`/`issued_by`/
`revoked_by` UUIDs.

## Admin New Certificate Page

`/admin/certificates/new` collects student (via narrow search), a
certificate type, title, description, and contextual program/tournament/
achievement selects. No 5,000-student payload — see "Admin Student Search
Architecture" below.

## Admin Achievement List + New + Detail

Structurally identical to the certificate pages: `/admin/achievements`
groups Draft/Published/Archived; `/admin/achievements/new` uses the same
narrow student search; `/admin/achievements/[achievementId]` shows full
context (achievement date, program, tournament, placement, external
organization, status, published date) with Edit + Publish + Archive on
`DRAFT`, Archive on `PUBLISHED`, and read-only on `ARCHIVED`.

## Admin Student Search Architecture + Privacy

`search_students_for_admin_record(target_query text)` is a `SECURITY
DEFINER` RPC (`SET search_path = public`) that resolves `auth.uid()`,
verifies ADMIN/SUPER_ADMIN, normalizes and requires a minimum 2-character
query, searches `student_code`/`student_name` only, limits results to 20,
and returns only `student_id`/`student_name`/`student_code` — never email,
phone, WhatsApp, address, DOB, or parent data. `REVOKE ALL FROM PUBLIC` /
`GRANT EXECUTE TO authenticated`; not called by Coach/Student/Parent
anywhere. The Server Action wrapper (`searchStudentsForCertificateAction`/
`searchStudentsForAchievementAction` in `src/lib/actions/admin/search.ts`)
is a POST-based Server Action, not a GET query-string search — student
names/codes are never placed in a browser URL.

## Certificate Write Architecture + RPCs

Four narrow `SECURITY DEFINER` RPCs in migration 0026: `create_student_certificate`,
`update_student_certificate`, `issue_student_certificate`,
`revoke_student_certificate`. No broad Admin INSERT/UPDATE/DELETE policy
exists for `student_certificates` — every write goes through one of these
four functions. No delete RPC exists.

**`create_student_certificate`** — resolves `auth.uid()`, verifies ADMIN,
validates student existence, certificate type, context (program/
tournament/achievement), achievement ownership, and text lengths; inserts
`DRAFT` with `certificate_number`/`issued_on`/`issued_by` all `null`;
`created_by` is always `auth.uid()`, never client-supplied. Never accepts
`status`/`certificate_number`/`created_by`/`issued_by` from the caller.

**`update_student_certificate`** — ADMIN only, `DRAFT` only; allows
updating type/title/description/program/tournament/achievement, fully
revalidating context; never allows changing `student_id`/`status`/
`certificate_number`/`created_by`/`issued_on`/`issued_by`/`revoked_at`/
`revoked_by`.

**`issue_student_certificate(target_certificate_id, target_issued_on)`** —
ADMIN only, requires `DRAFT`, revalidates context, generates
`certificate_number` via the catch-and-retry loop described above, sets
`status = ISSUED`/`issued_on`/`issued_by = auth.uid()`; atomic; the only
`DRAFT -> ISSUED` path.

**`revoke_student_certificate(target_certificate_id, target_revocation_reason)`**
— ADMIN only, requires `ISSUED`, requires a non-empty reason (≤ 2000
chars), sets `status = REVOKED`/`revoked_at = now()`/`revoked_by =
auth.uid()`/`revocation_reason`; never clears `certificate_number`/
`issued_on`; the only `ISSUED -> REVOKED` path.

## Achievement Write Architecture + RPCs

Four narrow RPCs: `create_student_achievement`, `update_student_achievement`,
`publish_student_achievement`, `archive_student_achievement`. No delete
RPC.

**`create_student_achievement`** — ADMIN only; validates student, type,
title, description, date, program, tournament, placement, external
organization; inserts `DRAFT`; `created_by = auth.uid()`; never accepts
`status`/`published_by`/`published_at`.

**`update_student_achievement`** — ADMIN only, `DRAFT` only; allows
updating content/context; revalidates fully; never allows changing
`student_id`/`status`/`created_by`/`published_at`/`published_by`.

**`publish_student_achievement`** — ADMIN only, requires `DRAFT`,
revalidates context, sets `status = PUBLISHED`/`published_at = now()`/
`published_by = auth.uid()`; never allows `PUBLISHED -> DRAFT`; never
auto-creates a certificate.

**`archive_student_achievement`** — ADMIN only; allows `DRAFT -> ARCHIVED`
and `PUBLISHED -> ARCHIVED`; never allows reverting to `DRAFT`/
`PUBLISHED`; preserves any linked certificate reference.

## Student Certificate + Achievement Routes, List, Detail, and Privacy

Routes: `/portal/certificates`, `/portal/certificates/[certificateId]`,
`/portal/achievements`, `/portal/achievements/[achievementId]`. The
student nav (`src/config/studentPortalNavigation.ts`) gains "Certificates"
and "Achievements" after "Assignments".

`get_student_certificates()` (zero-argument, scoped internally to
`current_student_id()`) returns only certificates with
`status IN ('ISSUED', 'REVOKED')` — `DRAFT` never appears.
`get_student_certificate(target_certificate_id)` additionally requires
`certificate.student_id = current_student_id()`; "knowing the certificateId
is not enough." REVOKED certificates show "This certificate has been
revoked by Phoenix Chess Academy." plus the revocation reason, but never
the `revoked_by` identity. There is no Download Certificate button, no
View PDF button, no QR code, and no Verify Certificate link anywhere on
these pages.

`get_student_achievements()`/`get_student_achievement()` mirror the same
pattern for `status IN ('PUBLISHED', 'ARCHIVED')`. No fabricated badges,
no ranking calculation, no derived "rank among students" anywhere.

## Parent Certificate + Achievement Routes and Privacy

Routes: `/parent/students/[studentId]/certificates`,
`/parent/students/[studentId]/certificates/[certificateId]`,
`/parent/students/[studentId]/achievements`,
`/parent/students/[studentId]/achievements/[achievementId]`. The
per-student context nav (`getParentStudentContextNav()`) gains
"Certificates" and "Achievements".

Every request first resolves the parent via `getCurrentParent()`, then
authorizes the target student via `getLinkedStudent()`
(`src/lib/parent/authorization.ts`) before any certificate/achievement
query runs. `get_parent_student_certificates(target_student_id)`/
`get_parent_student_certificate(target_student_id, target_certificate_id)`/
`get_parent_student_achievements(target_student_id)`/
`get_parent_student_achievement(target_student_id, target_achievement_id)`
independently re-verify `parent_has_student(target_student_id)` inside the
RPC — a second, defense-in-depth authorization layer, not the only one.
Parent access is entirely read-only: no certificate or achievement
mutation RPC is ever exposed to the parent role.

## Read RPC Architecture

Twelve read RPCs total: Admin (`get_admin_certificates`,
`get_admin_certificate`, `get_admin_achievements`, `get_admin_achievement`),
Student (`get_student_certificates`, `get_student_certificate`,
`get_student_achievements`, `get_student_achievement`), Parent
(`get_parent_student_certificates`, `get_parent_student_certificate`,
`get_parent_student_achievements`, `get_parent_student_achievement`). Each
returns role-appropriate narrow columns; none ever return `created_by`/
`issued_by`/`revoked_by`/`published_by` profile UUIDs, student contact
PII, parent data, or payment data.

## RLS Architecture

`student_certificates` and `student_achievements` have RLS enabled with
no broad Student SELECT policy, no broad Parent SELECT policy, no direct
Student mutation policy, and no Parent mutation policy anywhere. Two
narrow ADMIN backstop SELECT policies exist (gated on
`current_admin_profile_id() IS NOT NULL`) for direct-table debugging/
tooling scenarios; all application reads go through the narrow RPCs above
in practice. All writes go through the RPCs described above — no broad
Admin INSERT/UPDATE/DELETE policy exists on either table.

## RPC Security + auth.uid() Ownership Chains

Every Phase 17 `SECURITY DEFINER` function: sets `search_path = public`,
resolves `auth.uid()`, verifies the caller's role (via
`current_admin_profile_id()`, `current_student_id()`, or
`parent_has_student()` as appropriate — the latter two reused verbatim
from Phases 14/16, not redefined), validates every input, returns only
narrow result columns, and is `REVOKE ALL FROM PUBLIC` /
`GRANT EXECUTE TO authenticated` only. Nothing trusts UUID knowledge alone,
route parameters, client-asserted roles, student name/code, or a
browser-selected student id without independent server-side verification.

## Action Result Architecture

Phase 17 reuses the existing `AdminActionResult<T>` (`{success, message?,
data?}`) and `AdminQueryResult<T>` (`{ok:true,data}|{ok:false,code}`) types
from `src/lib/admin/errors.ts` and `src/lib/admin/queryResult.ts` rather
than inventing a new result shape — the spec's instruction to "use the
existing ADMIN architecture" is interpreted as reusing this established
convention. Nine new `AdminErrorCode` values were added:
`CERTIFICATE_NOT_FOUND`, `CERTIFICATE_NOT_EDITABLE`,
`INVALID_CERTIFICATE_CONTEXT`, `INVALID_TRANSITION`,
`CERTIFICATE_NUMBER_GENERATION_FAILED`, `REVOCATION_REASON_REQUIRED`,
`ACHIEVEMENT_NOT_FOUND`, `ACHIEVEMENT_NOT_EDITABLE`,
`INVALID_ACHIEVEMENT_CONTEXT`. Every Server Action maps RPC exception text
to one of these safe codes via `getSafeAdminMessage()` — raw Postgres/
Supabase/RPC exception text and stack traces never reach the browser.

## Certificate + Achievement Status and Type Presentation

`CertificateStatusBadge` (`src/components/certificates/CertificateStatusBadge.tsx`)
and `AchievementStatusBadge` (`.../AchievementStatusBadge.tsx`) are each
their own dedicated component — never reused from
`AssignmentStatusBadge`/`ProgressEvaluationStatusBadge`, since the
lifecycle semantics genuinely differ even where labels look similar.
Status is always shown as text plus a tone color, never color alone;
`REVOKED` is visually distinct (danger tone); no trophy/crown/medal icon
is ever used to imply status. `certificateTypeLabel()`/
`achievementTypeLabel()` (`src/components/certificates/labels.ts`) are
deterministic mappers — no page ever renders a raw enum value.

## No Automatic Certificate Issuance / Achievement Creation

Every certificate is created only via an explicit `createCertificate()`
Server Action call triggered by an admin submitting `CertificateForm`, and
every achievement only via `createAchievement()`. Grepping the full write
surface (`src/lib/actions/**`, `supabase/migrations/**`) confirms no
trigger, RPC, or Server Action anywhere derives a certificate or
achievement from program completion, attendance, progress evaluations,
assignment status, tournament registration, tournament results, or
achievement publication. Coach feedback (Phase 16) never triggers a
certificate or achievement.

## No Certificate File Generation / No Public Verification

No PDF, PNG, JPG, SVG, HTML template, canvas, QR code, or barcode
generation exists anywhere in this phase, and no pdf/canvas/QR/image
generation package was installed (`package.json` unchanged in this
respect). No `/verify`, `/certificate/verify`, `/certificates/verify`,
public certificate lookup, certificate-number search, or verification API
route exists. `certificate_number` remains an identifier only.

## Private Data Caching + Client Data Exposure

No `force-static`, no public `revalidate`, and no cross-user caching is
used on any certificate/achievement page — every page is a dynamic Server
Component reading through the session-scoped Supabase client. `React
cache()` is not introduced in this phase (none of the new query modules
memoize beyond the existing per-request pattern). No certificate/
achievement data is ever written to `localStorage`/`sessionStorage`/
`IndexedDB`/a window global. Student names, codes, certificate numbers,
titles, achievement titles, descriptions, and revocation reasons never
appear in a query string — the only route identifiers used are
`certificateId`, `achievementId`, and the pre-existing `studentId` (parent
context routes).

## SEO

All thirteen new routes (`/admin/certificates*`, `/admin/achievements*`,
`/portal/certificates*`, `/portal/achievements*`,
`/parent/students/[studentId]/certificates*`,
`/parent/students/[studentId]/achievements*`) use
`buildMetadata({ index: false })`. None appear in `src/app/sitemap.ts`.
`src/app/robots.ts` continues disallowing `/admin`, `/portal`, and
`/parent`, which covers every new route by prefix. No Certificate/Award/
Person-award JSON-LD and no AggregateRating schema is introduced.

## Future Architecture (Explicitly Deferred, Not Built This Phase)

Certificate template design, PDF generation, Cloudflare R2 certificate
file storage, QR-code generation, public certificate verification, and
certificate delivery (email/WhatsApp) are all deliberately out of scope
for Phase 17 and require their own future, explicitly-approved phase with
its own security review (in particular: how a public verification page can
expose certificate authenticity without leaking student PII, and how file
storage access control interacts with the REVOKED lifecycle state).
