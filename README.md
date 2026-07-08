# Phoenix Chess Academy

Production web platform for Phoenix Chess Academy — https://phoenixchessacademy.org

Built with Next.js (App Router, TypeScript), Tailwind CSS v4, Supabase,
Cloudflare R2, and Google Sheets reporting. See `PHASE_1_ARCHITECTURE.md`
(project root, one level up) for the full system architecture, database
plan, and development roadmap.

## Status

Phase 17 complete: certificates + achievement records — ADMIN/SUPER_ADMIN
may issue academy certificate records (`student_certificates`: Program
Completion, Participation, Tournament Participation, Tournament
Achievement, Special Recognition) and publish verified student achievement
records (`student_achievements`: Tournament Winner/Runner-Up/Placement,
Chess Milestone, Academy Recognition, External Chess Achievement), each
gated through its own DRAFT-based lifecycle enforced entirely by narrow
RPCs — no broad Admin INSERT/UPDATE/DELETE policy exists on either table,
and no delete RPC exists for either. Certificates issue through
`issue_student_certificate()`, which generates a stable, non-secret
`certificate_number` (`PCA-<year>-<8 hex chars>`) server-side via a
catch-and-retry loop and can subsequently only be revoked
(`revoke_student_certificate()`, requiring a reason) — never deleted, never
re-issued. Achievements publish through `publish_student_achievement()`
and can only be archived afterward, never reverted. Certificate/achievement
mutation is ADMIN-only in this phase (Coaches have no access at all); an
admin-only narrow student-search RPC (capped at 20 results, no contact
PII) replaces any academy-wide student browser payload. Students see only
`ISSUED`/`REVOKED` certificates and `PUBLISHED`/`ARCHIVED` achievements for
themselves (`/portal/certificates`, `/portal/achievements`); parents see
the same for linked students, read-only
(`/parent/students/[studentId]/certificates`,
`/parent/students/[studentId]/achievements`). No certificate PDF/image
generation, no QR codes, no public certificate verification, and no file
uploads exist anywhere in this phase. See
`docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md` for the full schema, RLS,
RPC, and privacy architecture.

Phase 16 complete: assignments + homework — coaches may create structured
chess assignments (`assignments`) for batches they currently manage or for
one directly-authorized student, gated through a DRAFT → PUBLISHED →
ARCHIVED lifecycle enforced entirely by narrow RPCs
(`create_`/`update_`/`publish_`/`archive_assignment`) — there is no broad
Coach INSERT/UPDATE/DELETE policy on `assignments`, `assignment_recipients`,
or `assignment_submissions`. Publishing atomically snapshots the eligible
student audience into `assignment_recipients` (never recalculated
afterward, preventing new students from inheriting old homework or former
students losing legitimate history). Students submit text and/or a
chess-study/reference URL (`submit_assignment()`; http/https only, never
fetched or scraped server-side) and may resubmit only while a coach has
requested revision; coach review is qualitative only (`REVIEWED`/
`REVISION_REQUESTED` + free-text feedback — no marks, score, percentage, or
pass/fail). DRAFT assignments never reach the Student or Parent Portal.
Students see only assignments where they are a legitimate recipient
(`/portal/assignments`); parents see the same for linked students
(`/parent/students/[studentId]/assignments`), read-only. No file/image/PDF/
PGN uploads, no AI-generated content, and no chess-engine integration exist
anywhere in this phase. See `docs/ASSIGNMENTS_ARCHITECTURE.md` for the full
schema, RLS, RPC, and privacy architecture.

Phase 15 complete: student progress evaluations — coaches may author
structured chess-development evaluations (`student_progress_evaluations` +
`student_progress_area_ratings`, ten canonical development areas, a 1-5
internal rating scale with stable text labels never implying a FIDE
title) for students on batches they currently manage, gated through a
DRAFT → PUBLISHED → ARCHIVED lifecycle enforced entirely by four narrow
RPCs (`create_`/`update_`/`publish_`/`archive_student_progress_evaluation`)
— there is no broad Coach INSERT/UPDATE policy on either table. DRAFT
content is mandatory-blocked from ever reaching the Student or Parent
Portal (no direct RLS SELECT for either role; two PUBLISHED-only read
RPCs are the sole access path), publishing requires real content (at
least one area rating and a non-empty summary), and a PUBLISHED
evaluation is immutable in the Coach Portal — no unpublish, no coach
delete. No evaluation is ever derived from attendance, FIDE rating, or
tournament results, and no automatic overall score, percentage, or
student ranking is ever calculated. Students see only their own published
evaluations (`/portal/progress`); parents see them only for linked
students (`/parent/students/[studentId]/progress`). See
`docs/STUDENT_PROGRESS_ARCHITECTURE.md` for the full schema, RLS, RPC,
and privacy architecture.

