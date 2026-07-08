# Database Architecture (Phase 7)

This document describes the Supabase database foundation built in Phase 7:
schema layout, identifier and timestamp conventions, the public form
submission flow, Row Level Security strategy, indexing, constraints, and
the database-typing approach. It does not cover Google Sheets reporting
(see `docs/GOOGLE_SHEETS_REPORTING.md`) or data retention policy (see
`docs/DATA_RETENTION.md`).

## Supabase Is the Source of Truth

Supabase (PostgreSQL) is the authoritative application database. Google
Sheets is a reporting/operational-visibility export only — it is never
read from, never the primary write target, and never implements deletion
logic of any kind. This is a hard architectural rule carried through
every table and workflow below. See `docs/GOOGLE_SHEETS_REPORTING.md`,
"Why Outbox Architecture" for the full reasoning.

## Migrations

SQL migrations live in `supabase/migrations/`, applied in filename order:

| File | Contents |
|---|---|
| `0001_extensions_and_helpers.sql` | `pgcrypto` extension, shared `set_updated_at()` trigger function |
| `0002_profiles_and_roles.sql` | `user_role` enum, `profiles` table (maps to `auth.users`) |
| `0003_academy_structure.sql` | `academy_locations` table, idempotent seed of the confirmed Madipakkam location |
| `0004_programs.sql` | `programs` table (foundation only — intentionally unseeded, see "Static Content vs. Database" below) |
| `0005_leads_and_enquiries.sql` | `contact_enquiries`, `trial_bookings`, their status enums |
| `0006_tournaments.sql` | `tournaments` + 8 tournament sub-tables |
| `0007_tournament_registrations.sql` | `tournament_registrations`, its status enum, duplicate-protection indexes |
| `0008_reporting_outbox.sql` | `reporting_outbox` table + status enum |
| `0009_submission_functions.sql` | The three `SECURITY DEFINER` RPC functions (see below) |
| `0010_rls_policies.sql` | Row Level Security policies |
| `0011_indexes_and_constraints.sql` | Secondary indexes for real query patterns |

Grouped by concern (11 files, not 40+ tiny ones) so each migration reads
as a coherent unit of the schema.

## Identifiers and Timestamps

Every table uses a UUID primary key via `gen_random_uuid()` (from the
`pgcrypto` extension enabled in `0001`). Business entities that need a
human-friendly public identifier (e.g. `academy_locations`, `programs`,
`tournaments`) also carry a unique `slug` column — the UUID is never
replaced by a sequential integer, and no sequential DB id is ever the
only public-facing identifier.

All timestamp columns use `timestamptz`, stored in UTC. Every table has
`created_at` and `updated_at`; `updated_at` is kept current by a single
shared trigger function (`public.set_updated_at()`, defined once in
`0001`) attached per-table via `CREATE TRIGGER ... EXECUTE FUNCTION
set_updated_at()` — the trigger body itself is not duplicated per table.

## Profile and Role Foundation

`profiles` maps 1:1 to `auth.users.id` (no separate password storage —
Supabase Auth will manage credentials once a real auth UI exists in a
later phase). Fields: `id`, `full_name`, `email`, `phone`, `role`
(`STUDENT | PARENT | COACH | STAFF | ADMIN | SUPER_ADMIN`, default
`STUDENT`), `active`, `created_at`, `updated_at`.

**No auth UI, no seed accounts exist in Phase 7.** This table is schema
only.

### Role Security Rule

A browser-supplied role value must never be trusted. There is no public
policy that lets a client insert or update its own `role` to anything
privileged — a student must never be able to self-assign `ADMIN`, and a
coach must never self-assign `SUPER_ADMIN`. Privileged role changes will
require a future server/admin-authorized path (not built in Phase 7 —
there is nothing to authorize against yet). `0010_rls_policies.sql`
documents this as an explicitly deferred requirement rather than
implementing a policy against relationships that don't exist yet.

## Academy Locations

`academy_locations` is schema built for future multi-branch growth, but
only one row is seeded: the CONFIRMED current address (73A, 13th St, Ram
Nagar, Kuberan Nagar, Madipakkam, Chennai, Tamil Nadu 600091, India). The
seed uses `ON CONFLICT (slug) DO NOTHING` so re-running the migration
never duplicates the row. No other city/country is seeded as a branch.

## Programs — Foundation Only, Intentionally Unseeded

