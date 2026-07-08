# Google Sheets Reporting (Phase 7)

Google Sheets is an **operational reporting and staff-visibility layer**,
not a database. This document describes how it's connected, why it's
architected the way it is, and its exact failure behavior.

## Why Outbox Architecture

The naive integration — write the form submission to Sheets, and only
maybe also to Supabase — was rejected outright. If Sheets were the first
or only write target, a Sheets outage (or a slow API response) would mean
a real enquiry, trial request, or tournament registration is lost or
delayed at the exact moment a family is trying to reach the academy.

Instead: **Supabase transaction → business row saved → outbox event saved
(atomically, same transaction) → safe success response returned to the
user → separately, on its own schedule, an outbox worker pushes the event
to Google Sheets.** If Sheets is down, misconfigured, or not set up at
all, the registration is still safely and completely stored in Supabase;
only the Sheets *copy* is delayed. Google Sheets can be deleted entirely
without losing a single business record.

## Package Choice

`google-auth-library` (the `JWT` class) plus a direct `fetch` call to the
Sheets API v4 REST endpoint, instead of the full `googleapis` package.
`googleapis` bundles generated clients for every Google API (Sheets,
Drive, Gmail, Calendar, and dozens more) — multiple megabytes — for a
project that only ever calls one endpoint (`spreadsheets.values.append`).
`google-auth-library` is the same officially-maintained library
`googleapis` itself uses internally for service-account JWT signing, so
this choice still avoids hand-rolling the genuinely hard part (minting a
signed OAuth2 access token from a service-account private key) while
keeping the dependency small. See `src/lib/google/sheets.ts`.

## Client Architecture

`src/lib/google/sheets.ts` is server-only (`import "server-only"` at the
top, so any accidental import from a Client Component fails at build
time). It exposes:

- `isGoogleSheetsConfigured()` — true only when
  `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
  and `GOOGLE_SHEETS_SPREADSHEET_ID` are all present.
- `appendRowToSheet(worksheetName, values)` — mints/caches a JWT access
  token, then POSTs to
  `.../values/'{worksheet}'!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`.
- `mapContactEnquiryToRow`, `mapTrialBookingToRow`,
  `mapTournamentRegistrationToRow`, `resolveSheetMapping(aggregateType)`
  — see field mapping below.

The site builds and runs completely without any of these environment
variables set — Sheets configuration is optional, checked at call time,
never required for the app to start.

## Worksheets

Exactly one worksheet per record type — not one worksheet per submission
or per user:

- **Contact Enquiries**
- **Trial Bookings**
- **Tournament Registrations**

## Field Mapping

Each mapper returns an explicit, ordered array of values — never a raw
JSON dump of the outbox payload. Every row's first two columns are always
the immutable Supabase Record ID and its `created_at`, and the final
column is always the record's `status`.

**Contact Enquiries:** Record ID, Created At, Full Name, Email, Phone,
Country, Enquiry Type, Subject, Message, Status.

**Trial Bookings:** Record ID, Created At, Student Full Name, Date of
Birth, Chess Level, FIDE ID, FIDE Rating, Country, State, City, Preferred
Program, Training Mode, Preferred Schedule, Guardian Name, Guardian
Email, Guardian Phone, Status.

**Tournament Registrations:** Record ID, Created At, Tournament ID,
Tournament Name, Category ID, Category Name, Player Full Name, Date of
Birth, FIDE ID, FIDE Rating, Country, State, City, Email, Phone, WhatsApp,
Guardian Name, Guardian Phone, Status.

**Intentionally excluded fields** (present in Supabase, not synced to
Sheets, because they carry no day-to-day operational reporting value for
staff and/or are more sensitive than necessary to duplicate into a
shared spreadsheet): consent timestamps and boolean flags
(`rules_acknowledged_at`, `privacy_acknowledged_at`, `media_consent`,
`marketing_consent`), free-text `goals`/`message` bodies beyond what a
subject line already conveys is intentionally kept out of the tournament
and trial mappings' operational columns, `source`, `chess_association_id`,
`school_or_academy`, `club`, and internal audit fields (`updated_at`).
Staff needing that level of detail work from the Supabase record directly
via the Record ID in column 1.

## Sync Worker

`src/app/api/internal/reporting/sync/route.ts` — a Route Handler (not a
Server Action; a Server Action cannot be triggered by an external cron
provider or carry a bearer-token header). Accepts `GET` or `POST`.

- **Auth:** requires a `CRON_SECRET` to match, supplied either as
  `Authorization: Bearer <secret>` or a `?secret=` query parameter,
  compared with `node:crypto.timingSafeEqual` so response timing can't
  leak a partial match. If `CRON_SECRET` isn't configured, the route
  fails closed (always unauthorized) rather than open.
- **Batch size:** processes up to 25 `PENDING` outbox rows per
  invocation, ordered by `created_at`, so one invocation can never
  monopolize the worker or time out on an unbounded queue. A cron
  scheduled every few minutes drains a larger backlog over several runs.
- **Locking:** each row is claimed with a conditional
  `UPDATE ... WHERE status = 'PENDING'` before processing, so two
  overlapping invocations can't double-process the same row.
- **Isolation:** each row's Sheets append is wrapped in its own
  try/catch — one failing row never blocks or aborts the rest of the
  batch.

Example Vercel Cron configuration (`vercel.json`), once this project is
deployed to Vercel:

```json
{
  "crons": [
    { "path": "/api/internal/reporting/sync", "schedule": "*/5 * * * *" }
  ]
}
```

Vercel Cron sends the request with an
`Authorization: Bearer $CRON_SECRET` header automatically when
`CRON_SECRET` is set as a Vercel environment variable — no code change
needed to support this.

## Retry Behavior

A failed append increments `attempt_count` and sets `next_attempt_at` to
`now + min(2^attempt_count * 60s, 1 hour)` — exponential backoff capped
at one hour. After 8 attempts, the row is marked `FAILED` (a terminal
state; it will no longer be retried automatically, but nothing about the
underlying Supabase business record is affected). `last_error` stores a
short (≤200 char), generic failure reason — never a full Google API error
body — for support debugging without further PII exposure.

## Idempotency Strategy

Every synced row's first column is the Supabase record's UUID — the
Record ID. This project's guarantee is honestly described as
**at-least-once delivery, not exactly-once**: if a Sheets append succeeds
but the subsequent Supabase status update to `COMPLETED` fails (e.g. a
crash between the two calls), the same outbox row could be retried and
appended to the Sheet a second time. Because every row carries the
immutable Record ID, any such duplicate is trivially detectable and
reconcilable by filtering the sheet for a repeated ID — this is a
deliberate, disclosed trade-off in exchange for never silently dropping a
row, not an oversight.

## Privacy

The connected Google Sheet must be restricted to authorized Phoenix
staff only — no "anyone with the link" sharing, no public sharing link of
any kind. `GOOGLE_SHEETS_SPREADSHEET_ID` is not treated as a secret on
the level of the service-account private key (knowing a spreadsheet ID
alone grants no access without the service account's own credentials),
but it is still never rendered in any public page, API response, or
client-side code — it exists only as a server environment variable.

## Local Development

**Mode A — Sheets not configured:** leave the four Google environment
variables unset. Forms still submit real records into Supabase normally;
`reporting_outbox` events are created and simply stay `PENDING`
indefinitely (harmlessly) since the sync worker refuses to run without
configuration. Nothing in the public site depends on Sheets being
present.

**Mode B — Sheets configured:** set
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GOOGLE_SHEETS_SPREADSHEET_ID`, and `CRON_SECRET`. Manually trigger a sync
with:

```bash
curl -X POST "http://localhost:3000/api/internal/reporting/sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

and confirm the three worksheets receive the expected rows.