Phase 14 complete: class sessions + attendance — `class_sessions` (real,
dated occurrences) is now clearly distinct from `class_schedules`
(recurring weekly definitions), and `attendance_records` attaches only
to `class_sessions`, never to `class_schedules`. A coach may create
sessions and mark attendance only for batches currently assigned via
`batch_coaches`, with a session-date-aware, dual-path eligible roster
(`batch_enrollments` / `student_program_enrollments`) enforced atomically
by the `mark_session_attendance()` RPC — no partial marking of a mixed
authorized/unauthorized roster is possible, and a cancelled session can
never receive attendance. A missing attendance row always means "Not
Marked" — no automatic PRESENT/ABSENT/LATE/EXCUSED inference exists
anywhere. Students see only their own attendance
(`/portal/attendance`); parents see attendance only for linked students
(`/parent/students/[studentId]/attendance`); attendance notes remain
coach-only in both. See `docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`
for the full schema, RLS, RPC, and privacy architecture. Certificates and
payments remain future phases.

Phase 13 complete: the coach portal foundation — `/coach` now resolves
the signed-in COACH to their exact `coaches` record, and a coach may
view only the batches explicitly assigned to them through
`batch_coaches` (never by batch UUID/code/name/program/location alone),
plus the students connected to those batches via a dual-path
(`batch_enrollments` / `student_program_enrollments`), deduplicated,
narrow roster RPC. Provides a real dashboard, a read-only profile page,
My Batches, and per-batch Overview/Students/Class Schedule pages, backed
by a third set of relationship-scoped RLS policies. See
`docs/COACH_PORTAL_ARCHITECTURE.md` for the full identity-resolution,
coach-to-batch authorization, RLS, and privacy architecture. Class
sessions and attendance were added on top of this in Phase 14 (see
above).

Phase 12 complete: the parent portal foundation — `/parent` now
resolves the signed-in PARENT to their exact `parents` record, and a
parent may view only the students explicitly linked to them through
`student_parents` (never by student UUID/code/email alone). Provides a
real dashboard, a read-only profile page, My Students, and per-student
Overview/Programs/Batches/Class Schedule pages, backed by a second set
of relationship-scoped RLS policies. See
`docs/PARENT_PORTAL_ARCHITECTURE.md` for the full identity-resolution,
parent-to-student authorization, RLS, and privacy architecture.

Phase 11 complete: the student portal foundation — `/portal` now
resolves the signed-in STUDENT to their exact `students` record (never
an arbitrary/browser-supplied ID), and provides a real dashboard, a
read-only profile page, My Programs, My Batches, and Class Schedule,
all backed by the first relationship-scoped Row Level Security policies
in the project. See `docs/STUDENT_PORTAL_ARCHITECTURE.md` for the full
identity-resolution, RLS, and privacy architecture. There is still no
parent/coach dashboard, no attendance, no class sessions, no progress
tracking, no assignments, no certificates, and no payments — those
remain future phases.

Phase 10 complete: the admin operations foundation — a permission model
(`AdminPermission`/`requirePermission()`), a real admin shell
(sidebar/topbar/mobile drawer), and full CRUD for students, parents,
coaches, batches, class schedules, and program/batch enrollments, plus
controlled portal-account provisioning, bulk CSV student import, and an
admin audit log. See `docs/ADMIN_OPERATIONS_ARCHITECTURE.md` for the
complete details, including the permission matrix, the parent-student
many-to-many model, code generation, the schedule-vs-session
distinction, account provisioning's reconciliation strategy, and the
service-role/RLS security boundary. There is still no student/parent/
coach dashboard, no attendance, no progress tracking, no certificates,
no payments, and no tournament admin management — those remain future
phases.

Phase 9 (Supabase Auth login/logout, forgot/reset password, role-based
route protection) remains complete — see `docs/AUTH_ARCHITECTURE.md`,
including the manual first-SUPER_ADMIN bootstrap procedure. There is
still no public signup (by design) and no file uploads.