`programs` exists as a schema destination for a future migration off
`src/content/programs.ts`, but is **not seeded** in Phase 7. Seeding it
now would create a half-migrated system: some pages reading from
Supabase, others from the static file, with no clear source of truth
during the transition. `src/content/programs.ts` remains the sole
authoritative source for all public program pages in Phase 7. The
`programs` table's shape (slug, name, descriptions, level, level_label,
active, featured, display_order) was designed to match the content
file's shape closely, specifically so that a future migration is a
localized change to `getProgramBySlug`/`getPrograms` rather than a
page-by-page rewrite.

## Contact Enquiries and Trial Bookings

`contact_enquiries` matches the real `ContactForm` Zod schema exactly:
`full_name`, `email`, `phone`, `country`, `enquiry_type`, `subject`,
`message`, `privacy_acknowledged_at`, `status`, `source`, timestamps.
`status` (`NEW | IN_REVIEW | CONTACTED | RESOLVED | SPAM`) is always
`NEW` on creation — it is set exclusively by the `submit_contact_enquiry`
RPC, never accepted from the client.

`trial_bookings` matches the real `TrialForm` schema: student info, date
of birth, chess level, optional FIDE id/rating, location, preferred
program, training mode, schedule preference, goals, guardian fields,
`privacy_acknowledged_at`, optional marketing consent, `status`
(`NEW | CONTACTED | ASSESSMENT_PENDING | TRIAL_SCHEDULED |
TRIAL_COMPLETED | CONVERTED | CLOSED`), `source`, timestamps, plus a
`submission_fingerprint` column used only as a soft duplicate-detection
hint (see "Duplicate Protection Strategy" below) — not a hard uniqueness
constraint.

## Tournaments and Tournament Registrations

