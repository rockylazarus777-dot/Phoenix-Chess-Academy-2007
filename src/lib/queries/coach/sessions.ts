import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { SessionStatus, TrainingMode } from "@/lib/supabase/types";

export interface CoachSessionListRow {
  id: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  programName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: SessionStatus;
  trainingMode: TrainingMode;
  locationName: string | null;
}

const SESSION_LIST_SELECT =
  "id, batch_id, session_date, start_time, end_time, timezone, status, training_mode, " +
  "batches!inner(batch_code, name, training_mode, programs(name), academy_locations(name))";

interface RawSessionListRow {
  id: string;
  batch_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: SessionStatus;
  training_mode: TrainingMode | null;
  batches: {
    batch_code: string;
    name: string;
    training_mode: TrainingMode;
    programs: { name: string } | null;
    academy_locations: { name: string } | null;
  } | null;
}

function toSessionListRow(row: RawSessionListRow): CoachSessionListRow | null {
  if (!row.batches) return null;
  return {
    id: row.id,
    batchId: row.batch_id,
    batchCode: row.batches.batch_code,
    batchName: row.batches.name,
    programName: row.batches.programs?.name ?? "—",
    sessionDate: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    status: row.status,
    trainingMode: row.training_mode ?? row.batches.training_mode,
    locationName: row.batches.academy_locations?.name ?? null,
  };
}

/**
 * "Class Sessions" — every session on a batch the coach is currently
 * assigned to. No `coach_id` column exists on `class_sessions`, so this
 * relies entirely on the `class_sessions_select_for_assigned_coach` RLS
 * policy (backed by `coach_has_batch()`) rather than an application-level
 * filter — the same reliance-on-RLS pattern already used for
 * `batches_select_for_assigned_coach` in Phase 13. See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Coach Session Query
 * Architecture".
 */
export async function listCoachSessions(): Promise<CoachQueryResult<CoachSessionListRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("class_sessions")
      .select(SESSION_LIST_SELECT)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) return coachQueryUnknownError();

    const rows = ((data ?? []) as unknown as RawSessionListRow[])
      .map(toSessionListRow)
      .filter((row): row is CoachSessionListRow => row !== null);

    return coachQueryOk(rows);
  } catch {
    return coachQueryUnavailable();
  }
}

/**
 * Sessions for exactly one assigned batch — used by
 * `/coach/batches/[batchId]/sessions`. `batchId` must already have
 * passed `getAssignedBatch()` authorization at the page level; RLS is
 * the backstop, not the only check.
 */
export async function listCoachBatchSessions(batchId: string): Promise<CoachQueryResult<CoachSessionListRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("class_sessions")
      .select(SESSION_LIST_SELECT)
      .eq("batch_id", batchId as never)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) return coachQueryUnknownError();

    const rows = ((data ?? []) as unknown as RawSessionListRow[])
      .map(toSessionListRow)
      .filter((row): row is CoachSessionListRow => row !== null);

    return coachQueryOk(rows);
  } catch {
    return coachQueryUnavailable();
  }
}