Phase 7 (Supabase database foundation, public form submission, Google
Sheets reporting) and Phase 8 (public content pages) remain complete —
see `docs/DATABASE_ARCHITECTURE.md`, `docs/GOOGLE_SHEETS_REPORTING.md`,
and `docs/DATA_RETENTION.md`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run lint    # ESLint
npm run build   # production build
```

Copy `.env.example` to `.env.local` and fill in values as needed.

### Mode A — frontend only (no Supabase)

Leave the `NEXT_PUBLIC_SUPABASE_*` variables unset. The site builds and
runs fully; the Contact, Book a Trial, and Tournament Registration forms
detect the missing configuration and show a safe "not available right
now" message instead of pretending to succeed.

### Mode B — Supabase connected

1. Create a Supabase project, then run the migrations in
   `supabase/migrations/` in filename order (via the Supabase CLI or SQL
   editor).
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Forms now submit real records. Optionally configure the four Google
   Sheets variables (see `docs/GOOGLE_SHEETS_REPORTING.md`) to also
   enable operational reporting sync — this is never required for the
   forms themselves to work.
4. Login, forgot/reset password, and the protected `/portal` / `/parent`
   / `/coach` / `/admin` routes now work. Follow
   `docs/AUTH_ARCHITECTURE.md`, "First SUPER_ADMIN Bootstrap Procedure"
   to create the first account — there is no public signup route.
5. Once signed in as STAFF/ADMIN/SUPER_ADMIN, `/admin` now manages
   students, parents, coaches, batches, schedules, and enrollments, and
   supports bulk CSV student import (`/admin/students/import`) and
   controlled portal-account provisioning (`/admin/accounts`). See
   `docs/ADMIN_OPERATIONS_ARCHITECTURE.md` for the full permission
   matrix and architecture.
6. Once a STUDENT account is provisioned and linked to a `students` row
   (via `/admin/accounts`), signing in shows the real student portal at
   `/portal` — dashboard, profile, programs, batches, and schedule, all
   scoped to that student's own data via RLS. See
   `docs/STUDENT_PORTAL_ARCHITECTURE.md`.
7. Once a PARENT account is provisioned and linked to a `parents` row
   with at least one `student_parents` relationship, signing in shows
   the real parent portal at `/parent` — dashboard, profile, My
   Students, and per-student Overview/Programs/Batches/Class Schedule,
   all scoped through that relationship via RLS. See
   `docs/PARENT_PORTAL_ARCHITECTURE.md`.
1. **Coach-to-batch authorization** (`src/lib/coach/authorization.ts`) —
   `getAssignedBatch(coachId, batchId)` derives access solely from a
   current `batch_coaches` row, powering the real coach portal at
   `/coach` — dashboard, profile, My Batches, and per-batch
   Overview/Students/Class Schedule, all scoped through that
   relationship via RLS. See `docs/COACH_PORTAL_ARCHITECTURE.md`.

## Project structure

- `src/app` — routes, grouped into `(public)` (marketing site, has
  Navbar/Footer), `(auth)` (login/forgot-password/reset-password, minimal
  layout), `auth/callback` (Supabase auth code exchange, Route Handler),
  `portal` (STUDENT-only, real dashboard/profile/programs/batches/
  schedule/attendance/progress — see
  `docs/STUDENT_PORTAL_ARCHITECTURE.md`), `parent`
  (PARENT-only, real dashboard/profile/My Students/per-student
  Overview-Programs-Batches-Schedule-Attendance-Progress — see
  `docs/PARENT_PORTAL_ARCHITECTURE.md`), `coach` (COACH-only, real
  dashboard/profile/My Batches/per-batch Overview-Students-Schedule,
  plus dated Class Sessions, attendance marking, and student progress
  evaluations — see `docs/COACH_PORTAL_ARCHITECTURE.md`,
  `docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`, and
  `docs/STUDENT_PROGRESS_ARCHITECTURE.md`), and `admin` (role- and
  permission-protected, full operations UI — see
  `docs/ADMIN_OPERATIONS_ARCHITECTURE.md`).
- `src/components/ui` — design-system primitives (Button, Container,
  Section, Logo, Badge, StatusBadge, IconButton, SkipLink).
- `src/components/layout` — Navbar, MobileNav, DesktopNav, Footer.
- `src/components/forms` — public form fields plus auth forms
  (`LoginForm`, `ForgotPasswordForm`, `ResetPasswordForm`,
  `PasswordField`).
- `src/components/portal` — `ProtectedShell`, the shared minimal chrome
  for the `coach` segment; `src/components/portal/student` — the real
  student portal shell (`StudentPortalShell`, `StudentPortalSidebarNav`,
  `StudentPortalMobileNav`, `StudentStatusBadge`, `StudentPortalState`);
  `src/components/portal/parent` — the real parent portal shell
  (`ParentPortalShell`, `ParentPortalSidebarNav`, `ParentPortalMobileNav`,
  `ParentStatusBadge`, `ParentPortalState`, `StudentContextNav`) — an
  independent implementation, not shared with the student portal.
- `src/components/admin` — the admin shell (`AdminShell`,
  `AdminSidebarNav`, `AdminMobileNav`), shared list/form primitives
  (`AdminPageHeader`, `Pagination`, `StatusBadge`, `AdminQueryError`,
  `forms/FormField`), and per-entity components under
  `students/`, `parents/`, `coaches/`, `batches/`, `schedules/`,
  `enrollments/`, `accounts/`.
- `src/config` — `site.ts` (brand/domain/contact config),
  `navigation.ts` (public nav), `adminNavigation.ts` (admin nav,
  permission-filtered), `studentPortalNavigation.ts` (the five student
  portal nav items), and `parentPortalNavigation.ts` (the three global
  parent nav items plus the per-student context nav generator).
- `src/lib` — fonts, SEO metadata helpers, small utilities, Supabase
  clients (`src/lib/supabase`), Server Actions (`src/lib/actions`,
  including `auth.ts` and `admin/*.ts`), Google Sheets reporting
  (`src/lib/google`), rate limiting (`src/lib/rate-limit`), the auth
  helpers (`src/lib/auth` — `roles.ts`, `getCurrentUser.ts`,
  `getCurrentProfile.ts`, `requireAuth.ts`, `requireRole.ts`,
  `permissions.ts`, `errors.ts`, `safeRedirect.ts`), admin query modules
  (`src/lib/queries/admin`), student portal query modules
  (`src/lib/queries/student` — `profile.ts`, `programs.ts`,
  `batches.ts`, `schedule.ts`, `dashboard.ts`, `coaches.ts`), parent
  portal query modules (`src/lib/queries/parent` — `profile.ts`,
  `students.ts`, `programs.ts`, `batches.ts`, `schedule.ts`,
  `dashboard.ts`, `coaches.ts`), admin validation schemas
  (`src/lib/validation/admin`), admin cross-cutting helpers
  (`src/lib/admin` — `pagination.ts`, `queryResult.ts`, `errors.ts`,
  `audit.ts`, `csv.ts`, `importMatching.ts`, `uuid.ts`), student portal
  cross-cutting helpers (`src/lib/portal` — `getCurrentStudent.ts`,
  `access.ts`, `queryResult.ts`, `weekday.ts`), and parent portal
  cross-cutting helpers (`src/lib/parent` — `getCurrentParent.ts`,
  `access.ts`, `authorization.ts`, `queryResult.ts`) — independent of,
  and not importing from, the student portal's equivalents.
- `src/proxy.ts` — Next.js 16 request-interception file (renamed from
  `middleware.ts`); refreshes the Supabase session cookie only, not an
  authorization layer.
- `supabase/migrations` — SQL migrations, applied in filename order.
- `docs/` — `DATABASE_ARCHITECTURE.md`, `GOOGLE_SHEETS_REPORTING.md`,
  `DATA_RETENTION.md`, `AUTH_ARCHITECTURE.md`,
  `ADMIN_OPERATIONS_ARCHITECTURE.md`, `STUDENT_PORTAL_ARCHITECTURE.md`,
  `PARENT_PORTAL_ARCHITECTURE.md`, `COACH_PORTAL_ARCHITECTURE.md`,
  `CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md`,
  `STUDENT_PROGRESS_ARCHITECTURE.md`, `ASSIGNMENTS_ARCHITECTURE.md`,
  `CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md`.

## Brand assets

The logo at `public/images/brand/phoenix-logo-placeholder.svg` is a
placeholder. See `MEDIA_MAPPING.md` for exactly what to replace it with
and where every other media placeholder lives.
