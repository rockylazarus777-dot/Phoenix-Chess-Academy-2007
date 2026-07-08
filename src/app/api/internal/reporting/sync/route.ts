import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import { appendRowToSheet, isGoogleSheetsConfigured, resolveSheetMapping } from "@/lib/google/sheets";
import { logSubmissionError } from "@/lib/actions/errors";

/**
 * Internal reporting-outbox sync worker.
 *
 * Not a public endpoint: requires `CRON_SECRET` to match, checked with a
 * constant-time comparison so response timing can't leak how much of
 * the secret matched. Intended to be triggered by an external scheduler
 * (Vercel Cron sends a GET request with `Authorization: Bearer
 * <CRON_SECRET>` when a cron job is configured against this path — see
 * docs/GOOGLE_SHEETS_REPORTING.md, "Sheets Sync Worker" for the exact
 * vercel.json snippet). POST is also accepted for manual/other-provider
 * triggering.
 *
 * Processes a BOUNDED batch (25 rows) per invocation — never the whole
 * queue — so one slow/stuck run can't monopolize the worker, and a cron
 * running every few minutes naturally drains a backlog over several
 * runs. One failed row's exception is caught individually so it can
 * never block the rest of the batch.
 */
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 8;

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return false; // fail closed if no secret is configured

  const authHeader = request.headers.get("authorization");
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const candidate = bearerMatch?.[1] ?? request.nextUrl.searchParams.get("secret") ?? "";

  const expected = Buffer.from(configuredSecret);
  const actual = Buffer.from(candidate);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function computeNextAttemptDelayMs(attemptCount: number): number {
  const oneHourMs = 60 * 60_000;
  return Math.min(2 ** attemptCount * 60_000, oneHourMs);
}

// NOTE ON THE `as never` / `as OutboxQueueRow[]` CASTS BELOW:
// supabase-js's generic Row/Update inference for a hand-written
// (non-CLI-generated) Database type does not resolve reliably through
// its nested conditional types when checked as one combined object
// (individual Tables/Views/Functions checks pass; the combined Schema
// check does not) — see docs/DATABASE_ARCHITECTURE.md, "Database
// Types". The shapes asserted here match
// supabase/migrations/0008_reporting_outbox.sql exactly, so this is a
// workaround for supabase-js's own inference gap, not a loss of real
// type safety — every field read/written below is still checked
// against `OutboxQueueRow` by the TypeScript compiler.
interface OutboxQueueRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
}

async function processBatch() {
  const supabase = getAdminSupabaseClient();

  if (!isGoogleSheetsConfigured()) {
    // Business records are already safely stored in Supabase regardless
    // — outbox rows simply stay PENDING until Sheets is configured, per
    // "Google Sheets must never be required for the site to function."
    return { configured: false, processed: 0, succeeded: 0, failed: 0 };
  }

  const { data: rawRows, error } = await supabase
    .from("reporting_outbox")
    .select("id, event_type, aggregate_type, aggregate_id, payload, attempt_count")
    .eq("status", "PENDING")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logSubmissionError({ submissionType: "reporting_sync", code: "UNKNOWN", postgresErrorCode: error.code });
    return { configured: true, processed: 0, succeeded: 0, failed: 0, error: "QUERY_FAILED" };
  }

  const rows = (rawRows ?? []) as unknown as OutboxQueueRow[];
  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    // Optimistic lock: only proceed if this row is still PENDING (guards
    // against two overlapping invocations double-processing the same row).
    const { data: locked } = await supabase
      .from("reporting_outbox")
      .update({ status: "PROCESSING" } as never)
      .eq("id", row.id)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle();

    if (!locked) continue; // another invocation already claimed this row

    const mapping = resolveSheetMapping(row.aggregate_type);
    if (!mapping) {
      await supabase
        .from("reporting_outbox")
        .update({ status: "FAILED", last_error: "UNKNOWN_AGGREGATE_TYPE" } as never)
        .eq("id", row.id);
      failed += 1;
      continue;
    }

    try {
      await appendRowToSheet(mapping.worksheetName, mapping.mapRow(row.payload));
      await supabase
        .from("reporting_outbox")
        .update({ status: "COMPLETED", processed_at: new Date().toISOString() } as never)
        .eq("id", row.id);
      succeeded += 1;
    } catch (err) {
      const nextAttemptCount = row.attempt_count + 1;
      const isExhausted = nextAttemptCount >= MAX_ATTEMPTS;
      const safeErrorMessage = err instanceof Error ? err.message.slice(0, 200) : "SHEETS_APPEND_FAILED";

      await supabase
        .from("reporting_outbox")
        .update({
          status: isExhausted ? "FAILED" : "PENDING",
          attempt_count: nextAttemptCount,
          last_error: safeErrorMessage,
          next_attempt_at: new Date(Date.now() + computeNextAttemptDelayMs(nextAttemptCount)).toISOString(),
        } as never)
        .eq("id", row.id);

      logSubmissionError({ submissionType: "reporting_sync", code: "UNKNOWN" });
      failed += 1;
    }
  }

  return { configured: true, processed: rows.length, succeeded, failed };
}

async function handleRequest(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processBatch();
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