`tournaments` mirrors the Phase 6 `Tournament` content-layer interface
(~30 columns: slug, name, status, dates, venue, fees, registration
controls, `highlights jsonb`, `related_slugs text[]`, etc.). Sub-tables:
`tournament_categories` (with a `category_key` text column — the bridge
to the content layer's `TournamentCategory.id`), `tournament_schedule_items`,
`tournament_rule_sections`, `tournament_documents`, `tournament_faqs`,
`tournament_results`, `tournament_result_tiebreaks` (folded into
`tournament_results.tie_breaks jsonb` — see below), `tournament_winners`,
`tournament_media`.

**JSONB vs. normalization decision:** `tournament_results.tie_breaks` and
`tournaments.highlights` are JSONB rather than fully normalized child
tables. Tie-break values are a small, per-tournament-format-defined set
of labeled numbers (e.g. Buchholz, Sonneborn-Berger) that have no
independent identity, are never queried individually, and are always read
and written as a whole alongside their parent result row — normalizing
them into their own table would add join complexity with no query
benefit. The same reasoning applies to `highlights`. Every other
tournament-related list (schedule, rules, documents, FAQs, results,
winners, media) got its own table because those rows do have independent
identity, ordering, and are queried/displayed as lists in their own
right.

`tournament_registrations` matches the actual Phase 6 registration form
fields exactly (player info, DOB, FIDE id/rating, association id,
location, contact, guardian fields, `current_chess_level`,
`school_or_academy`, `club`, `rules_acknowledged_at`,
`privacy_acknowledged_at`, `media_consent`, `marketing_consent`,
`status`, `source`, timestamps). `status`
(`PENDING | UNDER_REVIEW | CONFIRMED | REJECTED | CANCELLED | WAITLISTED`)
always starts at `PENDING` — since payment isn't implemented, the system
never defaults a registration to `CONFIRMED`.

### Tournament Registration Validation (Server-Side)

The client never supplies a raw tournament or category UUID. Registration
forms pass the tournament's `slug` and the category's content-layer
`categoryId` string; the `submit_tournament_registration` RPC resolves
both server-side and independently verifies, in this order: the
tournament exists and is `active`, its `status = 'REGISTRATION_OPEN'`,
`registration_enabled` is true, the registration deadline (if any) has
not passed, and the category actually belongs to that tournament (via
`tournament_categories.category_key`). Each failure raises a distinct,
recognizable exception message (`TOURNAMENT_NOT_FOUND`,
`REGISTRATION_NOT_OPEN`, `REGISTRATION_NOT_ENABLED`,
`REGISTRATION_DEADLINE_PASSED`, `INVALID_CATEGORY`) that the app layer
maps to a safe user-facing message (`src/lib/actions/errors.ts`). A
coarse minor/guardian check (age computed server-side from
`date_of_birth`) raises `GUARDIAN_INFO_REQUIRED` if guardian fields are
missing for an under-18 applicant.

## Public Form Server Architecture

**Chosen architecture: Next.js Server Actions**, not Route Handlers, for
all three public forms (`src/lib/actions/contact.ts`, `trial.ts`,
`tournamentRegistration.ts`). Reasoning: each form is submitted from
exactly one page-embedded React form and needs no independent HTTP
contract — a Server Action called via `startTransition` from the form
component is the more direct, less boilerplate-heavy path for that shape
of interaction, and keeps all three forms consistent with each other. The
one exception is the reporting sync worker
(`src/app/api/internal/reporting/sync/route.ts`), which **is** a Route
Handler — it needs an externally-triggerable HTTP endpoint (a cron
provider) with its own auth header, which a Server Action cannot expose.

Flow for every form: honeypot check → Supabase-configured check → rate
limit → Zod validation (server-side, independent of any client
validation) → Supabase RPC call → safe success/error response. Client-side
Zod validation is UX only and is always re-run server-side; nothing from
the client is trusted past that point.

## Server-Side Zod Validation and Business Rule Validation

Each Server Action re-parses its input with the same Zod schema the
client form uses (`src/lib/validation/contact.ts`, `trial.ts`,
`tournamentRegistration.ts`) before ever touching Supabase. This is
independent of, not a duplicate of, the RPC's own business-rule checks —
Zod validates shape/format (required fields, string lengths, enum
membership); the RPC validates state that only the database knows
(tournament status, registration deadlines, duplicate detection).

## Atomic Insert / RPC Strategy

The business insert and its corresponding `reporting_outbox` event are
created inside the same `SECURITY DEFINER` PL/pgSQL function
(`submit_contact_enquiry`, `submit_trial_booking`,
`submit_tournament_registration`, all in `0009_submission_functions.sql`),
so both writes commit or roll back together as one transaction — there is
no window where a business record exists without a corresponding outbox
event, or vice versa. These functions intentionally validate only
DB-knowable state (existence, status, deadlines, duplicates) — they are
not a re-implementation of the app's full Zod validation layer.

## Duplicate Protection Strategy

- **Tournament registrations:** two partial/composite unique indexes —
  `(tournament_id, category_id, email, date_of_birth)` and a partial
  index on `(tournament_id, category_id, fide_id)` where `fide_id` is
  non-empty. This blocks the same person registering twice for the same
  category while still allowing siblings who share a parent email to
  register (they have different dates of birth). Known edge case,
  documented in the migration: identical twins with no FIDE id sharing
  both parent email and date of birth would collide — accepted as a rare
  edge case rather than solved with an intrusive rule.
- **Trial bookings:** no hard uniqueness constraint. A
  `submission_fingerprint` (an md5 hash of normalized name + DOB +
  program) is computed and stored as a soft signal staff can use to spot
  likely duplicates manually — not used to reject a submission
  automatically, since legitimate repeat enquiries are common and normal.
- **Contact enquiries:** no uniqueness constraint at all — repeat
  enquiries from the same person are a normal, expected pattern.

## Rate Limiting Foundation

`src/lib/rate-limit/index.ts` defines a `RateLimiter` interface, an
`InMemoryRateLimiter` (5 requests / 60s per key), and a `NoopRateLimiter`.
**The in-memory limiter is explicitly documented as not production-safe
on Vercel/serverless** — each invocation may run on a different,
short-lived instance with no shared memory, so it only catches the
crudest same-instance abuse. It is wired up anyway because it costs
nothing and gives every Server Action one swappable interface; a real
distributed limiter (e.g. Redis-backed) is a one-file replacement later,
not a rewrite of every action. A honeypot field (`website`, visually
hidden off-screen, not `display:none` or `type="hidden"`) is checked
server-side on every form; a bot that fills it in receives a fake success
response rather than a revealing rejection. Neither mechanism is complete
bot protection alone.

## RLS Strategy

RLS is enabled on every table. The general rule: public (`anon` /
`authenticated`) browser sessions have **no** `SELECT`, `INSERT`,
`UPDATE`, or `DELETE` policies on `contact_enquiries`, `trial_bookings`,
`tournament_registrations`, `reporting_outbox`, or `profiles` (beyond a
user reading their own profile row). All writes to those tables happen
exclusively through the `SECURITY DEFINER` RPCs, called from a
server-side Supabase client using the request's own session (not the
service-role key) — the RPC's `SECURITY DEFINER` privilege is what lets
a low-privilege caller insert, not a broad table-level policy. Reads of
those tables happen only through the service-role admin client
(`src/lib/supabase/admin.ts`), used solely by the internal reporting sync
worker.

