# Data Retention (Phase 7)

This document records the data categories this platform stores and the
retention policy for each. It exists to make retention an explicit,
reviewable decision rather than an implicit side effect of database
design — not to enforce automatic deletion.

## Hard Rule: No Row-Count-Based Deletion, Ever

Phoenix has approximately 5,000+ students today and is architected to
grow well beyond that. **No table in this system implements rolling,
circular, or "keep only the last N rows" deletion of any kind, at any row
count, for any reason.** This applies to every table below without
exception — Supabase records are never removed merely because a
free-tier limit, a row-count threshold, or a 500-row cap is approached.
Google Sheets in particular must never implement any such logic; it is a
reporting export, and its worksheets may need their own periodic archival
process independent of and without ever affecting the underlying Supabase
records (see `docs/GOOGLE_SHEETS_REPORTING.md`).

## Retention Categories

The retention period for each category below is marked **OWNER POLICY
REQUIRED** where no legally-justified or academy-confirmed period has
been established. No period has been invented or guessed at (no default
30-day, 90-day, or 7-year figure appears below unless it reflects an
actual confirmed requirement) — these are placeholders for a real
decision, not a real policy yet.

| Data category | Table(s) | Current retention |
|---|---|---|
| Contact enquiries | `contact_enquiries` | OWNER POLICY REQUIRED |
| Trial bookings | `trial_bookings` | OWNER POLICY REQUIRED |
| Tournament registrations | `tournament_registrations` | OWNER POLICY REQUIRED |
| User profiles | `profiles` | OWNER POLICY REQUIRED (tied to future account lifecycle policy) |
| Student records | *(not yet built — future phase)* | OWNER POLICY REQUIRED |
| Attendance records | *(not yet built — future phase)* | OWNER POLICY REQUIRED |
| Progress-tracking records | *(not yet built — future phase)* | OWNER POLICY REQUIRED |
| Certificates | *(not yet built — future phase)* | OWNER POLICY REQUIRED |
| Media metadata (R2 references) | *(not yet built — future phase)* | OWNER POLICY REQUIRED |
| Reporting outbox events | `reporting_outbox` | Operational only — see note below |
| Google Sheets reporting rows | External (Google Sheets) | OWNER POLICY REQUIRED — independent of Supabase retention |

**Note on `reporting_outbox`:** rows that reach `COMPLETED` are
operational exhaust (proof a Sheets sync happened) rather than a business
record — they are candidates for a future scheduled cleanup once a real
retention period is confirmed, but no such cleanup exists yet, and none
should be added ad hoc without an explicit decision recorded here first.

## Future Archival Strategy (Not Yet Built)

Once real retention periods are confirmed, the intended shape of an
archival system — described here so a future implementer doesn't have to
re-derive it — is:

1. **Active data** stays in Supabase for the confirmed active-use period.
2. **Historical/aged data** moves to a separate archive or export
   (mechanism TBD — could be a Supabase table partition, a periodic
   export to cold storage, or similar), rather than being deleted
   outright, unless the confirmed policy specifically calls for deletion
   (e.g. for a legally mandated erasure period).
3. **Object media** (photos, documents, certificates) lives in Cloudflare
   R2 (Phase 13, not built yet) with retention governed independently of
   the Supabase rows that reference it.
4. **Google Sheets** rows are a reporting convenience; any Sheets-side
   archival or cleanup happens independently and must never be used as a
   mechanism to determine what happens to the underlying Supabase record.

The one invariant across every future version of this strategy: Supabase
records never disappear automatically as a side effect of storage limits,
row counts, or free-tier thresholds. Any deletion is always the result of
a deliberate, confirmed retention policy being applied — never an
incidental consequence of infrastructure constraints.