Non-sensitive catalog tables (`academy_locations`, `programs`,
`tournaments` and its 8 sub-tables) get narrow public **read** policies
scoped to `active = true` (or, for sub-tables, `EXISTS` against their
parent tournament's `active = true`) — there is deliberately no
`FOR SELECT USING (true)` anywhere; every read policy carries a real
condition.

`profiles` currently has one policy: a user may `SELECT` their own row
(`auth.uid() = id`). Policies for STAFF/ADMIN/COACH/PARENT visibility
into other profiles, students, attendance, etc. are explicitly **not**
implemented yet — those relationships don't exist as tables, and writing
a policy against a nonexistent join would be a fake policy. This is
recorded as deferred work, not an oversight.

## Public Data Access Security

Summarizing the above: the anon/public Supabase key is safe to expose in
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` because RLS
grants it nothing on any sensitive table. The service-role key
(`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS entirely and is loaded only in
`src/lib/supabase/admin.ts`, which imports the `server-only` package so
any accidental import into a Client Component fails at build time rather
than silently shipping the key to the browser. No Server Action or Route
Handler in this codebase uses the admin client except the reporting sync
worker.

## Database Indexes

Added only for query patterns the app actually performs:
`contact_enquiries(created_at desc, status)`,
`trial_bookings(created_at desc, status, preferred_program)`,
`tournaments(status, start_date)`, every tournament sub-table's
`tournament_id` foreign key (plus `category_id` on results/winners),
`tournament_registrations(status, category_id)`, and a composite
`reporting_outbox(status, next_attempt_at)` index (the sync worker's
exact query shape). Not every column is indexed — indexes were added
against real, anticipated query patterns only.

## Database Constraints

`NOT NULL`, `CHECK`, `UNIQUE`, and foreign keys are used where a rule is
genuinely stable: status values are constrained to their enum, FIDE
ratings must be non-negative, dates of birth cannot be in the future,
`display_order` must be non-negative, `end_date >= start_date`. Business
policies that are not yet fixed are deliberately **not** encoded as rigid
constraints — there is no hardcoded "under 2000 rating" rule, no
hardcoded tournament frequency, and `programs.level` is plain text, not a
six-value enum, specifically so a seventh program doesn't require a
schema migration.

## Database Types

There is no live Supabase project connected in this environment, so
`supabase gen types typescript --project-id <project-id>` — the correct
command once a project exists — could not be run to generate real types.
`src/lib/supabase/types.ts` is a narrow, hand-written `Database` type
covering only the surface the app actually calls: the three RPC
functions' `Args`/`Returns`, and a `reporting_outbox` `Tables` entry (the
one table queried directly, by the sync worker via the admin client).
Everything else (`Views`, `Enums`, most of `Tables`) is intentionally left
empty rather than hand-maintaining a full schema mirror that would
inevitably drift from the SQL.

**Known limitation:** supabase-js's generic inference for a hand-written
(non-CLI-generated) `Database` type does not reliably resolve through its
nested conditional types when `Tables`/`Views`/`Functions` are checked
together as one combined `Database['public'] extends GenericSchema`
check — even though each field passes the corresponding check in
isolation. This was root-caused with isolated `tsc --noEmit --strict`
test files rather than guessed at, and worked around with a documented
`as never` cast at each `.rpc()`/`.update()` call site (see the comments
in `src/lib/actions/contact.ts` and
`src/app/api/internal/reporting/sync/route.ts`). Every argument object
passed with that cast is still fully constructed against the real
`Database["public"]["Functions"][...]["Args"]` shape by the surrounding
code — the cast works around supabase-js's own inference gap, not a
relaxation of this codebase's own type safety. Once a real Supabase
project exists and CLI-generated types replace this file, re-test whether
the cast is still needed — it may be specific to a hand-written type.

## Static Content vs. Database (End of Phase 7)

**Static (not database-backed) in Phase 7:** program copy
(`src/content/programs.ts`), training methodology
(`src/content/training.ts`), founder/leadership content
(`src/content/about.ts`), home page copy (`src/content/home.ts`), FAQ
content, legal page drafts, and all tournament *public record* content
(currently empty arrays — no tournaments have been entered yet).

**Database-backed (real writes happen here) in Phase 7:**
`contact_enquiries`, `trial_bookings`, `tournament_registrations`, and
`reporting_outbox` — every public form submission creates a real row via
its RPC.

**Database foundation only (schema exists, no reads/writes from the app
yet) in Phase 7:** `profiles`, `academy_locations` (one seeded row,
unread by any page), `programs`, `tournaments` and its 8 sub-tables.

Public programs were not migrated to the database in this phase because
doing so mid-phase — while Phase 7's actual scope is the database
foundation, not a content migration — would create a half-migrated
system: some program pages backed by Supabase, others still static,
depending on which slug happens to have a seeded row. The `programs`
table exists so that a future, dedicated migration phase can move content
over slug-by-slug or all at once, with `getProgramBySlug`/`getPrograms`
as the single seam that changes.
